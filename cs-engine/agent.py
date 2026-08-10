"""
Okapi Platform — Multi-tenant WhatsApp AI Agent
"""

import sys
print(f"[startup] Python {sys.version}", flush=True)

import base64
import json
import os
import random
import re
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

# Per-conversation processing lock — prevents AI burst from concurrent inbound messages
_conv_locks: dict = {}
_conv_locks_mutex = threading.Lock()

def _get_conv_lock(key: str) -> threading.Lock:
    with _conv_locks_mutex:
        if key not in _conv_locks:
            _conv_locks[key] = threading.Lock()
        return _conv_locks[key]

# Message debounce buffer — merges rapid messages before processing
_msg_buffer: dict = {}          # conv_key → {'messages': [str], 'timer': Timer}
_msg_buffer_lock = threading.Lock()
MSG_DEBOUNCE_SECS = 4.0

def biz_now(business: Optional[dict] = None) -> datetime:
    tz_name = (business or {}).get('timezone', 'America/Costa_Rica')
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('America/Costa_Rica')
    return datetime.now(tz)

def is_business_hours(business: Optional[dict] = None) -> bool:
    now      = biz_now(business)
    settings = (business or {}).get('settings', {})
    h_start  = int(settings.get('hours_start', 8))
    h_end    = int(settings.get('hours_end',   18))
    # hours_days: list of weekday ints (0=Mon … 6=Sun); default Mon-Sun
    days     = settings.get('hours_days')
    if days is not None:
        # now.weekday() is 0=Mon … 6=Sun
        if now.weekday() not in [int(d) for d in days]:
            return False
    return h_start <= now.hour < h_end

def after_hours_note(business: Optional[dict] = None, language: str = 'en') -> str:
    if is_business_hours(business):
        return ''
    settings = (business or {}).get('settings', {})
    h_start  = int(settings.get('hours_start', 8))
    h_end    = int(settings.get('hours_end',   18))
    h_range  = f'{h_start}am–{h_end - 12 if h_end > 12 else h_end}pm'
    if language == 'es':
        return (f'\n\n_Nota: nuestro equipo opera principalmente de {h_start}am a '
                f'{h_end - 12 if h_end > 12 else h_end}pm, '
                f'por lo que la confirmación podría tardar un poco más. '
                f'Te avisamos en cuanto tengamos respuesta._')
    return (f'\n\n_Note: our team mainly operates between {h_range}, '
            f'so confirmation may take a little longer. '
            f'We\'ll notify you as soon as we hear back._')

import anthropic
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, session, redirect, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from twilio.request_validator import RequestValidator
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'), override=True)

print("[startup] importing supabase_store...", flush=True)
import supabase_store as store
print("[startup] supabase_store OK", flush=True)

# ─── CONFIG ──────────────────────────────────────────────────────────────────

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN  = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_WA_NUMBER   = os.getenv('TWILIO_WA_NUMBER')
ANTHROPIC_API_KEY  = os.getenv('ANTHROPIC_API_KEY')

# Meta Cloud API — global fallbacks (overridden per-business from DB)
META_ACCESS_TOKEN    = os.getenv('META_ACCESS_TOKEN', '')
META_PHONE_NUMBER_ID = os.getenv('META_PHONE_NUMBER_ID', '')
META_APP_SECRET      = os.getenv('META_APP_SECRET', '')
META_VERIFY_TOKEN    = os.getenv('META_VERIFY_TOKEN', 'okapi_meta_webhook')

# Env-var provider fallback (used if DB lookup fails)
PROVIDERS = json.loads(os.getenv('PROVIDERS', '{}'))

TILOPAY_API_URL  = 'https://app.tilopay.com/api/v1/'
TILOPAY_KEY      = os.getenv('TILOPAY_KEY',      '2551-6952-8539-8918-3539')
TILOPAY_USER     = os.getenv('TILOPAY_USER',     'wHFrGq')
TILOPAY_PASSWORD = os.getenv('TILOPAY_PASSWORD', 'mOadzM')
AGENT_BASE_URL   = os.getenv('AGENT_BASE_URL',
                               'https://agent.projectokapi.com')

ADMIN_PASSWORD       = os.getenv('ADMIN_PASSWORD', '')
ADMIN_WA             = os.getenv('ADMIN_WA', '')       # Admin WhatsApp for system alerts
PANEL_BASE_URL       = os.getenv('PANEL_BASE_URL', '') # Fallback panel URL for businesses without panel_url
RESEND_API_KEY       = os.getenv('RESEND_API_KEY', '')
CRON_SECRET          = os.getenv('CRON_SECRET', '')
PENDING_TTL_H        = int(os.getenv('PENDING_TTL_H', '48'))
DEFAULT_BUSINESS_SLUG = os.getenv('DEFAULT_BUSINESS_SLUG', '')  # Legacy /webhook compat

# ─── CLIENTS ─────────────────────────────────────────────────────────────────

# Global Twilio client — used as fallback when a business has no own credentials.
_global_twilio = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

_twilio_cache: dict[tuple, Client] = {}

def get_twilio_client(business: Optional[dict] = None) -> Client:
    """Return a Twilio client scoped to the business if it has its own creds."""
    sid   = (business or {}).get('twilio_account_sid') or TWILIO_ACCOUNT_SID
    token = (business or {}).get('twilio_auth_token')  or TWILIO_AUTH_TOKEN
    if not sid or not token:
        return _global_twilio
    key = (sid, token)
    if key not in _twilio_cache:
        _twilio_cache[key] = Client(sid, token)
    return _twilio_cache[key]

def get_twilio_auth_token(business: Optional[dict] = None) -> str:
    """Return the auth token for signature validation — per-business or global."""
    return (business or {}).get('twilio_auth_token') or TWILIO_AUTH_TOKEN or ''

claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
app           = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # no global limit — apply per route
    storage_uri='memory://',
)

# ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

def _load_prompt():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt.txt')
    try:
        with open(path, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return ''

_FILE_PROMPT = _load_prompt()

def classify_business_line(business: Optional[dict], history: list, configs: list) -> Optional[str]:
    """
    Classify conversation into a business line.
    Step 1: keyword match against WooCommerce-linked category products (deterministic, no AI).
    Step 2: Claude Haiku with per-line descriptions (semantic fallback).
    Returns the matched line name or None if unclear.
    """
    if not configs or not history:
        return None

    # Normalize: accept both legacy string[] and new dict[] format
    normalized = []
    for item in configs:
        if isinstance(item, str):
            normalized.append({'name': item, 'description': '', 'woocommerce_linked': False})
        elif isinstance(item, dict) and item.get('name'):
            normalized.append(item)
    if not normalized:
        return None

    line_names = [c['name'] for c in normalized]

    # Build flattened conversation text from recent messages
    recent = history[-8:]
    conv_parts = [m['content'][:400] for m in recent if m.get('content')]
    conv_lower = ' '.join(conv_parts).lower()

    # ── Step 1: WooCommerce keyword check (client messages only) ──────────────
    woo_config = next((c for c in normalized if c.get('woocommerce_linked')), None)
    if woo_config:
        bid = (business or {}).get('id')
        try:
            cats = store.get_categories_keywords(bid)
            retail_cat = next((c for c in cats if c.get('name', '').lower() == woo_config['name'].lower()), None)
            if retail_cat:
                keywords = [k for k in (retail_cat.get('product_keywords') or []) if k]
                # Only match against client messages — agent responses contain words like
                # "producto" that would false-positive against Retail keywords
                client_parts = [
                    m['content'][:400] for m in recent
                    if m.get('content') and m.get('role') == 'user'
                ]
                client_lower = ' '.join(client_parts).lower()
                if any(k.lower() in client_lower for k in keywords):
                    print(f'  🏷 Business line matched via WooCommerce keywords → {woo_config["name"]}', flush=True)
                    return woo_config['name']
        except Exception as e:
            print(f'  ⚠ classify_business_line woo check: {e}', flush=True)

    # ── Step 2: Claude Haiku with descriptions ─────────────────────────────────
    conv_text = '\n'.join(
        f"{m['role'].upper()}: {m['content'][:200]}"
        for m in recent if m.get('content')
    )
    lines_str = '\n'.join(
        f'- {c["name"]}: {c["description"]}' if c.get('description') else f'- {c["name"]}'
        for c in normalized
    )
    try:
        r = claude_client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=30,
            messages=[{
                'role': 'user',
                'content': (
                    f'Clasifica esta conversación de WhatsApp en UNA de estas líneas de negocio:\n{lines_str}\n\n'
                    f'Conversación:\n{conv_text}\n\n'
                    'Responde ÚNICAMENTE con el nombre exacto de la línea (tal como aparece arriba). '
                    'Si no hay suficiente contexto todavía, responde "desconocido".'
                ),
            }],
        )
        result = r.content[0].text.strip()
        for name in line_names:
            if name.lower() == result.lower():
                print(f'  🏷 Business line classified by Haiku → {name}', flush=True)
                return name
        return None
    except Exception as e:
        print(f'  ⚠ classify_business_line haiku: {e}', flush=True)
        return None


def detect_product_interest(business_id: Optional[str], *texts: str) -> Optional[str]:
    """Scan texts for category keywords. Returns matched category name or None."""
    categories = store.get_categories_keywords(business_id)
    if not categories:
        return None
    combined = ' '.join(t.lower() for t in texts if t)
    for cat in categories:
        keywords = cat.get('product_keywords') or []
        if any(k.lower() in combined for k in keywords):
            return cat['name']
    for cat in categories:
        if cat['name'].lower() in combined:
            return cat['name']
    return None


def get_system_prompt(business: Optional[dict] = None, product_interest: Optional[str] = None) -> str:
    """Return active prompt with optional per-product/category context appended."""
    base = _FILE_PROMPT
    if business:
        db_prompt = store.get_active_prompt(business.get('id'))
        if db_prompt:
            base = db_prompt

    # Human mode: prepend communication rules that override everything else
    if business and (business.get('settings') or {}).get('human_mode'):
        base = (
            "REGLAS DE COMUNICACIÓN (obligatorias, sin excepciones):\n"
            "- No uses emojis en ningún mensaje. Cero emojis.\n"
            "- Escribe como un humano real en WhatsApp: texto plano, natural, conversacional.\n"
            "- Sin asteriscos, sin markdown, sin negritas, sin listas con guiones.\n"
            "- Una sola pregunta por mensaje. Si necesitás más información, la pedís en el siguiente turno.\n"
            "- PRIMER MENSAJE — saludo obligatorio: usá el nombre de la empresa seguido de 'con gusto'. "
            "Formato exacto: '[Buenos días/Buenas tardes/Buenas noches], [Nombre empresa], con gusto.' "
            "No respondas 'Hola' ni omitas el nombre de la empresa.\n"
            "- Si alguien consulta algo que no está en tu catálogo, describe un producto que no "
            "reconocés, o pide algo fuera de lo normal, no cotices ni confirmes nada — primero "
            "preguntá con precisión qué necesita exactamente antes de continuar.\n\n"
        ) + base

    # Inject general business documents (guides, analyses) into every conversation
    if business:
        biz_docs = store.get_business_documents(business.get('id'))
        if biz_docs:
            doc_sections = '\n\n'.join(
                f"### {d['filename']}\n{d['text']}" for d in biz_docs
            )
            base = f"{base}\n\n## Documentos de contexto del negocio\n{doc_sections}"

    if not product_interest or not business:
        return base

    ctx = store.get_product_context(business.get('id'), product_interest)
    if not ctx:
        return base

    sections = [base]

    if ctx.get('category_name'):
        # Category-level context (new format)
        if ctx.get('prompt_instructions'):
            sections.append(
                f"\n\n## Instrucciones para {ctx['category_name']}\n{ctx['prompt_instructions']}"
            )
        products = ctx.get('products', [])
        if products:
            lines = []
            for p in products:
                name = p['name']
                code = f" ({p['model_code']})" if p.get('model_code') and p['model_code'] != name else ''
                price = f": {p.get('currency','USD')} {p['price']:,.0f}" if p.get('price') else ''
                desc = f" — {p['description']}" if p.get('description') else ''
                lines.append(f"• {name}{code}{price}{desc}")
            sections.append(
                f"\n\n## Modelos disponibles — {ctx['category_name']}\n" + '\n'.join(lines)
            )
        for doc in ctx.get('documents', []):
            sections.append(f"\n\n## Documentación ({doc['filename']})\n{doc['text'][:3000]}")

    elif ctx.get('product_name'):
        # Legacy per-product context
        if ctx.get('prompt_snippet'):
            sections.append(
                f"\n\n## Instrucciones específicas para {ctx['product_name']}\n{ctx['prompt_snippet']}"
            )
        if ctx.get('price'):
            sections.append(
                f"\n\n## Precio de referencia\n{ctx['product_name']}: {ctx['currency']} {ctx['price']:,.0f}"
            )
        for doc in ctx.get('documents', []):
            sections.append(f"\n\n## Información del producto ({doc['filename']})\n{doc['text'][:3000]}")

    return ''.join(sections)

PRICE_EXTRACT_PROMPT = """Extract rental availability, price, and currency from a provider's WhatsApp reply.

You are given the booking's pick-up and drop-off dates (to calculate rental days) and the provider's reply.

Return ONLY a JSON object with exactly three fields:
- "available": true or false
- "price": the TOTAL numeric rental price as a float, or null if unavailable/unclear
- "currency": "USD" or "CRC"

## DEFAULT CURRENCY: USD
Always default to "USD" unless the provider clearly indicates colones.
CRC indicators: "colones", "₡", "CRC", "colon", "crc"
USD indicators: "$", "dólares", "USD", "dollars" — or NO currency symbol at all.

## DAILY RATE RULE
If the provider quotes a per-day rate ("$80/day", "$80 por día", "80 diario", "80 al día"),
multiply by the number of rental days to get the TOTAL price.

## AVAILABILITY RULE
If ANY numeric price >= 20 appears, set available=true — UNLESS a clear negative phrase
appears AND no price is given alongside it.
Prices below 20 are NOT valid rental prices — ignore them.

## NEGATIVE signals (only when NO price present):
"no disponible", "no tengo", "not available", "lleno", "ocupado", "no puedo", "sorry"

## POSITIVE signals: any number >= 20 alongside the message, "confirmo", "sería/serían",
"son", "cuesta", "disponible", "available", "sí/si", "yes", "claro", "$", "₡"

Examples (assume 4-day rental):
"500"                            → {"available": true,  "price": 500.00,    "currency": "USD"}
"$80/day"                        → {"available": true,  "price": 320.00,    "currency": "USD"}
"80 por día"                     → {"available": true,  "price": 320.00,    "currency": "USD"}
"Confirmo, serían $500 dólares"  → {"available": true,  "price": 500.00,    "currency": "USD"}
"Sí, 85000 colones"              → {"available": true,  "price": 85000.00,  "currency": "CRC"}
"Son 300"                        → {"available": true,  "price": 300.00,    "currency": "USD"}
"No disponible esas fechas"      → {"available": false, "price": null,      "currency": null}
"Si" or "Ok"                     → {"available": false, "price": null,      "currency": null}

Return ONLY valid JSON. No explanation."""

CONTACT_EXTRACT_PROMPT = """Extract contact information from a WhatsApp conversation between a booking agent and a customer.

Look through ALL messages and extract:
- name: the customer's full name (if explicitly stated)
- email: the customer's email address (if explicitly stated)
- phone: the customer's phone number (only if explicitly stated AND different from their WhatsApp number)

Return ONLY a JSON object with exactly three fields:
{"name": "John Smith", "email": "john@example.com", "phone": null}

Use null for any field not found. NEVER guess or infer — only extract explicitly stated information.
Names are given in response to "what is your name?" or volunteered by the customer.
Emails look like xxx@xxx.xxx"""

# ─── TILOPAY ─────────────────────────────────────────────────────────────────

_token_cache: dict = {'token': None, 'expires': 0.0}

def _tilopay_post(endpoint: str, payload: dict, token: Optional[str] = None) -> dict:
    url     = TILOPAY_API_URL + endpoint
    data    = json.dumps(payload).encode('utf-8')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'bearer {token}'
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))

def tilopay_get_token() -> Optional[str]:
    now = time.time()
    if _token_cache['token'] and now < _token_cache['expires']:
        return _token_cache['token']
    try:
        result = _tilopay_post('login', {'email': TILOPAY_USER, 'password': TILOPAY_PASSWORD})
        token  = result.get('access_token')
        if token:
            _token_cache['token']   = token
            _token_cache['expires'] = now + 3500
            print('  ✓ Tilopay token refreshed')
        return token
    except Exception as e:
        print(f'  ✗ Tilopay login failed: {e}')
        return None

def tilopay_create_payment_link(amount: float, order_number: str,
                                 client_email: str, client_name: str,
                                 currency: str = 'USD',
                                 description: str = '') -> Optional[str]:
    token = tilopay_get_token()
    if not token:
        return None
    parts        = client_name.strip().split(' ', 1)
    first_name   = parts[0]
    last_name    = parts[1] if len(parts) > 1 else ''
    redirect_url = f"{AGENT_BASE_URL}/payment-confirmed?order={order_number}"
    payload: dict = {
        'key':             TILOPAY_KEY,
        'amount':          round(amount, 2),
        'currency':        currency,
        'orderNumber':     order_number,
        'billToEmail':     client_email,
        'billToFirstName': first_name,
        'billToLastName':  last_name,
        'billToCountry':   'CR',
        'redirect':        redirect_url,
        'capture':         1,
        'language':        'es',
    }
    if description:
        payload['description'] = description[:255]
    try:
        result = _tilopay_post('processPayment', payload, token=token)
        url = result.get('url')
        print(f'  ✓ Tilopay link created ({currency} {amount}): {url}')
        return url
    except Exception as e:
        print(f'  ✗ Tilopay payment link failed: {e}')
        _token_cache['token'] = None
        return None

# ─── PROVIDER HELPERS ────────────────────────────────────────────────────────

def get_provider_for_booking(booking_text: str, business: Optional[dict] = None) -> str:
    """Look up provider phone from DB first, fall back to env var PROVIDERS."""
    bid = business.get('id') if business else None
    db_providers = store.get_providers_for_business(bid)
    providers = db_providers or PROVIDERS

    for line in booking_text.splitlines():
        if line.lower().startswith('location:'):
            location = line.split(':', 1)[1].strip().lower()
            for key, number in providers.items():
                if key.lower() in location:
                    return number

    twilio_sender = (business or {}).get('twilio_sender', TWILIO_WA_NUMBER)
    return twilio_sender or 'whatsapp:+50685157780'

def get_provider_location(phone: str, business: Optional[dict] = None) -> Optional[str]:
    """Return location name if phone belongs to a known provider."""
    bid = business.get('id') if business else None
    db_providers = store.get_providers_for_business(bid)
    providers = db_providers or PROVIDERS

    for location, number in providers.items():
        if number == phone:
            return location
    return None

def get_commission_rate(provider_number: str, business: Optional[dict] = None) -> float:
    """Lookup order: provider default → business default → 10% fallback."""
    bid = business.get('id') if business else None
    p = store.get_provider_by_number(provider_number, bid)
    if p and p.get('default_commission_pct') is not None:
        return float(p['default_commission_pct'])
    if business and business.get('default_commission_pct') is not None:
        return float(business['default_commission_pct'])
    return 10.0

def _redact_contacts(booking_text: str) -> str:
    redacted_fields = {'name', 'phone', 'email'}
    lines = []
    for line in booking_text.splitlines():
        field = line.split(':', 1)[0].strip().lower()
        if field not in redacted_fields:
            lines.append(line)
    return '\n'.join(lines)

def _extract_booking_field(booking_text: str, field: str) -> str:
    for line in booking_text.splitlines():
        if line.lower().startswith(field.lower() + ':'):
            return line.split(':', 1)[1].strip()
    return ''

# ─── CLAUDE ──────────────────────────────────────────────────────────────────

def detect_client_language(phone: str, business: Optional[dict] = None) -> str:
    bid = business.get('id') if business else None
    history     = store.get_history(phone, bid)
    client_msgs = [m['content'] for m in history if m['role'] == 'user'][-5:]
    if not client_msgs:
        return 'en'
    text = ' '.join(client_msgs).lower()
    spanish_words = {'si', 'sí', 'no', 'gracias', 'hola', 'quiero', 'necesito',
                     'por', 'favor', 'reserva', 'días', 'dias', 'carro', 'fechas',
                     'cuánto', 'cuanto', 'para', 'como', 'están', 'estan'}
    hits = sum(1 for w in spanish_words if w in text.split())
    return 'es' if hits >= 1 else 'en'

def ask_claude(phone: str, user_message: str, business: Optional[dict] = None,
               ad_product_interest: Optional[str] = None,
               is_first: bool = False) -> str:
    bid     = business.get('id') if business else None
    history = store.get_history(phone, bid)
    messages = [{'role': m['role'], 'content': m['content']} for m in history]
    # Only append user message if it's not already the last entry in history
    if not (messages and messages[-1]['role'] == 'user' and messages[-1]['content'] == user_message):
        messages.append({'role': 'user', 'content': user_message})
    clean_phone = phone.replace('whatsapp:', '').strip()
    now_local   = biz_now(business)
    today_str   = now_local.strftime('%A, %B %d, %Y')
    time_str    = now_local.strftime('%H:%M')

    # Real-time category detection: scan current message + last 5 history messages
    recent_texts = [m['content'] for m in history[-5:] if m.get('content')]
    product_interest = (
        detect_product_interest(bid, user_message, *recent_texts)
        or ad_product_interest
    )

    # Build greeting prefill for first message — injected as assistant turn so model can't skip it
    hour = now_local.hour
    if hour < 12:
        _saludo = 'días'
    elif hour < 18:
        _saludo = 'tardes'
    else:
        _saludo = 'noches'
    # Use short_name from settings if available, fall back to full name
    settings = (business or {}).get('settings') or {}
    biz_name = settings.get('short_name') or (business or {}).get('name') or 'Acuarium'
    _greeting_prefill = f'Buenas {_saludo}, {biz_name}, con gusto.'

    greeting_note = (
        'La conversación ya está en curso — NO repitas el saludo inicial, respondé directamente.'
        if not is_first else
        'Es el PRIMER mensaje. NO escribas ningún saludo ni bienvenida — '
        've directo a la pregunta de calificación. El saludo ya se antepone automáticamente.'
    )

    _modules_ask = (business or {}).get('modules', {})
    _medical_enabled = _modules_ask.get('medical', {}).get('enabled', False)
    _medical_ctx = _build_medical_context(phone, business) if (_medical_enabled and business) else ''

    system = (
        get_system_prompt(business, product_interest)
        + f'\n\n## Contexto actual\n'
        + f'Fecha: {today_str} | Hora local: {time_str}.\n'
        + f'{greeting_note}\n'
        + f'\n\n## WhatsApp del cliente\n'
        + f'Esta conversación viene del número: {clean_phone}\n'
        + f'Al confirmar el teléfono, usa este número en lugar de pedirle que lo escriba. '
        + f'Ejemplo: "¿Es {clean_phone} el mejor número para contactarte?"'
        + _medical_ctx
    )

    response = claude_client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    import re as _re
    text = response.content[0].text
    if is_first:
        # Strip any greeting Claude may have added despite instructions (human_mode prompt conflict)
        text = _re.sub(
            r'^(Buenas?\s+(?:d[ií]as|tardes|noches)[,\s][^\n]*?con gusto\.?\s*)',
            '', text, flags=_re.IGNORECASE
        ).strip()
        text = _greeting_prefill + ' ' + text
    return text

_CRC_KEYWORDS = ('colones', 'colon', '₡', ' crc')
_MIN_PRICE_USD = 20.0
_MIN_PRICE_CRC = 5000.0

def _extract_price(provider_message: str, pickup: str, dropoff: str):
    """Return (available, price, currency) from provider message. Defaults to USD."""
    extract_input = (
        f'Booking dates:\n  Pick-up: {pickup}\n  Drop-off: {dropoff}\n\n'
        f"Provider's reply: {provider_message}"
    )
    try:
        resp = claude_client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=128,
            system=PRICE_EXTRACT_PROMPT,
            messages=[{'role': 'user', 'content': extract_input}],
        )
        parsed   = json.loads(resp.content[0].text.strip())
        available = parsed.get('available', False)
        price     = parsed.get('price')
        currency  = (parsed.get('currency') or 'USD').upper()
    except Exception as e:
        print(f'  ⚠ Claude price extract failed: {e}')
        available, price, currency = False, None, 'USD'

    # Validate minimum price — ignore clearly wrong numbers
    if price is not None:
        min_p = _MIN_PRICE_CRC if currency == 'CRC' else _MIN_PRICE_USD
        if float(price) < min_p:
            print(f'  ⚠ Price {price} {currency} below minimum — discarding')
            price = None
            available = False

    # Regex fallback if Claude returned no price but message has numbers
    if not available or not price:
        msg_lower = provider_message.lower()
        negative_words = ['no disponible', 'not available', 'no tengo', 'lleno',
                          'ocupado', 'no puedo', 'sorry']
        if not any(w in msg_lower for w in negative_words):
            candidates = []
            for n in re.findall(r'[\d]+(?:[.,][\d]+)*', provider_message):
                try:
                    candidates.append(float(n.replace(',', '').replace('.', '')))
                except ValueError:
                    pass
            # Determine currency first to apply correct minimum
            regex_crc = any(w in msg_lower for w in _CRC_KEYWORDS)
            regex_currency = 'CRC' if regex_crc else 'USD'
            min_p = _MIN_PRICE_CRC if regex_crc else _MIN_PRICE_USD
            valid = [c for c in candidates if c >= min_p]
            if valid:
                price     = max(valid)
                available = True
                currency  = regex_currency
                print(f'  ⚠ Regex fallback: {currency} {price}')

    return available, price, currency


def update_lead_contact_info(from_number: str, business_id: Optional[str] = None):
    """Extract name/email from recent conversation and update lead if fields are missing."""
    existing = store.get_lead_by_phone(from_number, business_id)
    if existing and existing.get('name') and existing.get('email'):
        return  # both already set — skip Claude call
    history = store.get_history(from_number, business_id)
    if not history:
        return
    recent = history[-10:]
    transcript = '\n'.join(
        f"[{'Customer' if m['role'] == 'user' else 'Agent'}]: {m.get('content', '')}"
        for m in recent
    )
    try:
        resp = claude_client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=128,
            system=CONTACT_EXTRACT_PROMPT,
            messages=[{'role': 'user', 'content': transcript}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown code fences if Claude wrapped the JSON
        if raw.startswith('```'):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw).strip()
        if not raw:
            return
        parsed = json.loads(raw)
        fields = {k: v for k, v in parsed.items() if v and k in ('name', 'email')}
        if fields:
            store.update_lead_fields_if_empty(from_number, fields, business_id)
    except Exception as e:
        print(f'  ⚠ update_lead_contact_info: {e}')


def relay_quote_to_client(provider_message: str, booking_text: str,
                           client_phone: str, provider_number: str,
                           language: str = 'en',
                           commission_pct: float = 10.0,
                           business: Optional[dict] = None) -> str:
    pickup  = _extract_booking_field(booking_text, 'Pick-up')
    dropoff = _extract_booking_field(booking_text, 'Drop-off')

    available, price, currency = _extract_price(provider_message, pickup, dropoff)

    es = (language == 'es')

    if not available or not price:
        if es:
            return (
                'Hola! Consultamos con el proveedor local para tus fechas.\n\n'
                'Lamentablemente no tienen disponibilidad en este momento. 😔\n\n'
                '¿Te gustaría intentar con otras fechas o una ubicación diferente? '
                '¡Estamos felices de encontrar la mejor opción para ti! 🏖️'
            )
        return (
            'Hi! We checked with the local provider for your requested dates.\n\n'
            'Unfortunately they\'re not available right now. 😔\n\n'
            'Would you like to try different dates or a different location? '
            'We\'re happy to find the best option for you! 🏖️'
        )

    rental      = float(price)
    fee_amount  = round(rental * (commission_pct / 100), 2)
    balance     = round(rental, 2)
    grand_total = round(rental + fee_amount, 2)

    def fmt(n):
        return f'₡{int(n):,}' if currency == 'CRC' else f'${n:.2f}'

    fee_display  = fmt(fee_amount)
    balance_disp = fmt(balance)
    total_disp   = fmt(grand_total)

    biz          = business or {}
    biz_slug     = re.sub(r'[^A-Z]', '', biz.get('slug', 'BIZ').upper())[:4]
    biz_settings = biz.get('settings', {})
    product_en   = biz_settings.get('product_term_en', 'Rental')
    product_es   = biz_settings.get('product_term_es', 'Alquiler')
    client_name  = _extract_booking_field(booking_text, 'Name')  or 'Client'
    client_email = _extract_booking_field(booking_text, 'Email') or f'client@{biz.get("slug", "business")}.com'
    cart         = _extract_booking_field(booking_text, 'Cart')
    location     = _extract_booking_field(booking_text, 'Location')
    qty          = _extract_booking_field(booking_text, 'Quantity') or '1'
    cart_qty     = f'{cart} × {qty}' if qty not in ('', '1') else cart

    loc_code     = re.sub(r'[^A-Z]', '', location.upper())[:4] if location else biz_slug
    order_number = f'{biz_slug}-{datetime.utcnow().strftime("%y%m%d%H%M")}-{loc_code}'

    pickup_short  = pickup[:10]  if pickup  else ''
    dropoff_short = dropoff[:10] if dropoff else ''
    description   = (
        f'{biz.get("name", product_en)} — {location} | {cart_qty}'
        + (f' | {pickup_short} → {dropoff_short}' if pickup_short else '')
    )

    store.update_pending_quote_fee(provider_number, fee_amount, currency)

    payment_link = None
    for attempt in range(2):
        payment_link = tilopay_create_payment_link(fee_amount, order_number,
                                                   client_email, client_name,
                                                   currency=currency,
                                                   description=description)
        if payment_link:
            break
        print(f'  ⚠ Tilopay attempt {attempt + 1} failed — '
              f'{"retrying…" if attempt == 0 else "giving up"}')

    if payment_link:
        store.add_pending_payment(order_number, client_phone, provider_number,
                                  booking_text, fee_amount)

    if es:
        msg  = f'🎉 ¡{product_es} disponible — confirma tu reserva!\n\n'
        msg += f'📍 {location}  |  🛒 {cart_qty}\n'
        msg += f'📅 {pickup} → {dropoff}\n\n'
        msg += f'💰 *Resumen de pago:*\n'
        msg += f'• Cargo de reserva _(cancelar ahora)_: *{fee_display}*\n'
        msg += f'• Saldo del {product_es.lower()} _(al recoger)_: {balance_disp}\n'
        msg += f'• *Total: {total_disp}*\n\n'
        if payment_link:
            msg += f'Para confirmar tu reserva, cancela el cargo de *{fee_display}* aquí:\n'
            msg += f'👉 {payment_link}\n\n'
            msg += ('Una vez procesado el pago, tu reserva queda 100% confirmada y '
                    'recibirás todos los detalles. 🏖️\n\n'
                    '_El cargo de reserva no es reembolsable una vez confirmado._')
        else:
            msg += (f'Responde *CONFIRMAR* y te enviamos el enlace para cancelar '
                    f'el cargo de reserva de {fee_display}.')
    else:
        msg  = f'🎉 {product_en} available — confirm your booking!\n\n'
        msg += f'📍 {location}  |  🛒 {cart_qty}\n'
        msg += f'📅 {pickup} → {dropoff}\n\n'
        msg += f'💰 *Payment summary:*\n'
        msg += f'• Booking fee _(pay now to confirm)_: *{fee_display}*\n'
        msg += f'• {product_en} balance _(paid at pickup)_: {balance_disp}\n'
        msg += f'• *Total: {total_disp}*\n\n'
        if payment_link:
            msg += f'To confirm your booking, pay the *{fee_display}* fee here:\n'
            msg += f'👉 {payment_link}\n\n'
            msg += ('Once your payment is processed, your booking is 100% confirmed and '
                    "you'll receive all the details. 🏖️\n\n"
                    '_Booking fees are non-refundable after confirmation._')
        else:
            msg += (f'Please reply *CONFIRM* and we\'ll send you the payment link '
                    f'for the {fee_display} booking fee.')
    return msg

# ─── PROVIDER NOTIFICATION ───────────────────────────────────────────────────

def extract_booking(text: str) -> Optional[str]:
    start = text.find('[BOOKING_READY]')
    end   = text.find('[/BOOKING_READY]')
    if start != -1 and end != -1:
        return text[start + len('[BOOKING_READY]'):end].strip()
    return None

def notify_provider(booking_text: str, client_phone: str,
                    business: Optional[dict] = None,
                    twilio_sender: Optional[str] = None):
    """Send two-message commission negotiation flow to provider."""
    provider_number = get_provider_for_booking(booking_text, business)
    sender          = twilio_sender or TWILIO_WA_NUMBER
    commission_pct  = get_commission_rate(provider_number, business)
    bid             = business.get('id') if business else None

    location = _extract_booking_field(booking_text, 'Location')
    cart     = _extract_booking_field(booking_text, 'Cart')
    qty      = _extract_booking_field(booking_text, 'Quantity') or '1'
    cart_qty = f'{cart} × {qty}' if qty not in ('', '1') else cart
    pickup   = _extract_booking_field(booking_text, 'Pick-up')
    dropoff  = _extract_booking_field(booking_text, 'Drop-off')
    hotel    = _extract_booking_field(booking_text, 'Hotel')

    delivery_line = ''
    if hotel and hotel.lower() not in ('store pickup', 'none', ''):
        delivery_line = (
            f'\n\n🏨 *El cliente solicita entrega en:* {hotel}\n'
            f'¿Puede entregar en esa dirección? ¿Tiene algún costo adicional?'
        )
    else:
        _pterm = (business or {}).get('settings', {}).get('product_term_es', 'el producto')
        delivery_line = f'\n\n📍 Cliente recogerá {_pterm.lower()} directamente en su local.'

    # Message 1 — availability check (redacted, no contact info)
    msg1 = (
        f'📋 *Nueva solicitud — {(business or {}).get("name", "Okapi")}*\n\n'
        f'📍 Ubicación: {location}\n'
        f'🛒 Carrito: {cart_qty}\n'
        f'📅 {pickup} → {dropoff}'
        f'{delivery_line}\n\n'
        f'¿Tiene disponibilidad para estas fechas?'
    )

    # Message 2 — commission ask
    msg2 = (
        f'💼 *Comisión de servicio:* {commission_pct:.0f}% sobre el total del alquiler.\n\n'
        f'Esto es cobrado por separado al cliente — usted recibe el 100% de su precio.\n\n'
        f'¿Acepta esta comisión? Responda *SÍ* para confirmar, un número para '
        f'contrapropuesta (ej. "8"), o *NO* para rechazar.'
    )

    try:
        get_twilio_client(business).messages.create(from_=sender, to=provider_number, body=msg1)
        get_twilio_client(business).messages.create(from_=sender, to=provider_number, body=msg2)
        print(f'  ✓ Commission negotiation sent to provider ({provider_number})')
        store.add_pending_quote(provider_number, client_phone, booking_text,
                                business_id=bid, commission_pct=commission_pct)
        booking_id = store.get_booking_id_by_provider(provider_number, bid)
        if booking_id:
            store.log_provider_message(booking_id, 'agent', msg1)
            store.log_provider_message(booking_id, 'agent', msg2)
    except Exception as e:
        print(f'  ✗ Failed to notify provider: {e}')

def _send_full_booking_to_provider(provider_number: str, pending: dict,
                                    sender: Optional[str] = None,
                                    business: Optional[dict] = None):
    """After commission accepted, send the full booking details asking for price."""
    booking_text    = pending.get('booking', '')
    redacted        = _redact_contacts(booking_text)
    effective_sender = sender or TWILIO_WA_NUMBER

    hotel = _extract_booking_field(booking_text, 'Hotel')
    delivery_line = (
        f'\n\n🏨 *Entrega en:* {hotel}\n'
        f'¿Puede entregar? ¿Costo adicional de entrega?'
        if hotel and hotel.lower() not in ('store pickup', 'none', '')
        else '\n\n📍 Cliente recogerá en su local.'
    )

    msg = (
        f'✅ *¡Perfecto! Aquí están los detalles completos de la reserva:*\n\n'
        f'{redacted}\n\n'
        f'---\n'
        f'💬 *Por favor indique el precio total del alquiler.*'
        f'{delivery_line}\n\n'
        f'Responda con el precio (ej. "$500" o "80000 colones").'
    )
    try:
        send_whatsapp(provider_number, msg, effective_sender, business)
        print(f'  ✓ Full booking sent to provider {provider_number}')
        booking_id = store.get_booking_id_by_provider(provider_number, pending.get('business_id'))
        if booking_id:
            store.log_provider_message(booking_id, 'agent', msg)
    except Exception as e:
        print(f'  ✗ Could not send full booking: {e}')

def release_contact_info_to_provider(provider_number: str, full_booking: str,
                                      client_phone: str,
                                      sender: Optional[str] = None,
                                      business: Optional[dict] = None):
    effective_sender = sender or TWILIO_WA_NUMBER
    msg = (
        f'✅ *Reserva Confirmada — Pago Recibido*\n\n'
        f'El cliente realizó el pago de la tarifa de reserva. '
        f'Aquí están los detalles completos:\n\n'
        f'{full_booking}\n\n'
        f'📱 WhatsApp del cliente: {client_phone.replace("whatsapp:", "")}\n\n'
        f'Por favor coordine la entrega directamente con el cliente. ¡Gracias! 🏖️'
    )
    try:
        send_whatsapp(provider_number, msg, effective_sender, business)
        print(f'  ✓ Contact info released to provider ({provider_number})')
    except Exception as e:
        print(f'  ✗ Failed to release contact info: {e}')

def human_delay(text: str) -> float:
    """Typing delay proportional to message length, capped at 7s with ±0.4s jitter."""
    base = min(max(len(text) / 50, 1.5), 7.0)
    return base + random.uniform(-0.4, 0.4)

def _get_meta_config(business: Optional[dict] = None) -> tuple[str, str]:
    """Return (access_token, phone_number_id) for Meta Cloud API."""
    biz = business or {}
    token = biz.get('meta_access_token') or META_ACCESS_TOKEN
    phone_id = biz.get('meta_phone_number_id') or META_PHONE_NUMBER_ID
    return token, phone_id

def _is_meta_business(business: Optional[dict] = None) -> bool:
    """True if this business is configured to use Meta Cloud API instead of Twilio."""
    token, phone_id = _get_meta_config(business)
    return bool(token and phone_id)

def _normalize_to_meta(number: str) -> str:
    """Convert whatsapp:+506XXXXXXXX → 506XXXXXXXX (Meta format)."""
    n = number.replace('whatsapp:', '').replace('+', '').strip()
    return n

def _send_meta_message(to: str, body: str, access_token: str, phone_number_id: str,
                       media_url: Optional[str] = None, media_type: str = 'image',
                       media_filename: Optional[str] = None):
    """Send a message via Meta Cloud API."""
    import hmac as _hmac
    url = f'https://graph.facebook.com/v19.0/{phone_number_id}/messages'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }
    recipient = _normalize_to_meta(to)
    if media_url and media_type == 'document':
        payload = {
            'messaging_product': 'whatsapp',
            'to': recipient,
            'type': 'document',
            'document': {'link': media_url, 'filename': media_filename or 'documento.pdf'},
        }
    elif media_url:
        payload = {
            'messaging_product': 'whatsapp',
            'to': recipient,
            'type': 'image',
            'image': {'link': media_url, 'caption': body or ''},
        }
    else:
        payload = {
            'messaging_product': 'whatsapp',
            'to': recipient,
            'type': 'text',
            'text': {'body': body, 'preview_url': False},
        }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
                                  headers={k: v for k, v in headers.items()},
                                  method='POST')
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
        # Return wam_id for status tracking
        try:
            return result.get('messages', [{}])[0].get('id')
        except Exception:
            return None


def send_whatsapp(to: str, body: str, sender: Optional[str] = None,
                  business: Optional[dict] = None, delay: float = 0,
                  media_url: Optional[str] = None, media_type: str = 'image',
                  media_filename: Optional[str] = None) -> Optional[str]:
    """Send a WhatsApp message. Returns wam_id for Meta messages (for status tracking)."""
    if delay > 0:
        time.sleep(delay)
    suffix = f' [{media_type}]' if media_url else ''
    if _is_meta_business(business):
        access_token, phone_number_id = _get_meta_config(business)
        try:
            wam_id = _send_meta_message(to, body, access_token, phone_number_id,
                                        media_url, media_type, media_filename)
            print(f'  → [meta] {to}: {body[:80]}{suffix}', flush=True)
            return wam_id
        except Exception as e:
            print(f'  ✗ Failed to send to {to} via Meta: {e}', flush=True)
            return None
    effective_sender = sender or TWILIO_WA_NUMBER
    try:
        kwargs = dict(from_=effective_sender, to=to, body=body)
        if media_url:
            kwargs['media_url'] = [media_url]
        get_twilio_client(business).messages.create(**kwargs)
        print(f'  → {to}: {body[:80]}{suffix}', flush=True)
    except Exception as e:
        print(f'  ✗ Failed to send to {to}: {e}', flush=True)


def extract_image_markers(text: str, business: Optional[dict] = None) -> tuple[str, list[str]]:
    """Extract [SEND_IMAGE: model] markers from AI reply. Returns (clean_text, [image_urls])."""
    import re
    image_map = store.get_product_images(business.get('id') if business else None)
    urls = []
    def replacer(m):
        key = m.group(1).strip().lower()
        # Try exact match first, then partial
        url = image_map.get(key)
        if not url:
            url = next((v for k, v in image_map.items() if key in k or k in key), None)
        if url:
            urls.append(url)
        return ''
    clean = re.sub(r'\[SEND_IMAGE:\s*([^\]]+)\]', replacer, text).strip()
    return clean, urls

def extract_pdf_markers(text: str, business: Optional[dict] = None) -> tuple[str, list[tuple[str, str]]]:
    """Extract [SEND_PDF: model] markers. Returns (clean_text, [(file_url, filename)])."""
    import re
    pdf_map = store.get_product_pdfs(business.get('id') if business else None)
    pdfs = []
    def replacer(m):
        key = m.group(1).strip().lower()
        entry = pdf_map.get(key)
        if not entry:
            entry = next((v for k, v in pdf_map.items() if key in k or k in key), None)
        if entry:
            pdfs.append(entry)
        return ''
    clean = re.sub(r'\[SEND_PDF:\s*([^\]]+)\]', replacer, text).strip()
    return clean, pdfs


def extract_handoff_marker(text: str) -> tuple[str, bool]:
    """Strip [HANDOFF] from reply. Returns (clean_text, handoff_requested)."""
    handoff = bool(re.search(r'\[HANDOFF\]', text, re.IGNORECASE))
    clean = re.sub(r'\[HANDOFF\]\s*', '', text, flags=re.IGNORECASE).strip()
    return clean, handoff


def alert_admin(message: str, sender: Optional[str] = None):
    if ADMIN_WA:
        send_whatsapp(ADMIN_WA if ADMIN_WA.startswith('whatsapp:') else f'whatsapp:{ADMIN_WA}',
                      message, sender)


def send_email(to: str, subject: str, html: str, from_addr: str = 'Acuarium Agent <notifications@projectokapi.com>') -> bool:
    """Send email via Resend API using requests library."""
    if not RESEND_API_KEY:
        print(f'  ⚠ send_email: RESEND_API_KEY not set — skipping email to {to}', flush=True)
        return False
    try:
        import requests as _req
        resp = _req.post(
            'https://api.resend.com/emails',
            headers={
                'Authorization': f'Bearer {RESEND_API_KEY}',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
            json={'from': from_addr, 'to': [to], 'subject': subject, 'html': html},
            timeout=15,
        )
        if resp.status_code in (200, 201):
            print(f'  ✉ Email sent to {to} ({resp.status_code})', flush=True)
            return True
        print(f'  ⚠ send_email to {to}: HTTP {resp.status_code} | {resp.text[:200]}', flush=True)
        return False
    except Exception as e:
        print(f'  ⚠ send_email to {to}: {e}', flush=True)
        return False

# ─── MAINTENANCE ─────────────────────────────────────────────────────────────

def cleanup_expired_entries(business: Optional[dict] = None):
    bid = business.get('id') if business else None
    store.cleanup_expired_entries(bid, PENDING_TTL_H)

def send_provider_followups(business: Optional[dict] = None,
                             sender: Optional[str] = None):
    """Re-ping providers waiting for price (commission accepted) after 2h."""
    if not is_business_hours(business):
        return

    bid             = business.get('id') if business else None
    effective_sender = sender or TWILIO_WA_NUMBER
    stale           = store.get_stale_provider_quotes(bid, hours=2)

    for provider_num, quote in stale.items():
        if quote.get('follow_up_sent'):
            continue

        store.mark_provider_followup_sent(provider_num, bid)

        try:
            send_whatsapp(provider_num,
                          '🔔 *Recordatorio — Solicitud de Reserva Pendiente*\n\n'
                          'Aún esperamos su cotización de precio. '
                          'Por favor responda lo antes posible. ¡Gracias!',
                          effective_sender, business)
            print(f'  ↺ Follow-up sent to provider {provider_num}')
        except Exception as e:
            print(f'  ✗ Provider follow-up failed: {e}')

        client_phone = quote.get('client', '')
        if client_phone:
            lang = detect_client_language(client_phone, business)
            msg  = (
                '⏳ Seguimos esperando confirmación del proveedor local. '
                'Te avisamos en cuanto tengamos respuesta. ¡Gracias por tu paciencia! 🙏'
            ) if lang == 'es' else (
                '⏳ We\'re still waiting for the local provider to confirm. '
                'We\'ll notify you as soon as we hear back. Thanks for your patience! 🙏'
            )
            try:
                send_whatsapp(client_phone, msg, effective_sender, business)
                store.append_message(client_phone, 'assistant', msg, bid)
                print(f'  ↺ Follow-up sent to client {client_phone}')
            except Exception as e:
                print(f'  ✗ Client follow-up failed: {e}')

def send_cold_lead_followups(business: Optional[dict] = None, sender: Optional[str] = None):
    """Nudge leads that have gone cold after 24h."""
    if not is_business_hours(business):
        return

    bid              = business.get('id') if business else None
    effective_sender = sender or TWILIO_WA_NUMBER
    biz_settings     = (business or {}).get('settings', {})
    follow_up_hours  = int(biz_settings.get('follow_up_hours', 24))

    cold_leads = store.get_cold_leads(bid, follow_up_hours)
    for lead in cold_leads:
        phone = lead.get('phone', '')
        if not phone:
            continue
        lang    = detect_client_language(phone, business)
        msg_es  = biz_settings.get('follow_up_message_es', '¡Hola! ¿Seguís interesado? 🙂')
        msg_en  = biz_settings.get('follow_up_message_en', 'Hey! Just checking in — still interested? 🙂')
        msg     = msg_es if lang == 'es' else msg_en
        try:
            send_whatsapp(phone, msg, effective_sender, business)
            store.mark_follow_up_sent(phone, bid)
            print(f'  ↺ Cold lead follow-up sent to {phone}')
        except Exception as e:
            print(f'  ✗ Cold lead follow-up failed for {phone}: {e}')

    # Mark as lost if they didn't respond after 48h total
    overdue = store.get_overdue_lost_leads(bid, hours=48)
    for lead in overdue:
        store.update_lead_status(lead['phone'], 'lost', bid)
        print(f'  📭 Marked {lead["phone"]} as lost')

def handle_provider_timeout(business: Optional[dict] = None, sender: Optional[str] = None):
    """Try next provider or alert admin if provider hasn't responded in 4h."""
    bid             = business.get('id') if business else None
    effective_sender = sender or TWILIO_WA_NUMBER
    biz_settings    = (business or {}).get('settings', {})
    timeout_hours   = int(biz_settings.get('provider_timeout_hours', 4))

    timed_out = store.get_timed_out_providers(bid, timeout_hours)
    for booking_row in timed_out:
        provider_num  = booking_row.get('provider_number', '')
        booking_text  = booking_row.get('booking_text', '')
        client_phone  = booking_row.get('client_phone', '')
        location      = _extract_booking_field(booking_text, 'Location')

        # Try next provider
        next_prov = store.get_next_provider(location, provider_num, bid)
        if next_prov:
            print(f'  🔄 Timeout on {provider_num} — trying {next_prov}')
            # Cancel old booking, create new one
            store.clear_pending_quote(provider_num, bid)
            notify_provider(booking_text, client_phone, business, effective_sender)
        else:
            # Alert admin
            store.mark_provider_followup_sent(provider_num, bid)
            alert_admin(
                f'⚠️ *Provider Timeout*\n\n'
                f'Provider {provider_num} has not responded after {timeout_hours}h.\n'
                f'Location: {location}\nClient: {client_phone}\n\n'
                f'No backup provider available. Please follow up manually.',
                effective_sender
            )
            print(f'  ⚠ Provider timeout — no backup, alerted admin')

# ─── CANCELLATION HELPERS ────────────────────────────────────────────────────

def _handle_cancel_request(client_phone: str, lang: str, raw_body: str,
                            business: Optional[dict] = None,
                            sender: Optional[str] = None):
    es  = (lang == 'es')
    bid = business.get('id') if business else None
    store.append_message(client_phone, 'user', raw_body, bid)

    # Case 1 — pending quote only (no payment)
    prov_num, pq = store.get_pending_quote_for_client(client_phone, bid)
    if pq and not pq.get('link_sent'):
        store.clear_pending_quote(prov_num, bid)
        msg = ('✅ Consulta cancelada. No se realizó ningún cargo. '
               '¡Escríbenos cuando quieras hacer otra reserva! 🏖️'
               if es else
               '✅ Booking request cancelled. No charge was made. '
               'Feel free to reach out whenever you\'d like to book! 🏖️')
        send_whatsapp(client_phone, msg, sender)
        store.append_message(client_phone, 'assistant', msg, bid)
        return

    # Case 2 — payment link sent but not paid
    all_payments = store.get_all_pending_payments(bid)
    for order, p in all_payments.items():
        if p.get('client') == client_phone and not p.get('processed'):
            store.clear_pending_payment(order, bid)
            if p.get('provider'):
                store.clear_pending_quote(p['provider'], bid)
            msg = ('✅ Enlace de pago cancelado. No se realizó ningún cargo. '
                   '¡Escríbenos cuando quieras reservar! 🏖️'
                   if es else
                   '✅ Payment link cancelled. No charge was made. '
                   'Reach out anytime you\'d like to book! 🏖️')
            send_whatsapp(client_phone, msg, sender)
            store.append_message(client_phone, 'assistant', msg, bid)
            return

    # Case 3 — confirmed booking (payment made)
    cb = store.get_confirmed_booking(client_phone, bid)
    if cb:
        booking_text = cb.get('booking', '')
        fee_paid     = cb.get('fee_paid', 0)
        location     = _extract_booking_field(booking_text, 'Location')
        pickup       = _extract_booking_field(booking_text, 'Pick-up')
        dropoff      = _extract_booking_field(booking_text, 'Drop-off')
        cart         = _extract_booking_field(booking_text, 'Cart')
        fee_disp     = f'${fee_paid:.2f}'

        store.add_pending_cancellation(client_phone, 'confirmed',
                                       cb['provider'], booking_text, cb['order'], bid)
        if es:
            msg = (f'⚠️ *Solicitud de cancelación*\n\n'
                   f'Encontramos tu reserva activa:\n'
                   f'📍 {location}  |  🛒 {cart}\n'
                   f'📅 {pickup} → {dropoff}\n\n'
                   f'📌 *Política de cancelación:*\n'
                   f'• Cancelación gratuita con más de 24 horas de anticipación\n'
                   f'• El cargo de reserva de *{fee_disp}* _no es reembolsable_\n\n'
                   f'¿Confirmas la cancelación?\n'
                   f'Responde *SÍ, CANCELAR* para proceder o *NO* para mantener tu reserva.')
        else:
            msg = (f'⚠️ *Cancellation Request*\n\n'
                   f'We found your active booking:\n'
                   f'📍 {location}  |  🛒 {cart}\n'
                   f'📅 {pickup} → {dropoff}\n\n'
                   f'📌 *Cancellation policy:*\n'
                   f'• Free cancellation with more than 24 hours notice\n'
                   f'• The *{fee_disp}* booking fee is _non-refundable_\n\n'
                   f'Do you want to confirm the cancellation?\n'
                   f'Reply *YES, CANCEL* to proceed or *NO* to keep your booking.')
        send_whatsapp(client_phone, msg, sender)
        store.append_message(client_phone, 'assistant', msg, bid)
        return

    msg = ('No encontramos ninguna reserva activa para tu número. '
           '¿Puedo ayudarte con algo más? 🏖️'
           if es else
           'We couldn\'t find an active booking for your number. '
           'Can I help you with anything else? 🏖️')
    send_whatsapp(client_phone, msg, sender)
    store.append_message(client_phone, 'assistant', msg, bid)


def _execute_cancellation(client_phone: str, pc: dict,
                           business: Optional[dict] = None,
                           sender: Optional[str] = None):
    lang         = detect_client_language(client_phone, business)
    es           = (lang == 'es')
    bid          = business.get('id') if business else None
    provider_num = pc.get('provider', '')
    booking_text = pc.get('booking', '')
    order        = pc.get('order', '')

    if provider_num:
        location = _extract_booking_field(booking_text, 'Location')
        pickup   = _extract_booking_field(booking_text, 'Pick-up')
        try:
            send_whatsapp(provider_num,
                          f'❌ *Reserva Cancelada — {(business or {}).get("name", "Okapi")}*\n\n'
                          f'El cliente ha cancelado la reserva:\n'
                          f'📍 {location}  |  📅 {pickup}\n\n'
                          f'No es necesario ningún otro paso de su parte. ¡Gracias!',
                          sender, business)
        except Exception as e:
            print(f'  ✗ Could not notify provider of cancellation: {e}')

    store.clear_pending_cancellation(client_phone, bid)
    store.clear_confirmed_booking(client_phone, bid)
    if provider_num:
        store.clear_pending_quote(provider_num, bid)
    if order:
        store.clear_pending_payment(order, bid)

    if es:
        msg = ('✅ *Reserva cancelada.*\n\n'
               'El proveedor ha sido notificado. Recuerda que el cargo de reserva '
               'no es reembolsable.\n\n'
               'Si necesitas hacer una nueva reserva, estamos aquí. 🏖️')
    else:
        msg = ('✅ *Booking cancelled.*\n\n'
               'The provider has been notified. Please note the booking fee '
               'is non-refundable.\n\n'
               "If you'd like to make a new booking, we're here to help. 🏖️")

    send_whatsapp(client_phone, msg, sender)
    store.append_message(client_phone, 'assistant', msg, bid)
    print(f'  ✓ Cancellation complete for {client_phone}')

# ─── COMMISSION NEGOTIATION HELPERS ──────────────────────────────────────────

_COMMISSION_ACCEPT = {
    'sí', 'si', 'yes', 'ok', 'de acuerdo', 'acepto', 'aceptado',
    'claro', 'confirmo', 'confirmed', 'acepta', 'perfecto', 'listo',
}
# Words that indicate acceptance even inside longer sentences
_COMMISSION_ACCEPT_WORDS = {'sí', 'si', 'yes', 'ok', 'acepto', 'aceptado',
                             'claro', 'confirmo', 'acepta', 'perfecto',
                             'disponible', 'disponibilidad', 'tengo', 'puedo',
                             'accepted', 'agree'}

def _is_commission_accept(text: str) -> bool:
    if text in _COMMISSION_ACCEPT:
        return True
    words = set(re.split(r'\W+', text.lower()))
    return bool(words & _COMMISSION_ACCEPT_WORDS)

def _is_counter_offer(text: str) -> Optional[float]:
    """Return numeric counter-offer pct if text looks like one, else None."""
    cleaned = text.strip().replace('%', '').replace(',', '.').strip()
    try:
        val = float(cleaned)
        if 1 <= val <= 50:
            return val
    except ValueError:
        pass
    # "8%", "7.5", etc. embedded in text
    m = re.search(r'\b(\d+(?:\.\d+)?)\s*%?\b', text)
    if m:
        try:
            val = float(m.group(1))
            if 1 <= val <= 50:
                return val
        except ValueError:
            pass
    return None

# ─── CORE INBOUND MESSAGE HANDLER ────────────────────────────────────────────

_RESET_TRIGGERS = {
    'restart', 'reset', 'start over', 'empezar de nuevo',
    'reiniciar', '/restart', '/reset', '/start', '/nuevo',
}
_CANCEL_INTENTS = {
    'cancelar', 'cancelar reserva', 'cancelar mi reserva', 'quiero cancelar',
    'quisiera cancelar', 'necesito cancelar', 'cancelación', 'cancelacion',
    'cancel', 'cancel booking', 'cancel my booking', 'cancel reservation',
    'i want to cancel', '/cancel', '/cancelar',
}
_CANCEL_CONFIRM = {
    'sí, cancelar', 'si, cancelar', 'sí cancelar', 'si cancelar',
    'confirmar cancelación', 'confirmar cancelacion',
    'yes, cancel', 'yes cancel', 'cancel confirmed',
}
_CANCEL_DENY = {
    'no', 'no cancelar', 'mantener', 'keep', 'keep booking',
    'mantener reserva', 'no quiero cancelar',
}


def _trigger_business_line_routing(phone: str, last_msg: str, bid: Optional[str],
                                    business: Optional[dict], sender: Optional[str]) -> None:
    """Classify conversation into a business line and notify assigned users (background thread)."""
    import threading

    def _run():
        try:
            configs = store.get_business_line_configs(bid)
            if not configs:
                return  # Feature not configured for this business
            current = store.get_conversation_business_line(phone, bid)
            if current:
                return  # Already classified
            history = store.get_history(phone, bid)
            if len(history) < 2:
                return  # Need at least one exchange before classifying
            line = classify_business_line(business, history, configs)
            if not line:
                return
            store.set_conversation_business_line(phone, bid, line)

            # Auto-assign team based on lead zone + user based on business line
            lead = store.get_lead_by_phone(phone, bid)
            lead_zone = (lead or {}).get('zone') or ''
            users = store.get_users_by_business_line(bid or '', line)

            # Pick first user with an id for assignment (UUID FK)
            primary_user = next((u for u in users if u.get('id')), None)
            assigned_user_id = primary_user['id'] if primary_user else None
            assigned_name = primary_user.get('name') if primary_user else None

            team_id = None
            if lead_zone and bid:
                team = store.get_team_by_zone(bid, lead_zone)
                if team:
                    team_id = team['id']
                    print(f'  📋 Team: {team["name"]} (zone: {lead_zone})', flush=True)

            store.assign_conversation(phone, bid, assigned_user_id=assigned_user_id, team_id=team_id)
            if assigned_name:
                print(f'  👤 Assigned to: {assigned_name} ({assigned_user_id}) → {line}', flush=True)

            client_name = (lead or {}).get('name') or phone.replace('whatsapp:', '')
            biz_slug = (business or {}).get('slug', 'agent')
            panel_url = f'https://agent.{biz_slug}.com/conversations'
            for u in users:
                pref = (u.get('notification_pref') or 'none').lower()
                notif_text = (
                    f'🔔 *Nuevo lead — {line}*\n\n'
                    f'Cliente: {client_name}\n'
                    f'Mensaje: {last_msg[:120]}'
                )
                if pref == 'whatsapp':
                    u_phone = (u.get('phone') or '').strip()
                    if u_phone:
                        if not u_phone.startswith('+'):
                            u_phone = f'+{u_phone}'
                        send_whatsapp(u_phone, notif_text, sender, business)
                        print(f'  📣 [WA] Notified {u.get("name")} ({u_phone}) → {line}', flush=True)
                elif pref == 'email':
                    u_email = (u.get('email') or '').strip()
                    if u_email:
                        lead_id = (lead or {}).get('id') or ''
                        biz_slug = (business or {}).get('slug', 'agent')
                        conv_url = f'https://agent.{biz_slug}.com/conversations'
                        lead_url = f'https://agent.{biz_slug}.com/leads/{lead_id}' if lead_id else conv_url
                        zone_str = (lead or {}).get('zone') or '—'
                        html = (
                            f'<div style="font-family:sans-serif;max-width:520px;color:#111">'
                            f'<p style="margin:0 0 16px">Hola {u.get("name", "")}.</p>'
                            f'<p style="margin:0 0 16px">Nuevo lead detectado en la línea <strong style="color:#7c3aed">{line}</strong>.</p>'
                            f'<table style="border-collapse:collapse;font-size:14px;width:100%;margin-bottom:20px">'
                            f'<tr style="border-bottom:1px solid #eee"><td style="padding:8px 16px 8px 0;color:#666;white-space:nowrap">Cliente</td><td style="padding:8px 0"><strong>{client_name}</strong></td></tr>'
                            f'<tr style="border-bottom:1px solid #eee"><td style="padding:8px 16px 8px 0;color:#666">Teléfono</td><td style="padding:8px 0">{phone.replace("whatsapp:","")}</td></tr>'
                            f'<tr style="border-bottom:1px solid #eee"><td style="padding:8px 16px 8px 0;color:#666">Zona</td><td style="padding:8px 0">{zone_str}</td></tr>'
                            f'<tr><td style="padding:8px 16px 8px 0;color:#666;vertical-align:top">Mensaje</td><td style="padding:8px 0;color:#444">{last_msg[:200]}</td></tr>'
                            f'</table>'
                            f'<div style="display:flex;gap:10px">'
                            f'<a href="{conv_url}" style="background:#7c3aed;color:#fff;padding:9px 18px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600">Ver conversación →</a>'
                            f'<a href="{lead_url}" style="background:#f3f0ff;color:#7c3aed;padding:9px 18px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600;border:1px solid #ddd6fe">Ver ficha del lead →</a>'
                            f'</div>'
                            f'</div>'
                        )
                        send_email(u_email, f'🔔 Nuevo lead — {line} ({client_name})', html)
                        print(f'  📣 [email] Notified {u.get("name")} ({u_email}) → {line}', flush=True)
        except Exception as e:
            print(f'  ⚠ _trigger_business_line_routing: {e}', flush=True)

    threading.Thread(target=_run, daemon=True).start()


def _trigger_lead_enrichment(phone: str, bid: Optional[str]) -> None:
    """Extract contact info from conversation and fill null lead fields (background thread)."""
    import threading, json, re

    def _run():
        try:
            history = store.get_history(phone, bid)
            # Only customer messages, recent ones
            customer_msgs = [
                m['content'][:400] for m in history[-12:]
                if m.get('role') == 'user' and m.get('content')
            ]
            if not customer_msgs:
                return

            conv_text = '\n'.join(customer_msgs)

            r = claude_client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=150,
                messages=[{
                    'role': 'user',
                    'content': (
                        'Extrae información de contacto de estos mensajes de WhatsApp.\n'
                        'Responde SOLO con JSON válido. Usa null si no se menciona.\n'
                        'Solo incluye lo que el cliente diga EXPLÍCITAMENTE.\n\n'
                        'Formato exacto:\n'
                        '{"name":null,"last_name":null,"email":null,"company":null,"zone":null}\n\n'
                        f'Mensajes:\n{conv_text}'
                    ),
                }],
            )
            text = r.content[0].text.strip()
            match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
            if not match:
                return
            data = json.loads(match.group())
            extracted = {k: v for k, v in data.items() if v and isinstance(v, str)}
            if extracted:
                store.enrich_lead(phone, bid, extracted)
        except Exception as e:
            print(f'  ⚠ _trigger_lead_enrichment: {e}', flush=True)

    threading.Thread(target=_run, daemon=True).start()


# ─── MEDAGENT ────────────────────────────────────────────────────────────────

def _get_available_slots(doctor_id: str, date_str: str, duration: int, business_id: str) -> list[str]:
    """Return list of HH:MM available slots for a doctor on a given date."""
    from datetime import date as _date, time as _time, timedelta as _td
    try:
        d = _date.fromisoformat(date_str)
        dow = d.weekday() + 1  # Mon=1..Sun=0 (our table: 0=Sun,1=Mon)
        if dow == 7: dow = 0
        schedule = store.get_doctor_schedule(doctor_id)
        day_row = next((s for s in schedule if s['day_of_week'] == dow), None)
        if not day_row:
            return []
        start = _time.fromisoformat(day_row['start_time'][:5])
        end   = _time.fromisoformat(day_row['end_time'][:5])
        booked = store.get_appointments_for_doctor(doctor_id, date_str)
        booked_ranges = [
            (_time.fromisoformat(a['start_time'][:5]), _time.fromisoformat(a['end_time'][:5]))
            for a in booked
        ]
        slots, cur = [], datetime.combine(d, start)
        end_dt = datetime.combine(d, end)
        step = _td(minutes=duration)
        while cur + step <= end_dt:
            s = cur.time()
            e = (cur + step).time()
            if not any(s < be and e > bs for bs, be in booked_ranges):
                slots.append(s.strftime('%H:%M'))
            cur += step
        return slots
    except Exception as ex:
        print(f'  ⚠ _get_available_slots: {ex}')
        return []

def _build_medical_context(phone: str, business: dict) -> str:
    """Build context block injected into system prompt for medical businesses."""
    bid = business.get('id')
    clean = phone.replace('whatsapp:', '').strip()
    patient = store.get_or_create_patient(clean, bid)
    doctors = store.get_doctors(bid)

    lines = ['\n\n## Contexto médico']

    # Patient info
    if patient:
        if patient.get('name'):
            lines.append(f"Paciente conocido: {patient['name']} (teléfono: {clean}). No le pidas el nombre de nuevo.")
        else:
            lines.append(f"Paciente nuevo — teléfono: {clean}. Necesitás pedir su nombre.")
        if patient.get('notes'):
            lines.append(f"Notas internas: {patient['notes']}")
        upcoming = store.get_upcoming_appointments(patient['id'])
        if upcoming:
            up_lines = []
            for a in upcoming:
                loc = (a.get('doctor_locations') or {}).get('name', '')
                loc_str = f' en {loc}' if loc else ''
                up_lines.append(f"  - {a['date']} {a['start_time'][:5]} con {(a.get('doctors') or {}).get('name','?')}{loc_str} (ID: {a['id']}, estado: {a['status']})")
            lines.append("Próximas citas:\n" + '\n'.join(up_lines))
        past = store.get_patient_appointments(patient['id'])
        if past:
            appt_lines = [f"  - {a['date']} {a['start_time'][:5]} con {(a.get('doctors') or {}).get('name','?')} ({a['status']})" for a in past]
            lines.append("Citas anteriores:\n" + '\n'.join(appt_lines))

    # Doctors and services
    if doctors:
        lines.append('\nDoctores disponibles:')
        for doc in doctors:
            svcs = [s for s in (doc.get('med_services') or []) if s.get('active')]
            svc_str = ', '.join(f"{s['name']} ({s['duration_minutes']} min)" for s in svcs) or 'sin servicios definidos'
            spec = f" — {doc['specialty']}" if doc.get('specialty') else ''
            locs = store.get_doctor_locations(doc['id'])
            if locs:
                loc_str = ', '.join(f"{l['name']}" + (f" ({l['address']})" if l.get('address') else '') for l in locs)
            else:
                loc_str = 'sin consultorio definido'
            lines.append(f"  • {doc['name']}{spec} | ID: {doc['id']} | Servicios: {svc_str} | Consultorios: {loc_str}")

    lines.append('\nPara consultar slots disponibles en una fecha: el sistema te los provee si los pedís con [CHECK_SLOTS: doctor_id=xxx|date=YYYY-MM-DD|duration=30]')
    lines.append('Para confirmar una cita: usá [BOOK_APPOINTMENT: doctor_id=xxx|service_id=xxx|date=YYYY-MM-DD|time=HH:MM|name=Nombre Paciente|note=motivo]')
    lines.append('Para compartir el link de reserva online de un doctor: usá [BOOKING_LINK: doctor_id=xxx] — el sistema lo reemplaza con la URL real.')
    lines.append('Para cancelar la próxima cita del paciente (solo con su confirmación explícita): usá [CANCEL_APPOINTMENT: appointment_id=xxx]')
    lines.append('Para reagendar: primero verificá disponibilidad con [CHECK_SLOTS], confirmá el nuevo horario con el paciente, luego usá [RESCHEDULE_APPOINTMENT: appointment_id=xxx|date=YYYY-MM-DD|time=HH:MM]')
    lines.append('Nunca inventes un horario disponible — siempre verificá con [CHECK_SLOTS] antes de ofrecer un slot.')
    lines.append('Nunca canceles ni reagendes sin confirmación explícita del paciente.')

    return '\n'.join(lines)

def _parse_medical_marker(reply: str, marker: str) -> Optional[dict]:
    """Extract key=value pairs from [MARKER: key=val|key2=val2] pattern."""
    m = re.search(rf'\[{marker}:\s*([^\]]+)\]', reply)
    if not m:
        return None
    try:
        return dict(pair.split('=', 1) for pair in m.group(1).split('|') if '=' in pair)
    except Exception:
        return None

def _handle_medical_reply(reply: str, phone: str, business: dict) -> str:
    """Process CHECK_SLOTS, BOOK_APPOINTMENT and BOOKING_LINK markers from Claude's reply."""
    bid = business.get('id')
    clean = phone.replace('whatsapp:', '').strip()

    # BOOKING_LINK — replace with the actual public booking URL for that doctor
    link_params = _parse_medical_marker(reply, 'BOOKING_LINK')
    if link_params:
        doctor_id  = link_params.get('doctor_id', '')
        marker_str = re.search(r'\[BOOKING_LINK:[^\]]+\]', reply).group(0)
        panel_url  = (business.get('panel_url') or PANEL_BASE_URL or '').rstrip('/')
        slug       = business.get('slug', '')
        if panel_url and slug and doctor_id:
            booking_url = f'{panel_url}/book/{slug}/{doctor_id}'
        else:
            booking_url = ''
        reply = reply.replace(marker_str, booking_url)

    # CHECK_SLOTS
    slots_params = _parse_medical_marker(reply, 'CHECK_SLOTS')
    if slots_params:
        doctor_id = slots_params.get('doctor_id', '')
        date_str  = slots_params.get('date', '')
        duration  = int(slots_params.get('duration', 30))
        slots = _get_available_slots(doctor_id, date_str, duration, bid)
        marker_str = re.search(r'\[CHECK_SLOTS:[^\]]+\]', reply).group(0)
        if slots:
            slots_text = ', '.join(slots[:8])  # max 8 slots
            return reply.replace(marker_str, f'[slots disponibles: {slots_text}]')
        else:
            return reply.replace(marker_str, '[no hay slots disponibles para esa fecha]')

    # BOOK_APPOINTMENT
    book_params = _parse_medical_marker(reply, 'BOOK_APPOINTMENT')
    if book_params:
        doctor_id  = book_params.get('doctor_id', '')
        service_id = book_params.get('service_id') or None
        date_str   = book_params.get('date', '')
        time_str   = book_params.get('time', '')
        name       = book_params.get('name', '')
        note       = book_params.get('note', '')
        marker_str = re.search(r'\[BOOK_APPOINTMENT:[^\]]+\]', reply).group(0)

        patient = store.get_or_create_patient(clean, bid)
        if patient and name and not patient.get('name'):
            store.update_patient(patient['id'], {'name': name})
            patient['name'] = name

        if not (doctor_id and date_str and time_str and patient):
            return reply.replace(marker_str, '')

        # Compute end_time from service duration (default 30 min)
        try:
            from datetime import time as _t, timedelta as _td
            doctors = store.get_doctors(bid)
            doc = next((d for d in doctors if d['id'] == doctor_id), None)
            duration = 30
            if doc and service_id:
                svc = next((s for s in (doc.get('med_services') or []) if s['id'] == service_id), None)
                if svc:
                    duration = svc.get('duration_minutes', 30)
            start = _t.fromisoformat(time_str)
            from datetime import datetime as _dt
            end_dt = (_dt.combine(_dt.today(), start) + _td(minutes=duration)).time()
            end_str = end_dt.strftime('%H:%M')
        except Exception:
            end_str = time_str

        appt = store.create_appointment({
            'business_id': bid,
            'patient_id':  patient['id'],
            'doctor_id':   doctor_id,
            'service_id':  service_id,
            'date':        date_str,
            'start_time':  time_str,
            'end_time':    end_str,
            'status':      'confirmed',
            'patient_note': note,
            'confirmed_at': datetime.now(timezone.utc).isoformat(),
        })
        if appt:
            print(f'  📅 Appointment booked: {date_str} {time_str} doctor={doctor_id} patient={patient["id"]}')
            return reply.replace(marker_str, '')
        else:
            return reply.replace(marker_str, '')

    # CANCEL_APPOINTMENT
    cancel_params = _parse_medical_marker(reply, 'CANCEL_APPOINTMENT')
    if cancel_params:
        appointment_id = cancel_params.get('appointment_id', '')
        marker_str = re.search(r'\[CANCEL_APPOINTMENT:[^\]]+\]', reply).group(0)
        if appointment_id and store.cancel_appointment(appointment_id, bid):
            print(f'  ❌ Appointment cancelled: {appointment_id[:8]}…')
            return reply.replace(marker_str, '')
        return reply.replace(marker_str, '')

    # RESCHEDULE_APPOINTMENT
    reschedule_params = _parse_medical_marker(reply, 'RESCHEDULE_APPOINTMENT')
    if reschedule_params:
        appointment_id = reschedule_params.get('appointment_id', '')
        new_date       = reschedule_params.get('date', '')
        new_time       = reschedule_params.get('time', '')
        marker_str     = re.search(r'\[RESCHEDULE_APPOINTMENT:[^\]]+\]', reply).group(0)
        if appointment_id and new_date and new_time and store.reschedule_appointment(appointment_id, new_date, new_time, bid):
            print(f'  🔄 Appointment rescheduled: {appointment_id[:8]}… → {new_date} {new_time}')
            return reply.replace(marker_str, '')
        return reply.replace(marker_str, '')

    return reply


def handle_inbound(from_number: str, body: str,
                   business: Optional[dict] = None,
                   referral: Optional[dict] = None,
                   append_reply: bool = True) -> str:
    """
    Core message router. Returns the TwiML response body string.
    Works for any business registered in the platform.
    referral: dict with Twilio referral fields (from Click-to-WhatsApp ads).
    """
    bid     = business.get('id') if business else None
    sender  = (business or {}).get('twilio_sender', TWILIO_WA_NUMBER)

    # Detect product interest from ad referral data (Facebook/Instagram Click-to-WhatsApp)
    ad_product_interest: Optional[str] = None
    if referral and referral.get('source_type') == 'AD':
        headline   = referral.get('headline', '')
        source_url = referral.get('source_url', '')
        ad_product_interest = detect_product_interest(bid, headline, source_url, body)
        if ad_product_interest:
            print(f'  📢 Ad referral → product: {ad_product_interest} (headline: {headline[:60]})')

    # ── Is this a provider? (only for businesses with provider_flow module) ───
    _modules          = (business or {}).get('modules', {})
    _provider_enabled = _modules.get('provider_flow', {}).get('enabled', False)
    provider_location = get_provider_location(from_number, business) if _provider_enabled else None
    if provider_location:
        # Auto-verify: provider wrote to us → WhatsApp window is open
        store.mark_provider_verified(from_number, bid)

        pending = store.get_pending_quote(from_number, bid)
        if pending:
            booking_id = store.get_booking_id_by_provider(from_number, bid)
            # Log provider's inbound message
            if booking_id:
                store.log_provider_message(booking_id, 'provider', body)

            if pending.get('link_sent'):
                return '✅ Recibido. Ya enviamos el enlace al cliente. Esperando su pago.'

            commission_status = pending.get('commission_status', 'accepted')
            body_lower        = body.lower().strip()

            # ── Commission negotiation phase ──────────────────────────────────
            if commission_status == 'pending':
                counter = _is_counter_offer(body_lower)

                if _is_commission_accept(body_lower) and counter is None:
                    # Provider accepted commission
                    pct = pending.get('commission_pct', 10.0)
                    store.update_commission_status(from_number, 'accepted',
                                                   final_pct=pct, business_id=bid)
                    _send_full_booking_to_provider(from_number, pending, sender, business)
                    return '✅ Comisión aceptada. Le enviamos los detalles de la reserva.'

                elif counter is not None and 'no' not in re.split(r'\W+', body_lower):
                    # Counter-offer
                    store.update_commission_status(from_number, 'countered',
                                                   counter_offer=counter, business_id=bid)
                    base_pct = pending.get('commission_pct', 10.0)
                    auto_pct = float((business or {}).get('auto_accept_counter_within_pct', 2.0))

                    if counter >= base_pct - auto_pct:
                        # Auto-accept (within tolerance)
                        store.update_commission_status(from_number, 'accepted',
                                                       final_pct=counter, business_id=bid)
                        _send_full_booking_to_provider(from_number, pending, sender, business)
                        return f'✅ Contrapropuesta de {counter:.0f}% aceptada automáticamente.'
                    else:
                        # Alert admin + create notification
                        alert_admin(
                            f'💼 *Counter-offer from provider*\n\n'
                            f'Provider: {from_number}\n'
                            f'Location: {provider_location}\n'
                            f'Our rate: {base_pct:.0f}%  |  Counter: {counter:.0f}%\n\n'
                            f'Reply in CRM to approve or reject.',
                            sender
                        )
                        store.create_notification(
                            bid, 'counter_offer',
                            f'Counter-offer: {provider_location}',
                            f'Provider offered {counter:.0f}% (we asked {base_pct:.0f}%). Needs approval.',
                            booking_id=booking_id
                        )
                        return f'✅ Recibimos tu contrapropuesta de {counter:.0f}%. Te respondemos pronto.'

                else:
                    # Rejected
                    store.update_commission_status(from_number, 'rejected', business_id=bid)
                    location  = _extract_booking_field(pending.get('booking', ''), 'Location')
                    next_prov = store.get_next_provider(location, from_number, bid)
                    if next_prov:
                        store.clear_pending_quote(from_number, bid)
                        notify_provider(pending['booking'], pending['client'], business, sender)
                        print(f'  🔄 Commission rejected — trying next provider {next_prov}')
                        return '✅ Entendido. Gracias.'
                    else:
                        alert_admin(
                            f'⚠️ *Commission Rejected*\n\n'
                            f'Provider {from_number} rejected commission.\n'
                            f'Location: {location}\nNo backup provider available.',
                            sender
                        )
                        store.create_notification(
                            bid, 'no_provider',
                            f'No provider available: {location}',
                            f'Provider {from_number} rejected commission. No backup available.',
                            booking_id=booking_id,
                            lead_phone=pending.get('client')
                        )
                        return '✅ Entendido. Gracias por responder.'

            # ── Price quote phase (commission already accepted) ───────────────
            else:
                client_phone = pending['client']
                booking_text = pending['booking']
                lang         = detect_client_language(client_phone, business)
                commission_pct = pending.get('commission_pct', 10.0)

                # Gate: if message has no valid price number, ask provider to send price
                pickup  = _extract_booking_field(booking_text, 'Pick-up')
                dropoff = _extract_booking_field(booking_text, 'Drop-off')
                avail, price_check, _ = _extract_price(body, pickup, dropoff)
                if not avail or not price_check:
                    ask_price_msg = (
                        '💬 Por favor indique el *precio total* del alquiler.\n\n'
                        'Ejemplo: "$500" o "150.000 colones"\n\n'
                        '_De preferencia en dólares (USD)._'
                    )
                    send_whatsapp(from_number, ask_price_msg, sender)
                    if booking_id:
                        store.log_provider_message(booking_id, 'agent', ask_price_msg)
                    print(f'  ↩ Provider ({provider_location}): no price detected — asked for price')
                    return '✅ Esperando precio del proveedor.'

                print(f'  ↩ Provider reply ({provider_location}) → client {client_phone} [{lang}]')

                client_msg = relay_quote_to_client(body, booking_text,
                                                   client_phone, from_number,
                                                   language=lang,
                                                   commission_pct=commission_pct,
                                                   business=business)
                send_whatsapp(client_phone, client_msg, sender)
                store.append_message(client_phone, 'assistant', client_msg, bid)
                store.mark_quote_link_sent(from_number, bid)
                # Notify dashboard that provider sent a price
                store.create_notification(
                    bid, 'provider_quoted',
                    f'Provider sent price: {provider_location}',
                    f'Price quote received and forwarded to client {client_phone}.',
                    booking_id=booking_id,
                    lead_phone=client_phone
                )
                return '✅ Recibido. Ya notificamos al cliente.'
        else:
            return '✅ Mensaje recibido. No hay reservas pendientes para este número.'

    # ── Regular client message ────────────────────────────────────────────────

    # Mark follow-up as responded if applicable
    lead = store.get_lead_by_phone(from_number.replace('whatsapp:', ''), bid) or \
           store.get_lead_by_phone(from_number, bid)
    if lead and lead.get('follow_up_sent_at') and not lead.get('follow_up_responded'):
        store.mark_follow_up_responded(from_number.replace('whatsapp:', ''), bid)

    # Conversation reset
    if body.lower().strip() in _RESET_TRIGGERS:
        store.clear_history(from_number, bid)
        is_es       = any(w in body.lower() for w in ['reiniciar', 'nuevo', 'nueva', 'empezar'])
        _settings   = (business or {}).get('settings', {})
        reply_es    = _settings.get('reset_message_es', '¡Claro! Empezamos de nuevo. 😊 ¿En qué podemos ayudarte?')
        reply_en    = _settings.get('reset_message_en', "Sure, let's start fresh! 😊 How can I help you?")
        return reply_es if is_es else reply_en

    _body_lower = body.lower().strip()

    # Medical reminder YES/NO response (before cancellation flow, after reset)
    _biz_modules = (business or {}).get('modules', {})
    if _biz_modules.get('reminders', {}).get('enabled') and _biz_modules.get('medical', {}).get('enabled'):
        _reminder_reply = _handle_medical_reminder_response(_body_lower, from_number, business)
        if _reminder_reply:
            store.append_message(from_number, 'user', body, bid)
            send_whatsapp(from_number, _reminder_reply, sender)
            store.append_message(from_number, 'assistant', _reminder_reply, bid)
            return ''

    # Cancellation flow — Step A: confirm pending cancellation
    if _body_lower in _CANCEL_CONFIRM:
        _pc = store.get_pending_cancellation(from_number, bid)
        if _pc:
            _execute_cancellation(from_number, _pc, business, sender)
            return ''

    # Cancellation flow — Step B: back out of pending cancellation
    if _body_lower in _CANCEL_DENY:
        if store.get_pending_cancellation(from_number, bid):
            store.clear_pending_cancellation(from_number, bid)
            lang = detect_client_language(from_number, business)
            msg  = ('¡Perfecto! Tu reserva sigue activa. ¿Hay algo más en lo que pueda ayudarte? 🏖️'
                    if lang == 'es' else
                    'Got it — your booking is still active. Anything else I can help with? 🏖️')
            store.append_message(from_number, 'user', body, bid)
            send_whatsapp(from_number, msg, sender)
            store.append_message(from_number, 'assistant', msg, bid)
            return ''

    # Cancellation flow — Step C: initiate cancellation
    if _body_lower in _CANCEL_INTENTS:
        lang = detect_client_language(from_number, business)
        _handle_cancel_request(from_number, lang, body, business, sender)
        return ''

    # CONFIRMAR fallback: retry Tilopay if link was never sent
    _confirm       = body.lower().strip()
    _is_confirming = _confirm in {'confirmar', 'confirm', 'confirmo', 'yes', 'sí', 'si', 'ok'}
    if _is_confirming:
        _prov_num, _pq = store.get_pending_quote_for_client(from_number, bid)
        if _pq and _pq.get('fee') and not _pq.get('link_sent'):
            _fee      = _pq['fee']
            _currency = _pq.get('currency', 'USD')
            _booking  = _pq['booking']
            _biz      = business or {}
            _biz_slug = re.sub(r'[^A-Z]', '', _biz.get('slug', 'BIZ').upper())[:4]
            _prod_en  = _biz.get('settings', {}).get('product_term_en', 'Rental')
            _name     = _extract_booking_field(_booking, 'Name')  or 'Client'
            _email    = _extract_booking_field(_booking, 'Email') or f'client@{_biz.get("slug", "business")}.com'
            _loc      = _extract_booking_field(_booking, 'Location')
            _cart     = _extract_booking_field(_booking, 'Cart')
            _qty      = _extract_booking_field(_booking, 'Quantity') or '1'
            _cart_qty = f'{_cart} × {_qty}' if _qty not in ('', '1') else _cart
            _pickup   = _extract_booking_field(_booking, 'Pick-up')
            _dropoff  = _extract_booking_field(_booking, 'Drop-off')
            _loc_code = re.sub(r'[^A-Z]', '', _loc.upper())[:4] if _loc else _biz_slug
            _order    = f'{_biz_slug}-{datetime.utcnow().strftime("%y%m%d%H%M")}-{_loc_code}'
            _desc     = (
                f'{_biz.get("name", _prod_en)} — {_loc} | {_cart_qty}'
                + (f' | {_pickup[:10]} → {_dropoff[:10]}' if _pickup else '')
            )
            _link = tilopay_create_payment_link(_fee, _order, _email, _name,
                                                currency=_currency, description=_desc)
            if _link:
                store.add_pending_payment(_order, from_number, _prov_num, _booking, _fee, bid)
                store.mark_quote_link_sent(_prov_num, bid)
                def _fmt(n): return f'₡{int(n):,}' if _currency == 'CRC' else f'${n:.2f}'
                _commission_pct = _pq.get('commission_pct', 10.0)
                _bal = round(_fee / (_commission_pct / 100), 2)
                _total = round(_fee + _bal, 2)
                _fee_disp = _fmt(_fee)
                _bal_disp = _fmt(_bal)
                _tot_disp = _fmt(_total)
                _lang = detect_client_language(from_number, business)
                if _lang == 'es':
                    _reply = (f'✅ ¡Aquí está tu enlace de pago!\n\n'
                              f'💰 *Resumen:*\n'
                              f'• Cargo de reserva _(cancelar ahora)_: *{_fee_disp}*\n'
                              f'• Saldo del alquiler _(al recibir)_: {_bal_disp}\n'
                              f'• *Total: {_tot_disp}*\n\n'
                              f'👉 {_link}\n\n'
                              f'Una vez procesado, tu reserva queda 100% confirmada. 🏖️\n'
                              f'_El cargo de reserva no es reembolsable._')
                else:
                    _reply = (f'✅ Here\'s your payment link!\n\n'
                              f'💰 *Summary:*\n'
                              f'• Booking fee _(pay now)_: *{_fee_disp}*\n'
                              f'• Rental balance _(at pickup)_: {_bal_disp}\n'
                              f'• *Total: {_tot_disp}*\n\n'
                              f'👉 {_link}\n\n'
                              f'Once paid, your booking is 100% confirmed. 🏖️\n'
                              f'_Booking fees are non-refundable._')
                store.append_message(from_number, 'user', body, bid)
                send_whatsapp(from_number, _reply, sender)
                store.append_message(from_number, 'assistant', _reply, bid)
                return ''

    _is_first_msg = len(store.get_history(from_number, bid)) == 0
    store.append_message(from_number, 'user', body, bid)

    # ── Human agent detection ─────────────────────────────────────────────────
    _human_kw = ('hablar con alguien', 'agente humano', 'persona real', 'humano real',
                 'necesito ayuda', 'quiero hablar', 'hablar con una persona',
                 'speak to someone', 'human agent', 'real person', 'talk to someone',
                 'speak with a person', 'need help', 'representative')
    if any(kw in body.lower() for kw in _human_kw):
        store.create_notification(
            bid, 'human_needed',
            'Human agent requested',
            f'Customer {from_number} is asking for a real person.',
            lead_phone=from_number
        )
        alert_admin(f'🆘 *Human agent needed*\n\nCustomer: {from_number}\nMessage: {body}', sender)

    # Per-conversation AI toggle — panel can disable AI for a specific chat
    if not store.get_ai_enabled(from_number, bid):
        print(f'  ⏸ AI disabled for {from_number} — human agent handling', flush=True)
        return None

    reply = ask_claude(from_number, body, business, ad_product_interest=ad_product_interest, is_first=_is_first_msg)

    # Medical booking markers
    if _modules.get('medical', {}).get('enabled', False):
        reply = _handle_medical_reply(reply, from_number, business)

    # AI handoff — model signals it can't help, disable AI for this conversation
    reply, handoff_requested = extract_handoff_marker(reply)
    if handoff_requested:
        store.set_ai_enabled(from_number, False, bid)
        alert_admin(f'🤝 *AI handoff requested*\n\nConversation: {from_number}\nBusiness: {(business or {}).get("slug", "?")}', sender)

    booking = extract_booking(reply)
    if booking:
        notify_provider(booking, from_number, business, sender)
        reply = reply.replace(f'[BOOKING_READY]\n{booking}\n[/BOOKING_READY]', '').strip()
        reply = reply.replace('[BOOKING_READY]', '').replace('[/BOOKING_READY]', '').strip()
        if not reply:
            lang = detect_client_language(from_number, business)
            if lang == 'es':
                reply = ('✅ ¡Enviamos tu solicitud al proveedor local!\n\n'
                         'Te enviaremos el enlace de pago para confirmar tu reserva '
                         'lo antes posible. 🏖️' + after_hours_note('es'))
            else:
                reply = ('✅ We\'ve sent your request to the local provider!\n\n'
                         "We'll send you the payment link to confirm your reservation "
                         'as soon as possible. 🏖️' + after_hours_note('en'))

    if append_reply:
        store.append_message(from_number, 'assistant', reply, bid)
    update_lead_contact_info(from_number, bid)
    print(f'  → {from_number}: {reply[:80]}')

    # Business line classification — only if business has lines configured and not yet classified
    _trigger_business_line_routing(from_number, body, bid, business, sender)

    # Auto-enrich lead fields from conversation (name, email, company, etc.)
    _trigger_lead_enrichment(from_number, bid)

    return reply

# ─── WEBHOOKS ────────────────────────────────────────────────────────────────

def _validate_twilio(webhook_path: str, business: Optional[dict] = None) -> bool:
    dev_mode = os.getenv('DEV_MODE', 'false').lower() == 'true'
    if dev_mode:
        return True
    # Use per-business agent_url if available, otherwise fall back to global env
    base_url    = (business or {}).get('agent_url') or AGENT_BASE_URL
    webhook_url = base_url.rstrip('/') + webhook_path
    auth_token  = get_twilio_auth_token(business)
    sig         = request.headers.get('X-Twilio-Signature', '')
    validator   = RequestValidator(auth_token)
    result      = validator.validate(webhook_url, request.form, sig)
    if not result:
        print(f'  ✗ Sig fail | url={webhook_url} | token={auth_token[:8]}... | sig={sig[:20]}...', flush=True)
    return result

@app.route('/webhook', methods=['POST'])
@limiter.limit('60 per minute')
def webhook():
    """Legacy single-tenant webhook — slug configured via DEFAULT_BUSINESS_SLUG env var."""
    if not DEFAULT_BUSINESS_SLUG:
        return 'No DEFAULT_BUSINESS_SLUG configured', 404
    business = store.get_business_by_slug(DEFAULT_BUSINESS_SLUG)
    if not business:
        return 'Business not found', 404
    if not _validate_twilio('/webhook', business):
        print('  ✗ Invalid Twilio signature')
        return 'Forbidden', 403

    from_number = request.form.get('From', '')
    body        = request.form.get('Body', '').strip()
    if not body:
        return str(MessagingResponse()), 200

    referral = {
        'source_type': request.form.get('ReferralSourceType', ''),
        'headline':    request.form.get('ReferralHeadline', ''),
        'source_url':  request.form.get('ReferralSourceUrl', ''),
        'source_id':   request.form.get('ReferralSourceId', ''),
    }

    print(f'  ← {from_number}: {body[:80]}')
    if referral.get('source_type'):
        print(f'  📢 Referral: {referral["source_type"]} — {referral["headline"][:60]}')

    reply = handle_inbound(from_number, body, business, referral=referral)

    resp = MessagingResponse()
    if reply:
        resp.message(reply)
    return str(resp)


@app.route('/webhook/<slug>', methods=['POST'])
@limiter.limit('60 per minute')
def webhook_tenant(slug: str):
    """Multi-tenant webhook — routes by business slug."""
    # Load business first so we can validate with its own Twilio auth token.
    business = store.get_business_by_slug(slug)
    if not business:
        return 'Business not found', 404

    if not _validate_twilio(f'/webhook/{slug}', business):
        print(f'  ✗ Invalid Twilio signature for /{slug}')
        return 'Forbidden', 403

    from_number = request.form.get('From', '')
    body        = request.form.get('Body', '').strip()
    if not body:
        return str(MessagingResponse()), 200

    referral = {
        'source_type': request.form.get('ReferralSourceType', ''),
        'headline':    request.form.get('ReferralHeadline', ''),
        'source_url':  request.form.get('ReferralSourceUrl', ''),
        'source_id':   request.form.get('ReferralSourceId', ''),
    }

    print(f'  ← [{slug}] {from_number}: {body[:80]}')
    if referral.get('source_type'):
        print(f'  📢 [{slug}] Referral: {referral["source_type"]} — {referral["headline"][:60]}')

    human_mode = (business.get('settings') or {}).get('human_mode', False)

    if human_mode:
        sender = business.get('twilio_sender') or TWILIO_WA_NUMBER
        biz_copy = business
        conv_key = f"{biz_copy.get('id')}:{from_number}"

        def _process_and_send():
            lock = _get_conv_lock(conv_key)
            with lock:
                try:
                    reply = handle_inbound(from_number, body, biz_copy, referral=referral, append_reply=False)
                    if reply:
                        clean_reply, img_urls = extract_image_markers(reply, biz_copy)
                        clean_reply, pdf_entries = extract_pdf_markers(clean_reply, biz_copy)
                        text = clean_reply or reply
                        send_at = datetime.now(timezone.utc) + timedelta(seconds=human_delay(reply))
                        payload = {
                            'body': text,
                            'sender': sender,
                            'img_urls': img_urls,
                            'pdf_entries': [[u, f] for u, f in pdf_entries],
                        }
                        store.enqueue_message(biz_copy.get('id'), from_number, payload, send_at)
                except Exception as exc:
                    import traceback
                    print(f'  ✗ Thread error [{biz_copy.get("slug")}]: {exc}', flush=True)
                    traceback.print_exc()

        threading.Thread(target=_process_and_send, daemon=True).start()
        return str(MessagingResponse()), 200

    reply = handle_inbound(from_number, body, business, referral=referral)
    resp = MessagingResponse()
    if reply:
        clean_reply, img_urls = extract_image_markers(reply, business)
        clean_reply, pdf_entries = extract_pdf_markers(clean_reply, business)
        resp.message(clean_reply or reply)
        sender = business.get('twilio_sender') or TWILIO_WA_NUMBER
        for url in img_urls:
            send_whatsapp(from_number, '', sender, business, delay=0.5, media_url=url)
        for file_url, filename in pdf_entries:
            send_whatsapp(from_number, '', sender, business,
                          delay=0.5, media_url=file_url,
                          media_type='document', media_filename=filename)
    return str(resp)


@app.route('/webhook/meta', methods=['GET'])
def webhook_meta_verify():
    """Meta webhook verification — single endpoint for all businesses."""
    mode      = request.args.get('hub.mode')
    token     = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    if mode == 'subscribe' and token == META_VERIFY_TOKEN:
        print('  ✓ Meta webhook verified', flush=True)
        return challenge, 200
    print(f'  ✗ Meta webhook verify failed: token mismatch', flush=True)
    return 'Forbidden', 403


def _transcribe_whatsapp_audio(media_id: str, phone_number_id: str) -> str:
    """Download WhatsApp audio and transcribe with OpenAI Whisper. Returns transcription or ''."""
    openai_key = os.getenv('OPENAI_API_KEY', '')
    if not media_id or not openai_key:
        return ''
    try:
        import tempfile, os as _os
        token = META_ACCESS_TOKEN

        # Step 1: Get download URL from Meta
        meta_url_req = urllib.request.Request(
            f'https://graph.facebook.com/v19.0/{media_id}',
            headers={'Authorization': f'Bearer {token}'},
        )
        with urllib.request.urlopen(meta_url_req, timeout=10) as r:
            media_info = json.loads(r.read())
        download_url = media_info.get('url')
        if not download_url:
            return ''

        # Step 2: Download audio file
        audio_req = urllib.request.Request(
            download_url,
            headers={'Authorization': f'Bearer {token}'},
        )
        with urllib.request.urlopen(audio_req, timeout=30) as r:
            audio_data = r.read()
            content_type = r.headers.get('Content-Type', 'audio/ogg')

        ext = '.ogg'
        if 'mp4' in content_type or 'mpeg' in content_type:
            ext = '.mp4'

        # Step 3: Transcribe with OpenAI Whisper
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            boundary = b'----WFBoundary'
            filename = f'audio{ext}'.encode()
            body = (
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="model"\r\n\r\n'
                b'whisper-1\r\n'
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="language"\r\n\r\n'
                b'es\r\n'
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="file"; filename="' + filename + b'"\r\n'
                b'Content-Type: audio/ogg\r\n\r\n' +
                audio_data +
                b'\r\n--' + boundary + b'--\r\n'
            )
            whisper_req = urllib.request.Request(
                'https://api.openai.com/v1/audio/transcriptions',
                data=body,
                headers={
                    'Authorization': f'Bearer {openai_key}',
                    'Content-Type': f'multipart/form-data; boundary={boundary.decode()}',
                },
                method='POST',
            )
            with urllib.request.urlopen(whisper_req, timeout=30) as r:
                result = json.loads(r.read())
            transcript = result.get('text', '').strip()
            print(f'  🎙 Audio transcribed ({len(audio_data)} bytes): {transcript[:80]}', flush=True)
            return transcript
        finally:
            _os.unlink(tmp_path)

    except Exception as e:
        print(f'  ⚠ _transcribe_whatsapp_audio: {e}', flush=True)
        return ''


@app.route('/webhook/meta', methods=['POST'])
@limiter.limit('120 per minute')
def webhook_meta():
    """Meta Cloud API inbound webhook — routes by phone_number_id."""
    # Signature verification using app secret
    if META_APP_SECRET:
        import hmac, hashlib
        sig_header = request.headers.get('X-Hub-Signature-256', '')
        expected   = 'sha256=' + hmac.new(
            META_APP_SECRET.encode(), request.data, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, sig_header):
            print('  ✗ Meta sig fail', flush=True)
            return 'Forbidden', 403

    payload = request.get_json(silent=True) or {}
    try:
        entry        = payload.get('entry', [{}])[0]
        change       = entry.get('changes', [{}])[0].get('value', {})
        phone_num_id = change.get('metadata', {}).get('phone_number_id', '')

        # Handle delivery/read status updates
        statuses = change.get('statuses', [])
        if statuses:
            biz = store.get_business_by_meta_phone_number_id(phone_num_id)
            bid = biz.get('id') if biz else None
            for s in statuses:
                wam_id  = s.get('id')
                status  = s.get('status')  # sent / delivered / read / failed
                phone   = '+' + s.get('recipient_id', '').lstrip('+')
                if wam_id and status and bid:
                    store.upsert_message_status(wam_id, phone, status, bid)
                    print(f'  ✓ [meta] status {status} for {wam_id[:12]}…', flush=True)
            return '', 200

        msgs = change.get('messages', [])
        if not msgs:
            return '', 200
        msg  = msgs[0]
        msg_type    = msg.get('type', '')
        from_number = '+' + msg['from']
        body        = ''

        if msg_type == 'text':
            body = msg['text']['body'].strip()
        elif msg_type == 'audio':
            body = _transcribe_whatsapp_audio(msg.get('audio', {}).get('id', ''), phone_num_id)
        else:
            return '', 200  # ignore image/video/document/etc for now

        if not body:
            return '', 200
    except (KeyError, IndexError):
        return '', 200

    # Route to the right business by phone_number_id
    business = store.get_business_by_meta_phone_number_id(phone_num_id)
    if not business:
        print(f'  ✗ No business found for meta phone_number_id={phone_num_id}', flush=True)
        return '', 200

    slug = business.get('slug', '?')
    print(f'  ← [meta/{slug}] {from_number}: {body[:80]}', flush=True)

    human_mode = (business.get('settings') or {}).get('human_mode', False)

    if human_mode:
        biz_copy = business
        conv_key = f"{biz_copy.get('id')}:{from_number}"

        def _flush(ck: str, fn: str, biz: dict):
            with _msg_buffer_lock:
                entry = _msg_buffer.pop(ck, None)
            if not entry:
                return
            combined = '\n'.join(entry['messages'])
            print(f'  ⏱ Debounce flush [{biz.get("slug")}] {fn}: {len(entry["messages"])} msg(s)', flush=True)
            lock = _get_conv_lock(ck)
            with lock:
                try:
                    reply = handle_inbound(fn, combined, biz, append_reply=False)
                    if reply:
                        # Write reply to history immediately so the next debounce flush
                        # sees the updated context (queue worker handles sending only)
                        store.append_message(fn, 'assistant', reply, biz.get('id'))
                        clean_reply, img_urls = extract_image_markers(reply, biz)
                        clean_reply, pdf_entries = extract_pdf_markers(clean_reply, biz)
                        text = clean_reply or reply
                        send_at = datetime.now(timezone.utc) + timedelta(seconds=human_delay(reply))
                        payload = {
                            'body': text,
                            'img_urls': img_urls,
                            'pdf_entries': [[u, f] for u, f in pdf_entries],
                            'history_written': True,
                        }
                        store.enqueue_message(biz.get('id'), fn, payload, send_at)
                except Exception as exc:
                    import traceback
                    print(f'  ✗ Thread error [meta/{biz.get("slug")}]: {exc}', flush=True)
                    traceback.print_exc()

        with _msg_buffer_lock:
            if conv_key in _msg_buffer:
                _msg_buffer[conv_key]['timer'].cancel()
                _msg_buffer[conv_key]['messages'].append(body)
            else:
                _msg_buffer[conv_key] = {'messages': [body]}
            t = threading.Timer(MSG_DEBOUNCE_SECS, _flush, args=[conv_key, from_number, biz_copy])
            t.daemon = True
            _msg_buffer[conv_key]['timer'] = t
            t.start()
        return '', 200

    reply = handle_inbound(from_number, body, business)
    if reply:
        clean_reply, img_urls = extract_image_markers(reply, business)
        clean_reply, pdf_entries = extract_pdf_markers(clean_reply, business)
        wam_id = send_whatsapp(from_number, clean_reply or reply, None, business)
        if wam_id:
            store.upsert_message_status(wam_id, from_number, 'sent', business.get('id') if business else None)
        for url in img_urls:
            send_whatsapp(from_number, '', None, business, delay=0.5, media_url=url)
        for file_url, filename in pdf_entries:
            send_whatsapp(from_number, '', None, business,
                          delay=0.5, media_url=file_url,
                          media_type='document', media_filename=filename)
    return '', 200


@app.route('/payment-confirmed', methods=['GET'])
def payment_confirmed():
    order_number = request.args.get('order', '').strip()
    if not order_number:
        return '<h2>✅ Payment received! Your booking is confirmed.</h2>', 200
    _process_confirmed_payment(order_number)
    return (
        '<html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0f9ff">'
        '<h1>🏖️ Booking Confirmed!</h1>'
        '<p style="font-size:18px">Your reservation is locked in.<br>'
        'You will receive full details via WhatsApp shortly.</p><hr>'
        '<p style="font-size:18px">🏖️ ¡Reserva Confirmada!<br>'
        'Tu reserva está asegurada.<br>Recibirás los detalles por WhatsApp en breve.</p>'
        ''
        '</body></html>'
    ), 200


@app.route('/payment-confirmed', methods=['POST'])
def payment_confirmed_webhook():
    data         = request.get_json(silent=True) or request.form.to_dict()
    order_number = (data.get('order') or data.get('orderNumber') or '').strip()
    if order_number:
        _process_confirmed_payment(order_number)
    return jsonify({'status': 'ok'}), 200


def _process_confirmed_payment(order_number: str):
    payment = store.get_pending_payment(order_number)
    if not payment:
        print(f'  ℹ No pending payment for order {order_number}')
        return

    if payment.get('processed'):
        print(f'  ℹ Order {order_number} already processed — skipping')
        return

    store.mark_payment_processed(order_number)
    payment = store.get_pending_payment(order_number)
    if not payment or not payment.get('processed'):
        print(f'  ⚠ Could not confirm processed flag for {order_number} — aborting')
        return

    client_phone    = payment['client']
    provider_number = payment['provider']
    full_booking    = payment['booking']

    # Look up business for this booking
    booking_row = None
    try:
        r = store._sb().table('bookings').select('business_id').eq('order_number', order_number).limit(1).execute()
        if r.data:
            bid      = r.data[0]['business_id']
            biz_list = store._sb().table('businesses').select('*').eq('id', bid).limit(1).execute()
            business = biz_list.data[0] if biz_list.data else None
        else:
            business = None
    except Exception:
        business = None

    sender = (business or {}).get('twilio_sender', TWILIO_WA_NUMBER)
    bid    = business.get('id') if business else None

    print(f'  💳 Payment confirmed: order={order_number}, client={client_phone}')

    store.add_confirmed_booking(client_phone, order_number, provider_number,
                                full_booking, payment.get('fee', 0), bid)
    release_contact_info_to_provider(provider_number, full_booking, client_phone, sender, business)

    lang         = detect_client_language(client_phone, business)
    biz_name     = (business or {}).get('name', '')
    _pay_settings = (business or {}).get('settings', {})
    if lang == 'es':
        confirmation = _pay_settings.get('payment_confirmation_es') or (
            '✅ *¡Reserva Confirmada!*\n\n'
            'Tu pago fue recibido y tu reserva está asegurada. 🎉\n\n'
            'El proveedor te contactará directamente para coordinar los detalles. '
            f'Si tienes alguna pregunta, estamos aquí 24/7.\n\n'
            f'_{biz_name}_'
        )
    else:
        confirmation = _pay_settings.get('payment_confirmation_en') or (
            '✅ *Booking Confirmed!*\n\n'
            'Your payment has been received and your reservation is locked in. 🎉\n\n'
            'The provider will contact you directly to coordinate details. '
            f"If you have any questions, we're here 24/7!\n\n"
            f'_{biz_name}_'
        )
    send_whatsapp(client_phone, confirmation, sender)
    store.append_message(client_phone, 'assistant', confirmation, bid)

    store.clear_pending_payment(order_number, bid)
    if provider_number:
        store.clear_pending_quote(provider_number, bid)

# ─── AUTH ─────────────────────────────────────────────────────────────────────

def _check_admin_auth() -> bool:
    if session.get('authenticated'):
        return True
    if not ADMIN_PASSWORD:
        return False
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Basic '):
        return False
    try:
        credentials = base64.b64decode(auth[6:]).decode('utf-8')
        _, password = credentials.split(':', 1)
        return password == ADMIN_PASSWORD
    except Exception:
        return False

# ─── CRON ─────────────────────────────────────────────────────────────────────

@app.route('/cron', methods=['POST'])
def cron():
    secret = request.headers.get('X-Cron-Secret', '')
    if CRON_SECRET and secret != CRON_SECRET:
        return 'Forbidden', 403

    businesses = store.get_all_businesses() or []

    for biz in businesses:
        if not biz.get('active', True):
            continue
        sender = biz.get('twilio_sender', TWILIO_WA_NUMBER)
        cleanup_expired_entries(biz)
        send_provider_followups(biz, sender)
        send_cold_lead_followups(biz, sender)
        handle_provider_timeout(biz, sender)

    return jsonify({'status': 'ok', 'ts': datetime.utcnow().isoformat()}), 200

# ─── BROADCASTS ──────────────────────────────────────────────────────────────

CS_API_KEY = os.environ.get('CS_API_KEY', '')

def _require_api_key():
    """Reject requests that don't carry the CS_API_KEY header."""
    key = request.headers.get('X-CS-API-Key', '')
    if not CS_API_KEY or key != CS_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    return None


@app.route('/api/broadcasts/<broadcast_id>/send', methods=['POST'])
def send_broadcast(broadcast_id: str):
    err = _require_api_key()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    business_id = body.get('business_id')
    broadcast = store.get_broadcast(broadcast_id, business_id)
    if not broadcast:
        return jsonify({'error': 'Broadcast not found'}), 404
    if broadcast['status'] not in ('draft', 'failed'):
        return jsonify({'error': f'Broadcast status is {broadcast["status"]} — cannot re-send'}), 400

    business = store.get_business_by_slug(
        next((b['slug'] for b in store.get_all_businesses() if b['id'] == broadcast['business_id']), '')
    ) if not business_id else None

    # Load business from DB
    biz_rows = store.get_all_businesses()
    biz = next((b for b in biz_rows if b['id'] == broadcast['business_id']), None)
    if not biz:
        return jsonify({'error': 'Business not found'}), 404

    pending = store.get_broadcast_recipients(broadcast_id, status='pending')
    if not pending:
        return jsonify({'error': 'No pending recipients'}), 400

    store.update_broadcast(broadcast_id, {'status': 'sending'})

    def _fan_out():
        sent = err_count = 0
        for r in pending:
            try:
                wam_id = send_whatsapp(r['phone'], broadcast['message'], None, biz)
                updates = {'status': 'sent', 'sent_at': datetime.utcnow().isoformat() + 'Z'}
                if wam_id:
                    updates['wam_id'] = wam_id
                    store.upsert_message_status(wam_id, r['phone'], 'sent', biz['id'])
                store.update_broadcast_recipient(r['id'], updates)
                sent += 1
            except Exception as e:
                store.update_broadcast_recipient(r['id'], {'status': 'failed', 'error_msg': str(e)[:200]})
                err_count += 1
            time.sleep(0.5)  # Meta rate limit: ~2 msg/sec per number
        store.update_broadcast(broadcast_id, {
            'status': 'completed' if not err_count else 'failed',
            'sent_count': sent, 'error_count': err_count,
            'sent_at': datetime.utcnow().isoformat() + 'Z',
        })
        print(f'  ✓ Broadcast {broadcast_id[:8]}… done: {sent} sent, {err_count} errors', flush=True)

    threading.Thread(target=_fan_out, daemon=True).start()
    return jsonify({'status': 'sending', 'total': len(pending)}), 202


@app.route('/api/businesses/reachable-leads', methods=['GET'])
def reachable_leads():
    err = _require_api_key()
    if err:
        return err
    business_id = request.args.get('business_id')
    within_hours = int(request.args.get('within_hours', 23))
    leads = store.get_reachable_leads(business_id, within_hours)
    return jsonify(leads), 200


# ─── MEDAGENT REMINDERS CRON ─────────────────────────────────────────────────

_REMINDER_YES = {'si', 'sí', 'yes', 'confirmo', 'confirmar', 'asisto', 'ahi estare', 'ahí estaré', 'ok', 'claro'}
_REMINDER_NO  = {'no', 'cancelar', 'cancelo', 'no puedo', 'no voy', 'no asistiré', 'no asistire'}

def _fmt_reminder_date(date_str: str) -> str:
    """Return 'Martes 8 de agosto' from '2026-08-08'."""
    DAYS_ES  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
    MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
    try:
        from datetime import date as _d
        d = _d.fromisoformat(date_str)
        return f'{DAYS_ES[d.weekday()]} {d.day} de {MONTHS_ES[d.month - 1]}'
    except Exception:
        return date_str

def _send_appointment_reminder(appt: dict, reminder_type: str, business: dict, cfg: dict = None):
    """Send a WhatsApp reminder for an appointment.
    cfg: the reminders config block from business.modules.reminders (optional)."""
    patient   = appt.get('patients') or {}
    doctor    = appt.get('doctors') or {}
    service   = appt.get('med_services') or {}
    phone     = patient.get('phone', '')
    name      = patient.get('name') or 'paciente'
    doc_name  = doctor.get('name', '')
    svc_name  = service.get('name', '')
    date_fmt  = _fmt_reminder_date(appt.get('date', ''))
    time_fmt  = appt.get('start_time', '')[:5]
    biz_name  = business.get('name', 'la clínica')

    if not phone:
        return

    location  = appt.get('doctor_locations') or {}
    loc_name  = location.get('name', '')
    loc_addr  = location.get('address', '')
    loc_maps  = location.get('maps_url', '')

    cfg = cfg or {}
    custom_msg = cfg.get('message_es') or ''
    if custom_msg:
        # Supports placeholders: {name}, {doctor}, {service}, {date}, {time}, {clinic}, {location}
        loc_label = loc_name or ''
        if loc_addr:
            loc_label = f'{loc_name} — {loc_addr}' if loc_name else loc_addr
        try:
            msg = custom_msg.format(
                name=name, doctor=doc_name, service=svc_name,
                date=date_fmt, time=time_fmt, clinic=biz_name,
                location=loc_label,
            )
        except (KeyError, ValueError):
            msg = custom_msg  # use as-is if format fails
    else:
        intro = 'mañana' if reminder_type == '24h' else 'en unas horas'
        svc_line = f'\nServicio: {svc_name}' if svc_name else ''
        if loc_name or loc_addr:
            loc_display = loc_name
            if loc_addr:
                loc_display = f'{loc_name} — {loc_addr}' if loc_name else loc_addr
            if loc_maps:
                loc_display += f'\n📍 {loc_maps}'
            loc_line = f'\n📍 {loc_display}'
        else:
            loc_line = ''
        panel_url = (business.get('panel_url') or PANEL_BASE_URL or '').rstrip('/')
        slug = business.get('slug', '')
        manage_link = f'\n🔗 Gestionar cita: {panel_url}/book/{slug}/manage/{appt["id"]}' if panel_url and slug else ''
        msg = (
            f'📅 *Recordatorio de cita — {biz_name}*\n\n'
            f'Hola {name}, te recordamos que tenés cita {intro}:\n\n'
            f'📆 {date_fmt}\n'
            f'🕐 {time_fmt}\n'
            f'👨‍⚕️ {doc_name}'
            f'{svc_line}'
            f'{loc_line}\n\n'
            f'Respondé *SÍ* para confirmar tu asistencia o *NO* si no podés asistir.'
            f'{manage_link}'
        )
    wa_phone = f'whatsapp:{phone}' if not phone.startswith('whatsapp:') else phone
    send_whatsapp(wa_phone, msg, business.get('twilio_sender'), business)
    store.mark_reminder_sent(appt['id'], reminder_type)
    print(f'  📲 Reminder {reminder_type} sent → {phone} (appt {appt["id"][:8]}…)', flush=True)


def _handle_medical_reminder_response(body_lower: str, phone: str, business: dict) -> Optional[str]:
    """If patient is replying to a reminder (YES/NO), update appointment and return response message."""
    bid = business.get('id')
    is_yes = body_lower in _REMINDER_YES or any(w in body_lower.split() for w in _REMINDER_YES)
    is_no  = body_lower in _REMINDER_NO  or any(w in body_lower.split() for w in _REMINDER_NO)
    if not (is_yes or is_no):
        return None

    clean = phone.replace('whatsapp:', '').strip()
    appt = store.get_next_pending_appointment_for_patient(clean, bid)
    if not appt:
        return None

    appt_id = appt['id']
    if is_yes:
        store._sb().table('appointments').update({
            'status': 'confirmed',
            'patient_confirmed_at': datetime.now(timezone.utc).isoformat(),
            'confirmed_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', appt_id).execute()
        doc = (appt.get('doctors') or {}).get('name', '')
        date_fmt = _fmt_reminder_date(appt.get('date', ''))
        time_str = appt.get('start_time', '')[:5]
        return (
            f'✅ ¡Perfecto! Tu cita quedó confirmada.\n\n'
            f'📆 {date_fmt} a las {time_str}\n'
            f'👨‍⚕️ {doc}\n\n'
            f'Te esperamos. Si necesitás hacer algún cambio, escribinos.'
        )
    else:
        store._sb().table('appointments').update({
            'status': 'cancelled',
            'cancelled_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', appt_id).execute()
        return (
            '❌ Entendido, cancelamos tu cita. Cuando quieras reagendar, escribinos y con gusto te buscamos un nuevo horario.'
        )


@app.route('/api/cron/reminders', methods=['POST'])
def cron_reminders():
    """Hourly cron — send appointment reminders for all businesses with reminders enabled.

    Configurable rules per business (modules.reminders):
      hours_before               [24, 2]      which reminder windows to send
      send_window.from/to        0 / 24       local hour range — skip if outside
      only_confirmed             false        only send to status=confirmed (vs confirmed+requested)
      skip_2h_if_patient_confirmed true       skip short reminder if patient already confirmed
      message_es                 null         custom template ({name},{doctor},{date},{time},{clinic})
    """
    err = _require_api_key()
    if err:
        return err

    businesses = store.get_all_businesses()
    total_sent = 0

    for biz in businesses:
        modules       = biz.get('modules') or {}
        reminders_cfg = modules.get('reminders') or {}
        if not reminders_cfg.get('enabled'):
            continue
        # Reminders require medical or calendar module (both use the appointments table)
        _has_scheduling = (modules.get('medical') or {}).get('enabled') or (modules.get('calendar') or {}).get('enabled')
        if not _has_scheduling:
            continue

        bid = biz['id']

        # ── send_window: skip if outside business local hours ────────────────
        now_biz  = biz_now(biz)
        win      = reminders_cfg.get('send_window') or {}
        win_from = int(win.get('from', 0))
        win_to   = int(win.get('to', 24))
        if not (win_from <= now_biz.hour < win_to):
            print(f'  ⏭ [{biz["slug"]}] reminders skipped — outside send_window '
                  f'({now_biz.hour}h, window {win_from}–{win_to}h)', flush=True)
            continue

        # ── configurable rules ───────────────────────────────────────────────
        hours_before      = reminders_cfg.get('hours_before') or [24, 2]
        only_confirmed    = reminders_cfg.get('only_confirmed', False)
        skip_if_confirmed = reminders_cfg.get('skip_2h_if_patient_confirmed', True)
        statuses          = ['confirmed'] if only_confirmed else ['confirmed', 'requested']

        for h in hours_before:
            h = int(h)
            # Map to DB column: ≥12h → reminder_24h slot, <12h → reminder_2h slot
            is_long       = h >= 12
            reminder_key  = '24h' if is_long else '2h'
            sent_col      = 'reminder_24h_sent_at' if is_long else 'reminder_2h_sent_at'
            minutes       = h * 60
            # ±30 min window so hourly cron never misses an appointment
            min_m, max_m  = minutes - 30, minutes + 30

            for appt in store.get_appointments_needing_reminders(bid, min_m, max_m, statuses=statuses):
                if appt.get(sent_col):
                    continue  # already sent this reminder window
                # Skip short reminder if patient already confirmed their attendance
                if not is_long and skip_if_confirmed and appt.get('patient_confirmed_at'):
                    print(f'  ⏭ 2h reminder skipped — patient already confirmed (appt {appt["id"][:8]}…)', flush=True)
                    continue
                _send_appointment_reminder(appt, reminder_key, biz, cfg=reminders_cfg)
                total_sent += 1

    print(f'  ✅ cron_reminders: {total_sent} reminders sent', flush=True)
    return jsonify({'ok': True, 'sent': total_sent}), 200


@app.route('/api/cron/seguimientos', methods=['POST'])
def cron_seguimientos():
    """Hourly cron — send follow-up messages to inactive leads for all businesses with seguimientos enabled.

    Config in modules.seguimientos:
      enabled              true/false
      days_without_response  3       days of inactivity before sending follow-up
      max_followups          1       max follow-ups per lead
      target_statuses        ['new','active']
      message_es             template ({name}, {business})
    """
    err = _require_api_key()
    if err:
        return err

    businesses = store.get_all_businesses()
    total_sent = 0

    for biz in businesses:
        modules = biz.get('modules') or {}
        seg_cfg = modules.get('seguimientos') or {}
        if not seg_cfg.get('enabled'):
            continue

        bid      = biz['id']
        biz_name = biz.get('name', '')
        days     = int(seg_cfg.get('days_without_response', 3))
        max_fu   = int(seg_cfg.get('max_followups', 1))
        statuses = seg_cfg.get('target_statuses') or ['new', 'active']
        msg_tmpl = (seg_cfg.get('message_es') or '').strip()

        leads = store.get_leads_needing_followup(bid, days=days, target_statuses=statuses, max_followups=max_fu)
        for lead in leads:
            phone = lead.get('phone', '')
            name  = lead.get('name') or 'cliente'
            if not phone:
                continue
            try:
                msg = (msg_tmpl or 'Hola {name}, queríamos saber si pudiste revisar la información. Quedamos atentos a cualquier consulta.').format(
                    name=name, business=biz_name,
                )
            except (KeyError, ValueError):
                msg = msg_tmpl or f'Hola {name}, queríamos saber si pudiste revisar la información.'
            wa_phone = f'whatsapp:{phone}' if not phone.startswith('whatsapp:') else phone
            send_whatsapp(wa_phone, msg, biz.get('twilio_sender'), biz)
            store.mark_follow_up_sent(phone, bid)
            total_sent += 1
            print(f'  📲 Seguimiento sent → {phone} (lead {lead.get("id","")[:8]}…)', flush=True)

    print(f'  ✅ cron_seguimientos: {total_sent} seguimientos sent', flush=True)
    return jsonify({'ok': True, 'sent': total_sent}), 200


# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return {'status': 'ok', 'agent': 'Okapi Platform',
            'ts': datetime.utcnow().isoformat()}


@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Internal test endpoint — simulate an inbound WhatsApp message without Twilio."""
    if not _check_admin_auth():
        return jsonify({'error': 'Unauthorized'}), 401
    data  = request.get_json(silent=True) or {}
    slug  = data.get('slug', '')
    phone = data.get('phone', '+50600000001')
    body  = data.get('message', '')
    if not slug or not body:
        return jsonify({'error': 'slug and message required'}), 400
    business = store.get_business_by_slug(slug)
    if not business:
        return jsonify({'error': f'Business "{slug}" not found'}), 404
    reply = handle_inbound(phone, body, business)
    return jsonify({'reply': reply, 'slug': slug, 'phone': phone})


# ─── PERSISTENT QUEUE WORKER ─────────────────────────────────────────────────

def _run_queue_worker():
    """Poll queued_messages every second and send due messages. Survives deploys."""
    store.reset_stale_processing_messages()
    print('  ✓ Queue worker started', flush=True)
    while True:
        try:
            messages = store.claim_due_messages()
            for msg in messages:
                business = store.get_business_by_id(msg['business_id'])
                if not business:
                    store.complete_queued_message(msg['id'], success=False, error_msg='business not found')
                    continue
                payload = msg.get('payload', {})
                try:
                    text = payload.get('body', '')
                    sender = payload.get('sender')
                    wam_id = send_whatsapp(msg['to_number'], text, sender, business)
                    if wam_id:
                        # Only append to history if debounce flush hasn't already done it
                        if not payload.get('history_written'):
                            store.append_message(msg['to_number'], 'assistant', text,
                                                 msg['business_id'], wam_id=wam_id)
                        store.upsert_message_status(wam_id, msg['to_number'], 'sent', msg['business_id'])
                    for url in payload.get('img_urls', []):
                        send_whatsapp(msg['to_number'], '', sender, business, delay=0.5, media_url=url)
                    for entry in payload.get('pdf_entries', []):
                        send_whatsapp(msg['to_number'], '', sender, business,
                                      delay=0.5, media_url=entry[0],
                                      media_type='document', media_filename=entry[1])
                    store.complete_queued_message(msg['id'], success=True)
                except Exception as exc:
                    print(f'  ✗ Queue send failed: {exc}', flush=True)
                    store.complete_queued_message(msg['id'], success=False, error_msg=str(exc))
        except Exception as exc:
            print(f'  ✗ Queue worker error: {exc}', flush=True)
        time.sleep(1)


# ─── RUN ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('🐒  Okapi Platform starting...')
    print(f'   Twilio SID : {TWILIO_ACCOUNT_SID[:8]}...' if TWILIO_ACCOUNT_SID
          else '   ⚠ TWILIO_ACCOUNT_SID not set')
    print(f'   Claude     : {"✓" if ANTHROPIC_API_KEY else "⚠ ANTHROPIC_API_KEY not set"}')
    print(f'   Tilopay    : {"✓" if TILOPAY_KEY else "⚠ TILOPAY_KEY not set"}')
    print(f'   Supabase   : {"✓" if store.SUPABASE_URL else "⚠ SUPABASE_URL not set"}')
    print(f'   Dev mode   : {os.getenv("DEV_MODE", "false")}')
    print(f'   Admin      : {"✓ password set" if ADMIN_PASSWORD else "⚠ ADMIN_PASSWORD not set"}')
    threading.Thread(target=_run_queue_worker, daemon=True, name='queue-worker').start()
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
