"""
Okapi Platform — Multi-tenant WhatsApp AI Booking Agent
First tenant: GolfCartRentalsCR
"""

import base64
import json
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional

# ─── COSTA RICA TIME ─────────────────────────────────────────────────────────
CR_TZ = timezone(timedelta(hours=-6))

def cr_now() -> datetime:
    return datetime.now(CR_TZ)

def is_business_hours() -> bool:
    h = cr_now().hour
    return 8 <= h < 18

def after_hours_note(language: str = 'en') -> str:
    if is_business_hours():
        return ''
    if language == 'es':
        return ('\n\n_Nota: los proveedores locales operan principalmente de 8am a 6pm '
                '(hora Costa Rica), por lo que la confirmación podría tardar un poco más. '
                'Te avisamos en cuanto tengamos respuesta._')
    return ('\n\n_Note: local providers mainly operate between 8am–6pm Costa Rica time, '
            'so confirmation may take a little longer. '
            'We\'ll notify you as soon as we hear back._')

import anthropic
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, session, redirect, url_for
from twilio.request_validator import RequestValidator
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'), override=True)

import supabase_store as store

# ─── CONFIG ──────────────────────────────────────────────────────────────────

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN  = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_WA_NUMBER   = os.getenv('TWILIO_WA_NUMBER')
ANTHROPIC_API_KEY  = os.getenv('ANTHROPIC_API_KEY')

# Env-var provider fallback (used if DB lookup fails)
PROVIDERS = json.loads(os.getenv('PROVIDERS', '{}'))

TILOPAY_API_URL  = 'https://app.tilopay.com/api/v1/'
TILOPAY_KEY      = os.getenv('TILOPAY_KEY',      '2551-6952-8539-8918-3539')
TILOPAY_USER     = os.getenv('TILOPAY_USER',     'wHFrGq')
TILOPAY_PASSWORD = os.getenv('TILOPAY_PASSWORD', 'mOadzM')
AGENT_BASE_URL   = os.getenv('AGENT_BASE_URL',
                               'https://gcr-whatsapp-agent-production.up.railway.app')

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')
ADMIN_WA       = os.getenv('ADMIN_WA', '')       # Admin WhatsApp for system alerts
CRON_SECRET    = os.getenv('CRON_SECRET', '')
PENDING_TTL_H  = int(os.getenv('PENDING_TTL_H', '48'))

# ─── CLIENTS ─────────────────────────────────────────────────────────────────

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
app           = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))

# ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

def _load_prompt():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt.txt')
    try:
        with open(path, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return ''

_FILE_PROMPT = _load_prompt()

def get_system_prompt(business: Optional[dict] = None) -> str:
    """Return active prompt: DB override if set, else file prompt."""
    if business:
        db_prompt = store.get_active_prompt(business.get('id'))
        if db_prompt:
            return db_prompt
    return _FILE_PROMPT

PRICE_EXTRACT_PROMPT = """Extract rental availability, price, and currency from a provider's WhatsApp reply.

You are given the booking's pick-up and drop-off dates (to calculate rental days) and the provider's reply.

Return ONLY a JSON object with exactly three fields:
- "available": true or false
- "price": the TOTAL numeric rental price as a float, or null if unavailable
- "currency": "USD" if dollars, "CRC" if colones, "USD" as default if unclear

DAILY RATE RULE: If the provider quotes a per-day rate (e.g. "$80/day", "$80 por día",
"80 diario", "80 al día"), multiply it by the number of rental days from the booking dates
to get the TOTAL price.

AVAILABILITY RULE: If ANY numeric price appears, set available=true — UNLESS a clear
negative phrase appears AND no price is given alongside it.

Positive signals: any number, "confirmo", "sería/serían", "son", "cuesta", "disponible",
"available", "sí/si", "yes", "ok", "claro", "$", "₡", "colones", "dólares"

Negative signals (only when NO price present): "no disponible", "no tengo",
"not available", "lleno", "ocupado", "no puedo", "sorry"

Currency:
- "colones", "₡", "CRC" → "CRC"
- "$", "dólares", "USD", "dollars", or no symbol → "USD"

Examples (2-day rental):
"500"                            → {"available": true,  "price": 500.00,   "currency": "USD"}
"$80/day"                        → {"available": true,  "price": 160.00,   "currency": "USD"}
"80 por día"                     → {"available": true,  "price": 160.00,   "currency": "USD"}
"Confirmo, serían $500 dólares"  → {"available": true,  "price": 500.00,   "currency": "USD"}
"Sí, 85000 colones"              → {"available": true,  "price": 85000.00, "currency": "CRC"}
"No disponible esas fechas"      → {"available": false, "price": null,     "currency": null}

Return ONLY valid JSON. No explanation."""

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

def ask_claude(phone: str, user_message: str, business: Optional[dict] = None) -> str:
    bid     = business.get('id') if business else None
    history = store.get_history(phone, bid)
    messages = [{'role': m['role'], 'content': m['content']} for m in history]
    messages.append({'role': 'user', 'content': user_message})
    clean_phone = phone.replace('whatsapp:', '').strip()
    today_str   = cr_now().strftime('%A, %B %d, %Y')
    system = (
        get_system_prompt(business)
        + f'\n\n## Today\'s Date\n'
        + f'Today is {today_str} (Costa Rica time, UTC-6). '
        + f'Never accept pick-up or drop-off dates that are before today.\n'
        + f'\n\n## Client\'s WhatsApp Number\n'
        + f'This conversation is coming from: {clean_phone}\n'
        + f'When collecting the phone number, confirm this number with the client '
        + f'instead of asking them to type it. Example: '
        + f'"Is {clean_phone} the best number to reach you? 📱"'
    )
    response = claude_client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text

def relay_quote_to_client(provider_message: str, booking_text: str,
                           client_phone: str, provider_number: str,
                           language: str = 'en',
                           commission_pct: float = 10.0) -> str:
    pickup  = _extract_booking_field(booking_text, 'Pick-up')
    dropoff = _extract_booking_field(booking_text, 'Drop-off')
    extract_input = (
        f'Booking dates:\n  Pick-up: {pickup}\n  Drop-off: {dropoff}\n\n'
        f"Provider's reply: {provider_message}"
    )
    extract_response = claude_client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=128,
        system=PRICE_EXTRACT_PROMPT,
        messages=[{'role': 'user', 'content': extract_input}],
    )
    raw = extract_response.content[0].text.strip()

    try:
        parsed    = json.loads(raw)
        available = parsed.get('available', False)
        price     = parsed.get('price')
        currency  = (parsed.get('currency') or 'USD').upper()
    except Exception:
        available, price, currency = False, None, 'USD'

    if not available or not price:
        negative_words = ['no disponible', 'not available', 'no tengo', 'lleno',
                          'ocupado', 'no puedo', 'sorry, not']
        has_negative = any(w in provider_message.lower() for w in negative_words)
        if not has_negative:
            candidates = []
            for n in re.findall(r'\d+(?:[,\.]\d+)*', provider_message):
                try:
                    candidates.append(float(n.replace(',', '')))
                except ValueError:
                    pass
            if candidates:
                price     = max(candidates)
                available = True
                msg_lower = provider_message.lower()
                currency  = 'CRC' if any(w in msg_lower for w in
                                         ['colon', 'colones', '₡', 'crc']) else 'USD'
                print(f'  ⚠ Regex fallback: {currency} {price}')

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

    client_name  = _extract_booking_field(booking_text, 'Name')  or 'Client'
    client_email = _extract_booking_field(booking_text, 'Email') or 'client@golfcartrentalscr.com'
    cart         = _extract_booking_field(booking_text, 'Cart')
    location     = _extract_booking_field(booking_text, 'Location')
    qty          = _extract_booking_field(booking_text, 'Quantity') or '1'
    cart_qty     = f'{cart} × {qty}' if qty not in ('', '1') else cart

    loc_code     = re.sub(r'[^A-Z]', '', location.upper())[:4] if location else 'GCR'
    order_number = f'GCR-{datetime.utcnow().strftime("%y%m%d%H%M")}-{loc_code}'

    pickup_short  = pickup[:10]  if pickup  else ''
    dropoff_short = dropoff[:10] if dropoff else ''
    description   = (
        f'Golf Cart Rental — {location} | {cart_qty}'
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
        msg  = f'🎉 ¡Tu carrito está disponible — confirma tu reserva!\n\n'
        msg += f'📍 {location}  |  🛒 {cart_qty}\n'
        msg += f'📅 {pickup} → {dropoff}\n\n'
        msg += f'💰 *Resumen de pago:*\n'
        msg += f'• Cargo de reserva _(cancelar ahora)_: *{fee_display}*\n'
        msg += f'• Saldo del alquiler _(al recibir el carrito)_: {balance_disp}\n'
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
        msg  = f'🎉 Your golf cart is available — confirm your booking!\n\n'
        msg += f'📍 {location}  |  🛒 {cart_qty}\n'
        msg += f'📅 {pickup} → {dropoff}\n\n'
        msg += f'💰 *Payment summary:*\n'
        msg += f'• Booking fee _(pay now to confirm)_: *{fee_display}*\n'
        msg += f'• Rental balance _(paid at pickup)_: {balance_disp}\n'
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
        delivery_line = '\n\n📍 Cliente recogerá el carrito directamente en su local.'

    # Message 1 — availability check (redacted, no contact info)
    msg1 = (
        f'📋 *Nueva solicitud — {(business or {}).get("name", "GolfCartRentalsCR")}*\n\n'
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
        twilio_client.messages.create(from_=sender, to=provider_number, body=msg1)
        twilio_client.messages.create(from_=sender, to=provider_number, body=msg2)
        print(f'  ✓ Commission negotiation sent to provider ({provider_number})')
        store.add_pending_quote(provider_number, client_phone, booking_text,
                                business_id=bid, commission_pct=commission_pct)
    except Exception as e:
        print(f'  ✗ Failed to notify provider: {e}')

def _send_full_booking_to_provider(provider_number: str, pending: dict,
                                    sender: Optional[str] = None):
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
        twilio_client.messages.create(from_=effective_sender, to=provider_number, body=msg)
        print(f'  ✓ Full booking sent to provider {provider_number}')
    except Exception as e:
        print(f'  ✗ Could not send full booking: {e}')

def release_contact_info_to_provider(provider_number: str, full_booking: str,
                                      client_phone: str,
                                      sender: Optional[str] = None):
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
        twilio_client.messages.create(from_=effective_sender, to=provider_number, body=msg)
        print(f'  ✓ Contact info released to provider ({provider_number})')
    except Exception as e:
        print(f'  ✗ Failed to release contact info: {e}')

def send_whatsapp(to: str, body: str, sender: Optional[str] = None):
    effective_sender = sender or TWILIO_WA_NUMBER
    try:
        twilio_client.messages.create(from_=effective_sender, to=to, body=body)
        print(f'  → {to}: {body[:80]}')
    except Exception as e:
        print(f'  ✗ Failed to send to {to}: {e}')

def alert_admin(message: str, sender: Optional[str] = None):
    if ADMIN_WA:
        send_whatsapp(ADMIN_WA if ADMIN_WA.startswith('whatsapp:') else f'whatsapp:{ADMIN_WA}',
                      message, sender)

# ─── MAINTENANCE ─────────────────────────────────────────────────────────────

def cleanup_expired_entries(business: Optional[dict] = None):
    bid = business.get('id') if business else None
    store.cleanup_expired_entries(bid, PENDING_TTL_H)

def send_provider_followups(business: Optional[dict] = None,
                             sender: Optional[str] = None):
    """Re-ping providers waiting for price (commission accepted) after 2h."""
    if not is_business_hours():
        return

    bid             = business.get('id') if business else None
    effective_sender = sender or TWILIO_WA_NUMBER
    stale           = store.get_stale_provider_quotes(bid, hours=2)

    for provider_num, quote in stale.items():
        if quote.get('follow_up_sent'):
            continue

        store.mark_provider_followup_sent(provider_num, bid)

        try:
            twilio_client.messages.create(
                from_=effective_sender, to=provider_num,
                body=(
                    '🔔 *Recordatorio — Solicitud de Reserva Pendiente*\n\n'
                    'Aún esperamos su cotización de precio. '
                    'Por favor responda lo antes posible. ¡Gracias!'
                )
            )
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
                twilio_client.messages.create(from_=effective_sender, to=client_phone, body=msg)
                store.append_message(client_phone, 'assistant', msg, bid)
                print(f'  ↺ Follow-up sent to client {client_phone}')
            except Exception as e:
                print(f'  ✗ Client follow-up failed: {e}')

def send_cold_lead_followups(business: Optional[dict] = None, sender: Optional[str] = None):
    """Nudge leads that have gone cold after 24h."""
    if not is_business_hours():
        return

    bid             = business.get('id') if business else None
    effective_sender = sender or TWILIO_WA_NUMBER
    biz_settings    = store.get_business_by_slug((business or {}).get('slug', 'golfcartrentalscr')) or {}
    follow_up_hours = int(biz_settings.get('follow_up_hours', 24))

    cold_leads = store.get_cold_leads(bid, follow_up_hours)
    for lead in cold_leads:
        phone = lead.get('phone', '')
        if not phone:
            continue
        lang = detect_client_language(phone, business)
        msg  = ('¡Hola! ¿Seguís interesado en rentar un carrito de golf en Costa Rica? 🏖️'
                if lang == 'es'
                else 'Hey! Just checking in — still interested in renting a golf cart? 🏖️')
        try:
            twilio_client.messages.create(
                from_=effective_sender,
                to=phone if phone.startswith('whatsapp:') else f'whatsapp:{phone}',
                body=msg)
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
    biz_settings    = store.get_business_by_slug((business or {}).get('slug', 'golfcartrentalscr')) or {}
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
            twilio_client.messages.create(
                from_=sender or TWILIO_WA_NUMBER,
                to=provider_num,
                body=(f'❌ *Reserva Cancelada — GolfCartRentalsCR*\n\n'
                      f'El cliente ha cancelado la reserva:\n'
                      f'📍 {location}  |  📅 {pickup}\n\n'
                      f'No es necesario ningún otro paso de su parte. ¡Gracias!')
            )
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


def handle_inbound(from_number: str, body: str,
                   business: Optional[dict] = None) -> str:
    """
    Core message router. Returns the TwiML response body string.
    Works for any business — defaults to GolfCartRentalsCR.
    """
    bid     = business.get('id') if business else None
    sender  = (business or {}).get('twilio_sender', TWILIO_WA_NUMBER)

    # ── Is this a provider? ───────────────────────────────────────────────────
    provider_location = get_provider_location(from_number, business)
    if provider_location:
        pending = store.get_pending_quote(from_number, bid)
        if pending:
            if pending.get('link_sent'):
                return '✅ Recibido. Ya enviamos el enlace al cliente. Esperando su pago.'

            commission_status = pending.get('commission_status', 'accepted')
            body_lower        = body.lower().strip()

            # ── Commission negotiation phase ──────────────────────────────────
            if commission_status == 'pending':
                counter = _is_counter_offer(body_lower)

                if body_lower in _COMMISSION_ACCEPT:
                    # Provider accepted commission
                    pct = pending.get('commission_pct', 10.0)
                    store.update_commission_status(from_number, 'accepted',
                                                   final_pct=pct, business_id=bid)
                    _send_full_booking_to_provider(from_number, pending, sender)
                    return '✅ Comisión aceptada. Le enviamos los detalles de la reserva.'

                elif counter is not None and body_lower not in {'no'}:
                    # Counter-offer
                    store.update_commission_status(from_number, 'countered',
                                                   counter_offer=counter, business_id=bid)
                    biz_name = (business or {}).get('name', 'GolfCartRentalsCR')
                    min_pct  = float((business or {}).get('min_commission_pct', 5.0))
                    auto_pct = float((business or {}).get('auto_accept_counter_within_pct', 2.0))
                    base_pct = pending.get('commission_pct', 10.0)

                    if counter >= base_pct - auto_pct:
                        # Auto-accept (within tolerance)
                        store.update_commission_status(from_number, 'accepted',
                                                       final_pct=counter, business_id=bid)
                        _send_full_booking_to_provider(from_number, pending, sender)
                        return f'✅ Contrapropuesta de {counter:.0f}% aceptada automáticamente.'
                    else:
                        # Alert admin
                        alert_admin(
                            f'💼 *Counter-offer from provider*\n\n'
                            f'Provider: {from_number}\n'
                            f'Location: {provider_location}\n'
                            f'Our rate: {base_pct:.0f}%  |  Counter: {counter:.0f}%\n\n'
                            f'Reply in CRM to approve or reject.',
                            sender
                        )
                        return f'✅ Recibimos tu contrapropuesta de {counter:.0f}%. Te respondemos pronto.'

                else:
                    # Rejected
                    store.update_commission_status(from_number, 'rejected', business_id=bid)
                    # Try next provider
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
                        return '✅ Entendido. Gracias por responder.'

            # ── Price quote phase (commission already accepted) ───────────────
            else:
                client_phone = pending['client']
                booking_text = pending['booking']
                lang         = detect_client_language(client_phone, business)
                commission_pct = pending.get('commission_pct', 10.0)
                print(f'  ↩ Provider reply ({provider_location}) → client {client_phone} [{lang}]')

                client_msg = relay_quote_to_client(body, booking_text,
                                                   client_phone, from_number,
                                                   language=lang,
                                                   commission_pct=commission_pct)
                send_whatsapp(client_phone, client_msg, sender)
                store.append_message(client_phone, 'assistant', client_msg, bid)
                store.mark_quote_link_sent(from_number, bid)
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
        is_es = any(w in body.lower() for w in ['reiniciar', 'nuevo', 'nueva', 'empezar'])
        if is_es:
            reply = ('¡Claro! Empezamos de nuevo. 🏖️ '
                     '¿En qué playa de Costa Rica necesitas el carrito de golf?')
        else:
            reply = ("Sure, let's start fresh! 🏖️ "
                     'Which Costa Rica beach town do you need a golf cart in?')
        return reply

    _body_lower = body.lower().strip()

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
            _name     = _extract_booking_field(_booking, 'Name')  or 'Client'
            _email    = _extract_booking_field(_booking, 'Email') or 'client@golfcartrentalscr.com'
            _loc      = _extract_booking_field(_booking, 'Location')
            _cart     = _extract_booking_field(_booking, 'Cart')
            _qty      = _extract_booking_field(_booking, 'Quantity') or '1'
            _cart_qty = f'{_cart} × {_qty}' if _qty not in ('', '1') else _cart
            _pickup   = _extract_booking_field(_booking, 'Pick-up')
            _dropoff  = _extract_booking_field(_booking, 'Drop-off')
            _loc_code = re.sub(r'[^A-Z]', '', _loc.upper())[:4] if _loc else 'GCR'
            _order    = f'GCR-{datetime.utcnow().strftime("%y%m%d%H%M")}-{_loc_code}'
            _desc     = (
                f'Golf Cart Rental — {_loc} | {_cart_qty}'
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

    store.append_message(from_number, 'user', body, bid)
    reply = ask_claude(from_number, body, business)

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

    store.append_message(from_number, 'assistant', reply, bid)
    print(f'  → {from_number}: {reply[:80]}')
    return reply

# ─── WEBHOOKS ────────────────────────────────────────────────────────────────

def _validate_twilio(webhook_path: str) -> bool:
    dev_mode = os.getenv('DEV_MODE', 'false').lower() == 'true'
    if dev_mode:
        return True
    webhook_url = AGENT_BASE_URL.rstrip('/') + webhook_path
    validator   = RequestValidator(TWILIO_AUTH_TOKEN)
    return validator.validate(
        webhook_url,
        request.form,
        request.headers.get('X-Twilio-Signature', '')
    )

@app.route('/webhook', methods=['POST'])
def webhook():
    """Legacy single-tenant webhook — routes to GolfCartRentalsCR."""
    if not _validate_twilio('/webhook'):
        print('  ✗ Invalid Twilio signature')
        return 'Forbidden', 403

    from_number = request.form.get('From', '')
    body        = request.form.get('Body', '').strip()
    if not body:
        return '', 204

    print(f'  ← {from_number}: {body[:80]}')

    business = store.get_business_by_slug('golfcartrentalscr')
    reply    = handle_inbound(from_number, body, business)

    resp = MessagingResponse()
    if reply:
        resp.message(reply)
    return str(resp)


@app.route('/webhook/<slug>', methods=['POST'])
def webhook_tenant(slug: str):
    """Multi-tenant webhook — routes by business slug."""
    if not _validate_twilio(f'/webhook/{slug}'):
        print(f'  ✗ Invalid Twilio signature for /{slug}')
        return 'Forbidden', 403

    business = store.get_business_by_slug(slug)
    if not business:
        return 'Business not found', 404

    from_number = request.form.get('From', '')
    body        = request.form.get('Body', '').strip()
    if not body:
        return '', 204

    print(f'  ← [{slug}] {from_number}: {body[:80]}')

    reply = handle_inbound(from_number, body, business)

    resp = MessagingResponse()
    if reply:
        resp.message(reply)
    return str(resp)


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
        '<p><a href="https://golfcartrentalscr.com" style="color:#0066cc">'
        'Return to GolfCartRentalsCR.com</a></p>'
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
    release_contact_info_to_provider(provider_number, full_booking, client_phone, sender)

    lang = detect_client_language(client_phone, business)
    if lang == 'es':
        confirmation = (
            '✅ *¡Reserva Confirmada!*\n\n'
            'Tu pago fue recibido y tu carrito de golf está asegurado. 🏖️\n\n'
            'El proveedor local te contactará directamente para coordinar la entrega. '
            'Si tienes alguna pregunta, estamos aquí 24/7.\n\n'
            '_GolfCartRentalsCR — Tu ride en el paraíso_ 🌴'
        )
    else:
        confirmation = (
            '✅ *Booking Confirmed!*\n\n'
            'Your payment has been received and your golf cart reservation is locked in. 🏖️\n\n'
            'The local provider will contact you directly to coordinate pickup. '
            "If you have any questions, we're here 24/7!\n\n"
            '_GolfCartRentalsCR — Your ride in paradise_ 🌴'
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

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = ''
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            session['authenticated'] = True
            return redirect(request.args.get('next', '/dashboard'))
        error = 'Incorrect password'
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Okapi Platform — Login</title>
<style>
body{{font-family:system-ui,sans-serif;background:#0f172a;display:flex;
     align-items:center;justify-content:center;height:100vh;margin:0}}
.card{{background:#1e293b;padding:40px;border-radius:12px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.4)}}
h1{{color:#f8fafc;margin:0 0 8px;font-size:22px}}
p{{color:#94a3b8;margin:0 0 24px;font-size:14px}}
input{{width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;
      border-radius:8px;color:#f8fafc;font-size:15px;box-sizing:border-box;margin-bottom:16px}}
button{{width:100%;padding:11px;background:#3b82f6;border:none;border-radius:8px;
       color:#fff;font-size:15px;font-weight:600;cursor:pointer}}
button:hover{{background:#2563eb}}
.error{{color:#f87171;font-size:13px;margin-bottom:12px}}
</style></head><body>
<div class="card">
<h1>🐒 Okapi Platform</h1>
<p>Admin dashboard</p>
{"<p class='error'>"+error+"</p>" if error else ""}
<form method="post">
<input type="password" name="password" placeholder="Password" autofocus>
<button type="submit">Sign in</button>
</form>
</div></body></html>'''

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# ─── LEGACY ADMIN ─────────────────────────────────────────────────────────────

@app.route('/admin', methods=['GET'])
def admin():
    if not _check_admin_auth():
        return Response('Unauthorized', 401,
                        {'WWW-Authenticate': 'Basic realm="Okapi Admin"'})

    quotes   = store.get_all_pending_quotes()
    payments = {k: v for k, v in store.get_all_pending_payments().items()
                if not v.get('processed')}
    now_ts   = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

    def age(e): return f"{store._hours_old(e):.1f}h"

    rows_q = ''
    for prov, q in quotes.items():
        loc    = _extract_booking_field(q.get('booking', ''), 'Location') or '—'
        cart   = _extract_booking_field(q.get('booking', ''), 'Cart')     or '—'
        qty    = _extract_booking_field(q.get('booking', ''), 'Quantity') or '1'
        pickup = _extract_booking_field(q.get('booking', ''), 'Pick-up')  or '—'
        status = '✅ Link sent' if q.get('link_sent') else '⏳ Awaiting quote'
        cart_label = f'{cart} ×{qty}' if qty not in ('', '1') else cart
        rows_q += (f'<tr><td>{prov}</td><td>{q.get("client","—")}</td>'
                   f'<td>{loc}</td><td>{cart_label}</td><td>{pickup}</td>'
                   f'<td>{status}</td><td>{age(q)}</td></tr>')

    rows_p = ''
    for order, p in payments.items():
        loc = _extract_booking_field(p.get('booking', ''), 'Location') or '—'
        fee = p.get('fee', 0)
        rows_p += (f'<tr><td>{order}</td><td>{p.get("client","—")}</td>'
                   f'<td>{loc}</td><td>${fee:.2f}</td><td>{age(p)}</td></tr>')

    html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>GCR Admin</title>
<style>
body{{font-family:sans-serif;padding:20px;background:#f5f5f5}}
h1{{color:#2a6496}}h2{{color:#444;margin-top:30px}}
table{{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;
       overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}}
th{{background:#2a6496;color:#fff;padding:10px 12px;text-align:left}}
td{{padding:8px 12px;border-bottom:1px solid #eee}}
tr:last-child td{{border-bottom:none}}
.ts{{color:#999;font-size:13px}}
</style></head><body>
<h1>🏖️ GolfCartRentalsCR — Admin</h1>
<p class="ts">Refreshed: {now_ts} &nbsp;|&nbsp;
<a href="/admin">↻ Refresh</a> &nbsp;|&nbsp;
<a href="/dashboard">📊 New Dashboard</a></p>

<h2>Pending Quotes ({len(quotes)})</h2>
<table><tr><th>Provider</th><th>Client</th><th>Location</th>
<th>Cart</th><th>Pick-up</th><th>Status</th><th>Age</th></tr>
{rows_q or '<tr><td colspan=7 style="color:#999;text-align:center;padding:16px">No active quotes</td></tr>'}
</table>

<h2>Pending Payments ({len(payments)})</h2>
<table><tr><th>Order</th><th>Client</th><th>Location</th><th>Fee</th><th>Age</th></tr>
{rows_p or '<tr><td colspan=5 style="color:#999;text-align:center;padding:16px">No pending payments</td></tr>'}
</table>
</body></html>'''
    return html, 200

# ─── CRON ─────────────────────────────────────────────────────────────────────

@app.route('/cron', methods=['POST'])
def cron():
    secret = request.headers.get('X-Cron-Secret', '')
    if CRON_SECRET and secret != CRON_SECRET:
        return 'Forbidden', 403

    businesses = store.get_all_businesses()
    if not businesses:
        businesses = [store.get_business_by_slug('golfcartrentalscr') or {}]

    for biz in businesses:
        if not biz.get('active', True):
            continue
        sender = biz.get('twilio_sender', TWILIO_WA_NUMBER)
        cleanup_expired_entries(biz)
        send_provider_followups(biz, sender)
        send_cold_lead_followups(biz, sender)
        handle_provider_timeout(biz, sender)

    return jsonify({'status': 'ok', 'ts': datetime.utcnow().isoformat()}), 200

# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return {'status': 'ok', 'agent': 'Okapi Platform',
            'ts': datetime.utcnow().isoformat()}

# ─── WEB PLATFORM ─────────────────────────────────────────────────────────────

from web_platform import web_bp
app.register_blueprint(web_bp)

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
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
