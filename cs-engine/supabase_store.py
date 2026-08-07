"""
Supabase-backed storage — drop-in replacement for all JSON file functions.
All public functions maintain the same signatures as the original implementations.
"""

import base64
import os
import secrets as _secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

try:
    from supabase import create_client, Client
    print("[supabase_store] supabase package imported OK", flush=True)
except ImportError as _e:
    print(f"[supabase_store] FATAL: supabase not installed: {_e}", flush=True)
    raise

# ─── FIELD ENCRYPTION (AES-256-GCM) ─────────────────────────────────────────
# Format: base64(nonce[12] + tag[16] + ciphertext[n])  — compatible with panel TS impl
_ENC_KEY_HEX = os.environ.get('ENCRYPTION_KEY', '')
_ENC_KEY      = bytes.fromhex(_ENC_KEY_HEX) if len(_ENC_KEY_HEX) == 64 else None
_SENSITIVE    = {'meta_access_token', 'twilio_auth_token'}

def _encrypt_field(value: str) -> str:
    if not _ENC_KEY or not value:
        return value
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        nonce = _secrets.token_bytes(12)
        ct_tag = AESGCM(_ENC_KEY).encrypt(nonce, value.encode(), None)
        ct, tag = ct_tag[:-16], ct_tag[-16:]
        return base64.b64encode(nonce + tag + ct).decode()
    except Exception as e:
        print(f'  ⚠ encrypt_field: {e}', flush=True)
        return value

def _decrypt_field(value: str) -> str:
    if not _ENC_KEY or not value:
        return value
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        buf = base64.b64decode(value)
        nonce, tag, ct = buf[:12], buf[12:28], buf[28:]
        return AESGCM(_ENC_KEY).decrypt(nonce, ct + tag, None).decode()
    except Exception:
        return value  # plaintext fallback during migration window

def _decrypt_business(biz: Optional[dict]) -> Optional[dict]:
    if not biz or not _ENC_KEY:
        return biz
    result = dict(biz)
    for f in _SENSITIVE:
        if result.get(f):
            result[f] = _decrypt_field(result[f])
    return result

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://bzdaxldhvxsnolzkcgrs.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZGF4bGRodnhzbm9semtjZ3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc2NjcxMSwiZXhwIjoyMDk4MzQyNzExfQ.ZqK1LOuN-aEmjA4J2oCBfUY-q3d5vm4ZLPIr8v3rQWI')

DEFAULT_BUSINESS_SLUG = os.getenv('DEFAULT_BUSINESS_SLUG', 'golfcartrentalscr')

# Some Supabase schemas use 'history' instead of 'messages' for the conversation JSONB column
_HIST_COL = os.getenv('HISTORY_COLUMN', 'messages')
_TS_COL   = os.getenv('LAST_MSG_COL', 'last_message_at')

_client: Optional[Client] = None
_default_business_id: Optional[str] = None


def _sb() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


# ─── BUSINESS HELPERS ────────────────────────────────────────────────────────

def get_default_business_id() -> Optional[str]:
    global _default_business_id
    if _default_business_id:
        return _default_business_id
    try:
        r = _sb().table('businesses').select('id').eq('slug', DEFAULT_BUSINESS_SLUG).limit(1).execute()
        if r.data:
            _default_business_id = r.data[0]['id']
    except Exception as e:
        print(f'  ⚠ Could not get default business ID: {e}')
    return _default_business_id


def _bid(business_id: Optional[str] = None) -> Optional[str]:
    return business_id or get_default_business_id()


def get_business_by_slug(slug: str) -> Optional[dict]:
    try:
        r = _sb().table('businesses').select('*').eq('slug', slug).eq('active', True).limit(1).execute()
        return _decrypt_business(r.data[0]) if r.data else None
    except Exception as e:
        print(f'  ⚠ get_business_by_slug({slug}): {e}')
        return None


def get_business_by_meta_phone_number_id(phone_number_id: str) -> Optional[dict]:
    try:
        r = _sb().table('businesses').select('*').eq('meta_phone_number_id', phone_number_id).eq('active', True).limit(1).execute()
        return _decrypt_business(r.data[0]) if r.data else None
    except Exception as e:
        print(f'  ⚠ get_business_by_meta_phone_number_id({phone_number_id}): {e}')
        return None


def get_all_businesses() -> list:
    try:
        r = _sb().table('businesses').select('*').order('name').execute()
        return [_decrypt_business(b) for b in (r.data or [])]
    except Exception as e:
        print(f'  ⚠ get_all_businesses: {e}')
        return []


def create_business(data: dict) -> Optional[dict]:
    try:
        r = _sb().table('businesses').insert(data).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ create_business: {e}')
        return None


def update_business(business_id: str, data: dict) -> bool:
    try:
        _sb().table('businesses').update(data).eq('id', business_id).execute()
        return True
    except Exception as e:
        print(f'  ⚠ update_business: {e}')
        return False


# ─── LEAD HELPERS ────────────────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    """Strip whatsapp: prefix so Twilio and Meta formats match."""
    return phone.replace('whatsapp:', '').strip() if phone else phone


def _get_or_create_lead(phone: str, business_id: str) -> Optional[str]:
    phone = _normalize_phone(phone)
    now = datetime.utcnow().isoformat()
    try:
        r = _sb().table('leads').select('id').eq('phone', phone).eq('business_id', business_id).limit(1).execute()
        if r.data:
            lid = r.data[0]['id']
            _sb().table('leads').update({'last_active_at': now}).eq('id', lid).execute()
            return lid
        ins = _sb().table('leads').insert({
            'phone': phone, 'business_id': business_id,
            'status': 'new', 'last_active_at': now,
        }).execute()
        return ins.data[0]['id'] if ins.data else None
    except Exception as e:
        # Unique constraint violation — concurrent insert won the race, re-query
        if '23505' in str(e) or 'duplicate' in str(e).lower():
            try:
                r = _sb().table('leads').select('id').eq('phone', phone).eq('business_id', business_id).limit(1).execute()
                return r.data[0]['id'] if r.data else None
            except Exception as e2:
                print(f'  ⚠ _get_or_create_lead retry: {e2}')
                return None
        print(f'  ⚠ _get_or_create_lead: {e}')
        return None


def update_lead_info(phone: str, data: dict, business_id: Optional[str] = None):
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('leads').update(data).eq('phone', phone).eq('business_id', b).execute()
    except Exception as e:
        print(f'  ⚠ update_lead_info: {e}')


def update_lead_status(phone: str, status: str, business_id: Optional[str] = None):
    update_lead_info(phone, {'status': status}, business_id)


def mark_follow_up_sent(phone: str, business_id: Optional[str] = None):
    update_lead_info(phone, {'follow_up_sent_at': datetime.utcnow().isoformat()}, business_id)


def mark_follow_up_responded(phone: str, business_id: Optional[str] = None):
    update_lead_info(phone, {'follow_up_responded': True, 'status': 'active'}, business_id)


def get_leads(business_id: Optional[str] = None, status: Optional[str] = None,
              limit: int = 200) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        q = _sb().table('leads').select('*').eq('business_id', b).order('last_active_at', desc=True).limit(limit)
        if status:
            q = q.eq('status', status)
        r = q.execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_leads: {e}')
        return []


def get_lead_by_phone(phone: str, business_id: Optional[str] = None) -> Optional[dict]:
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('leads').select('*').eq('phone', phone).eq('business_id', b).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_lead_by_phone: {e}')
        return None


def delete_lead(phone: str, business_id: Optional[str] = None) -> bool:
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return False
    try:
        _sb().table('conversations').delete().eq('phone', phone).eq('business_id', b).execute()
        _sb().table('leads').delete().eq('phone', phone).eq('business_id', b).execute()
        return True
    except Exception as e:
        print(f'  ⚠ delete_lead: {e}')
        return False


def update_lead_fields_if_empty(phone: str, fields: dict, business_id: Optional[str] = None):
    """Update lead fields only if they are currently null/empty — never overwrite existing data."""
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b or not fields:
        return
    try:
        r = _sb().table('leads').select('name,email,phone').eq('phone', phone).eq('business_id', b).limit(1).execute()
        if not r.data:
            return
        current = r.data[0]
        to_update = {k: v for k, v in fields.items() if v and not current.get(k)}
        if to_update:
            _sb().table('leads').update(to_update).eq('phone', phone).eq('business_id', b).execute()
            print(f'  ✓ Lead fields updated: {list(to_update.keys())}')
    except Exception as e:
        print(f'  ⚠ update_lead_fields_if_empty: {e}')


# ─── CONVERSATION STORE ───────────────────────────────────────────────────────

def get_history(phone: str, business_id: Optional[str] = None) -> list:
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('conversations').select(_HIST_COL).eq('phone', phone).eq('business_id', b).limit(1).execute()
        return r.data[0].get(_HIST_COL, []) if r.data else []
    except Exception as e:
        print(f'  ⚠ get_history: {e}')
        return []


def append_message(phone: str, role: str, content: str, business_id: Optional[str] = None,
                   wam_id: Optional[str] = None):
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return
    now = datetime.utcnow().isoformat() + 'Z'
    new_msg: dict = {'role': role, 'content': content, 'ts': now}
    if wam_id:
        new_msg['wam_id'] = wam_id
    try:
        lead_id = _get_or_create_lead(phone, b)
        if lead_id:
            _sb().table('leads').update({'last_active_at': now}).eq('id', lead_id).execute()

        r = _sb().table('conversations').select(f'id,{_HIST_COL}').eq('phone', phone).eq('business_id', b).limit(1).execute()
        if r.data:
            msgs = r.data[0].get(_HIST_COL, [])
            msgs.append(new_msg)
            if len(msgs) > 30:
                msgs = msgs[-30:]
            _sb().table('conversations').update({_HIST_COL: msgs, _TS_COL: now}).eq('id', r.data[0]['id']).execute()
        else:
            try:
                _sb().table('conversations').insert({
                    'phone': phone, 'business_id': b, 'lead_id': lead_id,
                    _HIST_COL: [new_msg], _TS_COL: now,
                }).execute()
            except Exception as ins_e:
                # Race: another thread created it first — just update
                if '23505' in str(ins_e) or 'duplicate' in str(ins_e).lower():
                    r2 = _sb().table('conversations').select(f'id,{_HIST_COL}').eq('phone', phone).eq('business_id', b).limit(1).execute()
                    if r2.data:
                        msgs = r2.data[0].get(_HIST_COL, []) + [new_msg]
                        if len(msgs) > 30:
                            msgs = msgs[-30:]
                        _sb().table('conversations').update({_HIST_COL: msgs, _TS_COL: now}).eq('id', r2.data[0]['id']).execute()
                else:
                    raise
    except Exception as e:
        print(f'  ⚠ append_message: {e}')


def clear_history(phone: str, business_id: Optional[str] = None):
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('conversations').update({_HIST_COL: [], 'status': 'active'}).eq('phone', phone).eq('business_id', b).execute()
        update_lead_status(phone, 'new', b)
    except Exception as e:
        print(f'  ⚠ clear_history: {e}')


def get_ai_enabled(phone: str, business_id: Optional[str] = None) -> bool:
    """Return False if AI auto-reply has been disabled for this conversation."""
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return True
    try:
        r = _sb().table('conversations').select('ai_enabled').eq('phone', phone).eq('business_id', b).limit(1).execute()
        if r.data:
            val = r.data[0].get('ai_enabled')
            return val if val is not None else True
        return True
    except Exception as e:
        print(f'  ⚠ get_ai_enabled: {e}')
        return True


def set_ai_enabled(phone: str, enabled: bool, business_id: Optional[str] = None):
    """Enable or disable AI auto-reply for a specific conversation."""
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('conversations').update({'ai_enabled': enabled}).eq('phone', phone).eq('business_id', b).execute()
        print(f'  {"✓" if enabled else "⏸"} AI {"enabled" if enabled else "disabled"} for {phone}', flush=True)
    except Exception as e:
        print(f'  ⚠ set_ai_enabled: {e}')


def upsert_message_status(wam_id: str, phone: str, status: str, business_id: Optional[str] = None):
    """Track delivery/read status for a sent WhatsApp message."""
    b = _bid(business_id)
    if not b or not wam_id:
        return
    try:
        from datetime import datetime as _dt
        _sb().table('message_statuses').upsert({
            'wam_id': wam_id, 'business_id': b, 'phone': _normalize_phone(phone),
            'status': status, 'updated_at': _dt.utcnow().isoformat() + 'Z',
        }).execute()
    except Exception as e:
        print(f'  ⚠ upsert_message_status: {e}')


def get_conversations(business_id: Optional[str] = None, limit: int = 100) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('conversations').select('*').eq('business_id', b).order(_TS_COL, desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_conversations: {e}')
        return []


def get_conversation_by_phone(phone: str, business_id: Optional[str] = None) -> Optional[dict]:
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('conversations').select('*').eq('phone', phone).eq('business_id', b).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_conversation_by_phone: {e}')
        return None


# ─── PENDING QUOTES STORE ────────────────────────────────────────────────────

def add_pending_quote(provider_number: str, client_number: str, booking_text: str,
                      business_id: Optional[str] = None, commission_pct: float = 10.0):
    b = _bid(business_id)
    if not b:
        return
    now = datetime.utcnow().isoformat()
    try:
        lead_id = _get_or_create_lead(client_number, b)
        r = _sb().table('conversations').select('id').eq('phone', client_number).eq('business_id', b).limit(1).execute()
        conv_id = r.data[0]['id'] if r.data else None

        _sb().table('bookings').insert({
            'business_id': b,
            'lead_id': lead_id,
            'conversation_id': conv_id,
            'client_phone': client_number,
            'booking_text': booking_text,
            'provider_number': provider_number,
            'payment_status': 'pending',
            'commission_negotiation_status': 'pending',
            'commission_pct_offered': commission_pct,
            'link_sent': False,
            'follow_up_sent': False,
            'provider_contacted_at': now,
            'created_at': now,
        }).execute()
        print(f'  ✓ Pending quote in DB: provider={provider_number} → client={client_number}')
    except Exception as e:
        print(f'  ⚠ add_pending_quote: {e}')


def get_pending_quote(provider_number: str, business_id: Optional[str] = None) -> Optional[dict]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('bookings').select('*').eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').order('created_at', desc=True).limit(1).execute()
        if r.data:
            row = r.data[0]
            return {
                'client':             row.get('client_phone', ''),
                'booking':            row.get('booking_text', ''),
                'link_sent':          row.get('link_sent', False),
                'follow_up_sent':     row.get('follow_up_sent', False),
                'fee':                row.get('fee_amount'),
                'currency':           row.get('currency', 'USD'),
                'commission_status':  row.get('commission_negotiation_status', 'accepted'),
                'commission_pct':     row.get('commission_pct_offered', 10.0),
                'ts':                 row.get('created_at', ''),
                '_booking_id':        row['id'],
            }
        return None
    except Exception as e:
        print(f'  ⚠ get_pending_quote: {e}')
        return None


def mark_quote_link_sent(provider_number: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({'link_sent': True}).eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').execute()
    except Exception as e:
        print(f'  ⚠ mark_quote_link_sent: {e}')


def update_pending_quote_fee(provider_number: str, fee: float, currency: str,
                              business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({'fee_amount': fee, 'currency': currency}).eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').execute()
    except Exception as e:
        print(f'  ⚠ update_pending_quote_fee: {e}')


def update_commission_status(provider_number: str, status: str,
                              counter_offer: Optional[float] = None,
                              final_pct: Optional[float] = None,
                              business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        data: dict = {'commission_negotiation_status': status}
        if counter_offer is not None:
            data['commission_counter_offer'] = counter_offer
        if final_pct is not None:
            data['commission_pct_final'] = final_pct
        if status == 'accepted':
            now = datetime.utcnow().isoformat()
            data['provider_responded_at'] = now
        _sb().table('bookings').update(data).eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').execute()
    except Exception as e:
        print(f'  ⚠ update_commission_status: {e}')


def get_pending_quote_for_client(client_phone: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return None, None
    try:
        r = _sb().table('bookings').select('*').eq('client_phone', client_phone).eq('business_id', b).eq('payment_status', 'pending').eq('link_sent', False).order('created_at', desc=True).limit(1).execute()
        if r.data:
            row = r.data[0]
            q = {
                'client':            row.get('client_phone', ''),
                'booking':           row.get('booking_text', ''),
                'link_sent':         row.get('link_sent', False),
                'follow_up_sent':    row.get('follow_up_sent', False),
                'fee':               row.get('fee_amount'),
                'currency':          row.get('currency', 'USD'),
                'commission_status': row.get('commission_negotiation_status', 'accepted'),
                'commission_pct':    row.get('commission_pct_offered', 10.0),
                'ts':                row.get('created_at', ''),
                '_booking_id':       row['id'],
            }
            return row.get('provider_number', ''), q
        return None, None
    except Exception as e:
        print(f'  ⚠ get_pending_quote_for_client: {e}')
        return None, None


def clear_pending_quote(provider_number: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({'payment_status': 'cancelled'}).eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').execute()
    except Exception as e:
        print(f'  ⚠ clear_pending_quote: {e}')


def get_all_pending_quotes(business_id: Optional[str] = None) -> dict:
    b = _bid(business_id)
    if not b:
        return {}
    try:
        r = _sb().table('bookings').select('*').eq('business_id', b).eq('payment_status', 'pending').execute()
        out = {}
        for row in (r.data or []):
            pn = row.get('provider_number', '')
            if pn:
                out[pn] = {
                    'client':            row.get('client_phone', ''),
                    'booking':           row.get('booking_text', ''),
                    'link_sent':         row.get('link_sent', False),
                    'follow_up_sent':    row.get('follow_up_sent', False),
                    'fee':               row.get('fee_amount'),
                    'currency':          row.get('currency', 'USD'),
                    'commission_status': row.get('commission_negotiation_status', 'accepted'),
                    'commission_pct':    row.get('commission_pct_offered', 10.0),
                    'ts':                row.get('created_at', ''),
                    '_booking_id':       row['id'],
                }
        return out
    except Exception as e:
        print(f'  ⚠ get_all_pending_quotes: {e}')
        return {}


# ─── PENDING PAYMENTS STORE ──────────────────────────────────────────────────

def add_pending_payment(order_number: str, client_phone: str, provider_number: str,
                        full_booking: str, fee_amount: float,
                        business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({
            'order_number':     order_number,
            'fee_amount':       fee_amount,
            'payment_processed': False,
        }).eq('provider_number', provider_number).eq('client_phone', client_phone).eq('business_id', b).eq('payment_status', 'pending').execute()
        print(f'  ✓ Pending payment in DB: order={order_number}')
    except Exception as e:
        print(f'  ⚠ add_pending_payment: {e}')


def get_pending_payment(order_number: str, business_id: Optional[str] = None) -> Optional[dict]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('bookings').select('*').eq('order_number', order_number).limit(1).execute()
        if r.data:
            row = r.data[0]
            return {
                'client':    row.get('client_phone', ''),
                'provider':  row.get('provider_number', ''),
                'booking':   row.get('booking_text', ''),
                'fee':       row.get('fee_amount', 0),
                'processed': row.get('payment_processed', False),
                'ts':        row.get('created_at', ''),
            }
        return None
    except Exception as e:
        print(f'  ⚠ get_pending_payment: {e}')
        return None


def mark_payment_processed(order_number: str, business_id: Optional[str] = None):
    try:
        _sb().table('bookings').update({'payment_processed': True}).eq('order_number', order_number).eq('payment_processed', False).execute()
    except Exception as e:
        print(f'  ⚠ mark_payment_processed: {e}')


def clear_pending_payment(order_number: str, business_id: Optional[str] = None):
    pass  # No-op — row stays for audit; status updated by confirmed flow


def get_all_pending_payments(business_id: Optional[str] = None) -> dict:
    b = _bid(business_id)
    if not b:
        return {}
    try:
        r = _sb().table('bookings').select('*').eq('business_id', b).eq('payment_status', 'pending').execute()
        out = {}
        for row in (r.data or []):
            on = row.get('order_number')
            if on:
                out[on] = {
                    'client':    row.get('client_phone', ''),
                    'provider':  row.get('provider_number', ''),
                    'booking':   row.get('booking_text', ''),
                    'fee':       row.get('fee_amount', 0),
                    'processed': row.get('payment_processed', False),
                    'ts':        row.get('created_at', ''),
                }
        return out
    except Exception as e:
        print(f'  ⚠ get_all_pending_payments: {e}')
        return {}


# ─── CONFIRMED BOOKINGS STORE ────────────────────────────────────────────────

def add_confirmed_booking(client_phone: str, order_number: str,
                          provider_number: str, booking_text: str,
                          fee_paid: float, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        now = datetime.utcnow().isoformat()
        rental = round(fee_paid / 0.10, 2)
        _sb().table('bookings').update({
            'payment_status':    'paid',
            'payment_processed': True,
            'paid_at':           now,
            'rental_amount':     rental,
        }).eq('order_number', order_number).execute()
        _sb().table('leads').update({'status': 'booked'}).eq('phone', client_phone).eq('business_id', b).execute()
        _sb().table('conversations').update({'status': 'booked'}).eq('phone', client_phone).eq('business_id', b).execute()
    except Exception as e:
        print(f'  ⚠ add_confirmed_booking: {e}')


def get_confirmed_booking(client_phone: str, business_id: Optional[str] = None) -> Optional[dict]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('bookings').select('*').eq('client_phone', client_phone).eq('business_id', b).eq('payment_status', 'paid').order('created_at', desc=True).limit(1).execute()
        if r.data:
            row = r.data[0]
            return {
                'order':    row.get('order_number', ''),
                'provider': row.get('provider_number', ''),
                'booking':  row.get('booking_text', ''),
                'fee_paid': row.get('fee_amount', 0),
                'status':   'confirmed',
                'ts':       row.get('created_at', ''),
            }
        return None
    except Exception as e:
        print(f'  ⚠ get_confirmed_booking: {e}')
        return None


def clear_confirmed_booking(client_phone: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({'payment_status': 'cancelled'}).eq('client_phone', client_phone).eq('business_id', b).eq('payment_status', 'paid').execute()
        _sb().table('leads').update({'status': 'lost'}).eq('phone', client_phone).eq('business_id', b).execute()
    except Exception as e:
        print(f'  ⚠ clear_confirmed_booking: {e}')


# ─── PENDING CANCELLATIONS STORE ─────────────────────────────────────────────

def add_pending_cancellation(client_phone: str, booking_type: str,
                             provider_number: str, booking_text: str,
                             order_number: str = '', business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('pending_cancellations').delete().eq('client_phone', client_phone).execute()
        _sb().table('pending_cancellations').insert({
            'client_phone':   client_phone,
            'business_id':    b,
            'type':           booking_type,
            'order_number':   order_number,
            'provider_number': provider_number,
            'booking_text':   booking_text,
        }).execute()
    except Exception as e:
        print(f'  ⚠ add_pending_cancellation: {e}')


def get_pending_cancellation(client_phone: str, business_id: Optional[str] = None) -> Optional[dict]:
    try:
        r = _sb().table('pending_cancellations').select('*').eq('client_phone', client_phone).limit(1).execute()
        if r.data:
            row = r.data[0]
            return {
                'type':     row.get('type', ''),
                'order':    row.get('order_number', ''),
                'provider': row.get('provider_number', ''),
                'booking':  row.get('booking_text', ''),
                'ts':       row.get('created_at', ''),
            }
        return None
    except Exception as e:
        print(f'  ⚠ get_pending_cancellation: {e}')
        return None


def clear_pending_cancellation(client_phone: str, business_id: Optional[str] = None):
    try:
        _sb().table('pending_cancellations').delete().eq('client_phone', client_phone).execute()
    except Exception as e:
        print(f'  ⚠ clear_pending_cancellation: {e}')


# ─── PROVIDER HELPERS ────────────────────────────────────────────────────────

def get_providers_for_business(business_id: Optional[str] = None) -> dict:
    """Return {location_name_lower: whatsapp_number} for active providers."""
    b = _bid(business_id)
    if not b:
        return {}
    try:
        r = _sb().table('providers').select('location_name,whatsapp_number').eq('business_id', b).eq('active', True).execute()
        return {row['location_name'].lower(): row['whatsapp_number'] for row in (r.data or [])}
    except Exception as e:
        print(f'  ⚠ get_providers_for_business: {e}')
        return {}


def get_next_provider(location_name: str, exclude_number: str,
                      business_id: Optional[str] = None) -> Optional[str]:
    """Return next active provider for a location, excluding the given number."""
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('providers').select('whatsapp_number').eq('business_id', b).eq('active', True).ilike('location_name', f'%{location_name}%').neq('whatsapp_number', exclude_number).order('acceptance_rate', desc=True).limit(1).execute()
        return r.data[0]['whatsapp_number'] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_next_provider: {e}')
        return None


def get_provider_by_number(whatsapp_number: str, business_id: Optional[str] = None) -> Optional[dict]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        q = _sb().table('providers').select('*').eq('whatsapp_number', whatsapp_number)
        if b:
            q = q.eq('business_id', b)
        r = q.limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_provider_by_number: {e}')
        return None


def get_providers_list(business_id: Optional[str] = None) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('providers').select('*').eq('business_id', b).order('location_name').execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_providers_list: {e}')
        return []


def upsert_provider(data: dict) -> Optional[dict]:
    try:
        r = _sb().table('providers').upsert(data).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ upsert_provider: {e}')
        return None


def update_provider(provider_id: str, data: dict) -> bool:
    try:
        _sb().table('providers').update(data).eq('id', provider_id).execute()
        return True
    except Exception as e:
        print(f'  ⚠ update_provider: {e}')
        return False


# ─── BOOKINGS ADMIN ──────────────────────────────────────────────────────────

def get_bookings(business_id: Optional[str] = None, status: Optional[str] = None,
                 payment_status: Optional[str] = None, limit: int = 200) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        q = _sb().table('bookings').select('*').eq('business_id', b).order('created_at', desc=True).limit(limit)
        if payment_status:
            q = q.eq('payment_status', payment_status)
        r = q.execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_bookings: {e}')
        return []


def get_booking_by_id(booking_id: str) -> Optional[dict]:
    try:
        r = _sb().table('bookings').select('*').eq('id', booking_id).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_booking_by_id: {e}')
        return None


def update_booking(booking_id: str, data: dict) -> bool:
    try:
        _sb().table('bookings').update(data).eq('id', booking_id).execute()
        return True
    except Exception as e:
        print(f'  ⚠ update_booking: {e}')
        return False


# ─── ANALYTICS ───────────────────────────────────────────────────────────────

def get_analytics(business_id: Optional[str] = None, days: int = 30) -> dict:
    b = _bid(business_id)
    if not b:
        return {}
    try:
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        today = datetime.utcnow().strftime('%Y-%m-%d')

        leads_r = _sb().table('leads').select('id,status').eq('business_id', b).execute()
        leads = leads_r.data or []

        book_r = _sb().table('bookings').select('id,payment_status,fee_amount,paid_at').eq('business_id', b).gte('created_at', since).execute()
        bookings = book_r.data or []

        total_leads   = len(leads)
        active_leads  = sum(1 for l in leads if l['status'] == 'active')
        booked_leads  = sum(1 for l in leads if l['status'] == 'booked')
        lost_leads    = sum(1 for l in leads if l['status'] == 'lost')
        paid          = [bk for bk in bookings if bk['payment_status'] == 'paid']
        revenue_mtd   = sum(bk.get('fee_amount') or 0 for bk in paid)
        bookings_today = sum(1 for bk in paid if (bk.get('paid_at') or '')[:10] == today)
        conv_rate     = round(booked_leads / total_leads * 100, 1) if total_leads else 0

        return {
            'total_leads':        total_leads,
            'active_leads':       active_leads,
            'booked_leads':       booked_leads,
            'lost_leads':         lost_leads,
            'revenue_mtd':        round(revenue_mtd, 2),
            'bookings_today':     bookings_today,
            'conversion_rate':    conv_rate,
            'paid_bookings_count': len(paid),
        }
    except Exception as e:
        print(f'  ⚠ get_analytics: {e}')
        return {}


def get_monthly_trend(business_id: Optional[str] = None, months: int = 6) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        since = (datetime.utcnow() - timedelta(days=months * 30)).isoformat()
        r = _sb().table('bookings').select('payment_status,fee_amount,paid_at,created_at').eq('business_id', b).gte('created_at', since).execute()
        monthly: dict = {}
        for row in (r.data or []):
            month = (row.get('created_at') or '')[:7]
            if month not in monthly:
                monthly[month] = {'month': month, 'bookings': 0, 'revenue': 0}
            if row.get('payment_status') == 'paid':
                monthly[month]['bookings'] += 1
                monthly[month]['revenue'] += row.get('fee_amount') or 0
        return sorted(monthly.values(), key=lambda x: x['month'])
    except Exception as e:
        print(f'  ⚠ get_monthly_trend: {e}')
        return []


# ─── PROMPT VERSIONS ─────────────────────────────────────────────────────────

def save_prompt_version(prompt_text: str, business_id: Optional[str] = None,
                        created_by: str = 'admin') -> bool:
    b = _bid(business_id)
    if not b:
        return False
    try:
        _sb().table('prompt_versions').update({'is_active': False}).eq('business_id', b).execute()
        _sb().table('prompt_versions').insert({
            'business_id':     b,
            'prompt_snapshot': prompt_text,
            'created_by':      created_by,
            'is_active':       True,
        }).execute()
        _sb().table('businesses').update({'base_prompt': prompt_text}).eq('id', b).execute()
        return True
    except Exception as e:
        print(f'  ⚠ save_prompt_version: {e}')
        return False


def get_prompt_versions(business_id: Optional[str] = None, limit: int = 10) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('prompt_versions').select('id,created_at,created_by,is_active').eq('business_id', b).order('created_at', desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_prompt_versions: {e}')
        return []


def get_prompt_version(version_id: str) -> Optional[str]:
    try:
        r = _sb().table('prompt_versions').select('prompt_snapshot').eq('id', version_id).limit(1).execute()
        return r.data[0]['prompt_snapshot'] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_prompt_version: {e}')
        return None


def get_active_prompt(business_id: Optional[str] = None) -> Optional[str]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        # Try prompt_versions first (managed by admin panel)
        r = _sb().table('prompt_versions').select('prompt_snapshot') \
            .eq('business_id', b).eq('is_active', True) \
            .order('created_at', desc=True).limit(1).execute()
        if r.data and r.data[0].get('prompt_snapshot'):
            return r.data[0]['prompt_snapshot']
        # Fallback to businesses.base_prompt
        r2 = _sb().table('businesses').select('base_prompt').eq('id', b).limit(1).execute()
        return (r2.data[0].get('base_prompt') if r2.data else None) or None
    except Exception as e:
        print(f'  ⚠ get_active_prompt: {e}')
        return None


def get_product_images(business_id: Optional[str] = None) -> dict:
    """Return {name_lower: image_url} for all price_items with an image."""
    b = _bid(business_id)
    if not b:
        return {}
    try:
        r = _sb().table('price_items').select('name,image_url') \
            .eq('business_id', b).not_.is_('image_url', 'null').execute()
        return {row['name'].lower(): row['image_url'] for row in (r.data or []) if row.get('image_url')}
    except Exception as e:
        print(f'  ⚠ get_product_images: {e}')
        return {}


def get_product_pdfs(business_id: Optional[str] = None) -> dict:
    """Return {name_lower: (file_url, filename)} for products that have a PDF document."""
    b = _bid(business_id)
    if not b:
        return {}
    try:
        items_r = _sb().table('price_items').select('id,name').eq('business_id', b).execute()
        id_to_name = {row['id']: row['name'] for row in (items_r.data or [])}
        docs_r = _sb().table('product_documents').select('price_item_id,file_url,filename') \
            .eq('business_id', b).eq('doc_type', 'product') \
            .not_.is_('price_item_id', 'null').not_.is_('file_url', 'null').execute()
        result = {}
        for row in (docs_r.data or []):
            name = id_to_name.get(row['price_item_id'])
            if name and row.get('file_url'):
                result[name.lower()] = (row['file_url'], row.get('filename', 'ficha_tecnica.pdf'))
        return result
    except Exception as e:
        print(f'  ⚠ get_product_pdfs: {e}')
        return {}


def get_categories_keywords(business_id: Optional[str] = None) -> list:
    """Return [{id, name, product_keywords}] for all categories of a business."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('product_categories').select('id,name,product_keywords') \
            .eq('business_id', b).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_categories_keywords: {e}')
        return []


def get_product_context(business_id: Optional[str], product_interest: Optional[str]) -> dict:
    """Return context for detected product/category of interest.
    Tries category-level match first, then falls back to per-product match.
    Category context returns: category_name, prompt_instructions, products[], documents[]
    Per-product context returns: product_name, price, currency, prompt_snippet, documents[]
    """
    if not product_interest:
        return {}
    b = _bid(business_id)
    if not b:
        return {}
    kw_lower = product_interest.lower()
    try:
        # ── 1. Try matching a product category ───────────────────────────────
        cat_r = _sb().table('product_categories').select('*').eq('business_id', b).execute()
        categories = cat_r.data or []

        matched_cat = None
        for cat in categories:
            keywords = cat.get('product_keywords') or []
            if any(k.lower() in kw_lower or kw_lower in k.lower() for k in keywords):
                matched_cat = cat
                break
        if not matched_cat:
            for cat in categories:
                if cat['name'].lower() in kw_lower or kw_lower in cat['name'].lower():
                    matched_cat = cat
                    break

        if matched_cat:
            prod_r = _sb().table('price_items') \
                .select('id,name,model_code,price,currency,description') \
                .eq('business_id', b).eq('category_id', matched_cat['id']).eq('active', True).execute()
            doc_r = _sb().table('product_documents').select('content_text,filename') \
                .eq('category_id', matched_cat['id']).execute()
            return {
                'category_name': matched_cat['name'],
                'prompt_instructions': matched_cat.get('prompt_instructions') or '',
                'products': prod_r.data or [],
                'documents': [{'filename': x['filename'], 'text': x['content_text']}
                              for x in (doc_r.data or [])],
            }

        # ── 2. Fall back to per-product matching ─────────────────────────────
        r = _sb().table('price_items').select('id,name,prompt_snippet,product_keywords,price,currency') \
            .eq('business_id', b).eq('active', True).execute()
        items = r.data or []

        matched = None
        for item in items:
            keywords = item.get('product_keywords') or []
            if any(k.lower() in kw_lower or kw_lower in k.lower() for k in keywords):
                matched = item
                break
        if not matched:
            for item in items:
                if item['name'].lower() in kw_lower or kw_lower in item['name'].lower():
                    matched = item
                    break
        if not matched:
            return {}

        d = _sb().table('product_documents').select('content_text,filename') \
            .eq('price_item_id', matched['id']).execute()
        docs = d.data or []
        return {
            'product_name': matched['name'],
            'price': matched.get('price'),
            'currency': matched.get('currency', 'USD'),
            'prompt_snippet': matched.get('prompt_snippet') or '',
            'documents': [{'filename': x['filename'], 'text': x['content_text']} for x in docs],
        }
    except Exception as e:
        print(f'  ⚠ get_product_context: {e}')
        return {}


def get_business_documents(business_id: Optional[str] = None) -> list:
    """Return all general (doc_type='general') business documents for context injection."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('product_documents').select('content_text,filename') \
            .eq('business_id', b).eq('doc_type', 'general').execute()
        return [{'filename': x['filename'], 'text': x['content_text']}
                for x in (r.data or []) if x.get('content_text')]
    except Exception as e:
        print(f'  ⚠ get_business_documents: {e}')
        return []


# ─── MEDAGENT ────────────────────────────────────────────────────────────────

def get_or_create_patient(phone: str, business_id: str) -> Optional[dict]:
    norm = _normalize_phone(phone)
    try:
        r = _sb().table('patients').select('*').eq('business_id', business_id).eq('phone', norm).limit(1).execute()
        if r.data:
            return r.data[0]
        ins = _sb().table('patients').insert({'business_id': business_id, 'phone': norm}).execute()
        return ins.data[0] if ins.data else None
    except Exception as e:
        print(f'  ⚠ get_or_create_patient: {e}')
        return None

def update_patient(patient_id: str, data: dict) -> bool:
    try:
        _sb().table('patients').update(data).eq('id', patient_id).execute()
        return True
    except Exception as e:
        print(f'  ⚠ update_patient: {e}')
        return False

def get_doctors(business_id: str) -> list:
    try:
        r = _sb().table('doctors').select('id,name,specialty,bio,med_services(id,name,duration_minutes,price,active)') \
            .eq('business_id', business_id).eq('active', True).order('name').execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_doctors: {e}')
        return []

def get_doctor_schedule(doctor_id: str) -> list:
    try:
        r = _sb().table('doctor_availability').select('*').eq('doctor_id', doctor_id).order('day_of_week').execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_doctor_schedule: {e}')
        return []

def get_appointments_for_doctor(doctor_id: str, date: str) -> list:
    try:
        r = _sb().table('appointments').select('start_time,end_time,status') \
            .eq('doctor_id', doctor_id).eq('date', date) \
            .in_('status', ['requested', 'confirmed']).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_appointments_for_doctor: {e}')
        return []

def create_appointment(data: dict) -> Optional[dict]:
    try:
        r = _sb().table('appointments').insert(data).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ create_appointment: {e}')
        return None

def get_patient_appointments(patient_id: str, limit: int = 5) -> list:
    try:
        r = _sb().table('appointments').select('date,start_time,status,doctors(name),med_services(name)') \
            .eq('patient_id', patient_id).order('date', desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_patient_appointments: {e}')
        return []

def get_appointments_needing_reminders(business_id: str, min_minutes: int, max_minutes: int, statuses: list = None) -> list:
    """Return upcoming appointments whose datetime falls between min_minutes and max_minutes from now (UTC).
    Only returns those where the corresponding reminder has not been sent yet.
    min/max_minutes determines which reminder window: 120±30 for 2h, 1440±30 for 24h.
    statuses: list of appointment statuses to include (default: ['requested', 'confirmed'])."""
    try:
        from datetime import date as _date, time as _time
        now = datetime.utcnow()
        window_start = (now + timedelta(minutes=min_minutes)).isoformat()
        window_end   = (now + timedelta(minutes=max_minutes)).isoformat()
        status_list  = statuses or ['requested', 'confirmed']
        # Fetch all non-terminal appointments in the next max_minutes
        r = _sb().table('appointments') \
            .select('id,business_id,date,start_time,status,reminder_24h_sent_at,reminder_2h_sent_at,patient_confirmed_at,patient_note,patients(name,phone),doctors(name,specialty),med_services(name,duration_minutes)') \
            .eq('business_id', business_id) \
            .in_('status', status_list) \
            .execute()
        results = []
        for appt in (r.data or []):
            try:
                appt_dt_str = f"{appt['date']}T{appt['start_time'][:5]}:00"
                appt_dt = datetime.fromisoformat(appt_dt_str)
                if window_start <= appt_dt_str <= window_end:
                    results.append(appt)
            except Exception:
                pass
        return results
    except Exception as e:
        print(f'  ⚠ get_appointments_needing_reminders: {e}')
        return []

def mark_reminder_sent(appointment_id: str, reminder_type: str) -> bool:
    """Mark reminder_24h_sent_at or reminder_2h_sent_at as sent now."""
    col = 'reminder_24h_sent_at' if reminder_type == '24h' else 'reminder_2h_sent_at'
    try:
        _sb().table('appointments').update({col: datetime.utcnow().isoformat()}).eq('id', appointment_id).execute()
        return True
    except Exception as e:
        print(f'  ⚠ mark_reminder_sent: {e}')
        return False

def get_next_pending_appointment_for_patient(phone: str, business_id: str) -> Optional[dict]:
    """Return the next confirmed/requested appointment for this patient (by phone), if any."""
    norm = _normalize_phone(phone)
    try:
        today = datetime.utcnow().date().isoformat()
        patient = _sb().table('patients').select('id').eq('business_id', business_id).eq('phone', norm).limit(1).execute()
        if not patient.data:
            return None
        pid = patient.data[0]['id']
        r = _sb().table('appointments') \
            .select('id,date,start_time,status,doctors(name),med_services(name)') \
            .eq('business_id', business_id).eq('patient_id', pid) \
            .in_('status', ['requested', 'confirmed']) \
            .gte('date', today) \
            .order('date').order('start_time').limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_next_pending_appointment_for_patient: {e}')
        return None


# ─── CLEANUP ─────────────────────────────────────────────────────────────────

def cleanup_expired_entries(business_id: Optional[str] = None, ttl_hours: int = 48):
    b = _bid(business_id)
    if not b:
        return
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=ttl_hours)).isoformat()
        r = _sb().table('bookings').update({'payment_status': 'cancelled'}).eq('business_id', b).eq('payment_status', 'pending').lt('created_at', cutoff).execute()
        if r.data:
            print(f'  🧹 Expired {len(r.data)} booking(s)')
    except Exception as e:
        print(f'  ⚠ cleanup_expired_entries: {e}')


def get_cold_leads(business_id: Optional[str] = None, hours: int = 24) -> list:
    """Leads with no follow-up sent and last_active older than `hours`."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        r = _sb().table('leads').select('*').eq('business_id', b).eq('status', 'active').is_('follow_up_sent_at', 'null').lt('last_active_at', cutoff).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_cold_leads: {e}')
        return []


def get_overdue_lost_leads(business_id: Optional[str] = None, hours: int = 48) -> list:
    """Leads where follow-up was sent but no response after `hours`."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        r = _sb().table('leads').select('*').eq('business_id', b).eq('status', 'active').eq('follow_up_responded', False).lt('follow_up_sent_at', cutoff).execute()
        # Only those where follow_up_sent_at is not null
        return [l for l in (r.data or []) if l.get('follow_up_sent_at')]
    except Exception as e:
        print(f'  ⚠ get_overdue_lost_leads: {e}')
        return []


def get_timed_out_providers(business_id: Optional[str] = None, hours: int = 4) -> list:
    """Bookings where provider was contacted but hasn't responded after `hours`."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        r = _sb().table('bookings').select('*').eq('business_id', b).eq('payment_status', 'pending').eq('commission_negotiation_status', 'pending').lt('provider_contacted_at', cutoff).eq('follow_up_sent', False).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_timed_out_providers: {e}')
        return []


def get_stale_provider_quotes(business_id: Optional[str] = None, hours: int = 2) -> dict:
    """Quotes where provider accepted commission but hasn't sent price after `hours`."""
    b = _bid(business_id)
    if not b:
        return {}
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        r = _sb().table('bookings').select('*').eq('business_id', b).eq('payment_status', 'pending').eq('commission_negotiation_status', 'accepted').eq('link_sent', False).eq('follow_up_sent', False).lt('provider_contacted_at', cutoff).execute()
        out = {}
        for row in (r.data or []):
            pn = row.get('provider_number', '')
            if pn:
                out[pn] = {
                    'client':        row.get('client_phone', ''),
                    'booking':       row.get('booking_text', ''),
                    'link_sent':     row.get('link_sent', False),
                    'follow_up_sent': row.get('follow_up_sent', False),
                    'ts':            row.get('created_at', ''),
                }
        return out
    except Exception as e:
        print(f'  ⚠ get_stale_provider_quotes: {e}')
        return {}


def mark_provider_followup_sent(provider_number: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('bookings').update({'follow_up_sent': True}).eq('provider_number', provider_number).eq('business_id', b).eq('payment_status', 'pending').execute()
    except Exception as e:
        print(f'  ⚠ mark_provider_followup_sent: {e}')


# ─── PROVIDER MESSAGE THREAD ─────────────────────────────────────────────────

def log_provider_message(booking_id: str, role: str, text: str,
                         business_id: Optional[str] = None):
    """Append a message to the provider_messages JSONB array on a booking."""
    try:
        r = _sb().table('bookings').select('provider_messages').eq('id', booking_id).limit(1).execute()
        if not r.data:
            return
        msgs = r.data[0].get('provider_messages') or []
        msgs.append({'role': role, 'text': text, 'ts': datetime.utcnow().isoformat()})
        _sb().table('bookings').update({'provider_messages': msgs}).eq('id', booking_id).execute()
    except Exception as e:
        print(f'  ⚠ log_provider_message: {e}')


def get_provider_messages(booking_id: str) -> list:
    try:
        r = _sb().table('bookings').select('provider_messages').eq('id', booking_id).limit(1).execute()
        return (r.data[0].get('provider_messages') or []) if r.data else []
    except Exception as e:
        print(f'  ⚠ get_provider_messages: {e}')
        return []


def get_all_provider_messages_by_number(provider_number: str,
                                         business_id: Optional[str] = None) -> list:
    """Aggregate all provider_messages across all bookings for a given provider number."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = (_sb().table('bookings')
             .select('id, order_number, provider_messages, created_at')
             .eq('provider_number', provider_number)
             .eq('business_id', b)
             .order('created_at').execute())
        all_msgs = []
        for booking in (r.data or []):
            for m in (booking.get('provider_messages') or []):
                all_msgs.append({**m,
                                  'booking_id':    booking['id'],
                                  'order_number':  booking.get('order_number', '')})
        all_msgs.sort(key=lambda x: x.get('ts', ''))
        return all_msgs
    except Exception as e:
        print(f'  ⚠ get_all_provider_messages_by_number: {e}')
        return []


def log_provider_direct_message(provider_number: str, role: str, text: str,
                                  business_id: Optional[str] = None):
    """Log a direct (non-booking) message to the most recent booking for this provider."""
    b = _bid(business_id)
    if not b:
        return
    try:
        r = (_sb().table('bookings').select('id')
             .eq('provider_number', provider_number)
             .eq('business_id', b)
             .order('created_at', desc=True).limit(1).execute())
        if r.data:
            log_provider_message(r.data[0]['id'], role, text, b)
    except Exception as e:
        print(f'  ⚠ log_provider_direct_message: {e}')


def mark_provider_verified(provider_number: str, business_id: Optional[str] = None):
    """Mark provider as WhatsApp-verified when they initiate a message to us."""
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('providers').update({'whatsapp_verified': True}).eq('whatsapp_number', provider_number).eq('business_id', b).execute()
    except Exception as e:
        print(f'  ⚠ mark_provider_verified: {e}')


def get_booking_id_by_provider(provider_number: str,
                                business_id: Optional[str] = None) -> Optional[str]:
    """Return the latest pending booking ID for a provider number."""
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = (_sb().table('bookings').select('id')
             .eq('business_id', b)
             .eq('provider_number', provider_number)
             .eq('payment_status', 'pending')
             .order('created_at', desc=True)
             .limit(1).execute())
        return r.data[0]['id'] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_booking_id_by_provider: {e}')
        return None


# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

def create_notification(business_id: Optional[str], ntype: str,
                        title: str, body: str,
                        booking_id: Optional[str] = None,
                        lead_phone: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('notifications').insert({
            'business_id': b,
            'type':        ntype,
            'title':       title,
            'body':        body,
            'booking_id':  booking_id,
            'lead_phone':  lead_phone,
        }).execute()
    except Exception as e:
        print(f'  ⚠ create_notification: {e}')


def get_notifications(business_id: Optional[str] = None,
                      unread_only: bool = False, limit: int = 50) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        q = (_sb().table('notifications').select('*')
             .eq('business_id', b)
             .order('created_at', desc=True)
             .limit(limit))
        if unread_only:
            q = q.is_('read_at', 'null')
        return q.execute().data or []
    except Exception as e:
        print(f'  ⚠ get_notifications: {e}')
        return []


def get_unread_count(business_id: Optional[str] = None) -> int:
    b = _bid(business_id)
    if not b:
        return 0
    try:
        r = (_sb().table('notifications').select('id', count='exact')
             .eq('business_id', b).is_('read_at', 'null').execute())
        return r.count or 0
    except Exception as e:
        print(f'  ⚠ get_unread_count: {e}')
        return 0


def mark_all_notifications_read(business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        now = datetime.utcnow().isoformat()
        _sb().table('notifications').update({'read_at': now}).eq('business_id', b).is_('read_at', 'null').execute()
    except Exception as e:
        print(f'  ⚠ mark_all_notifications_read: {e}')


# ─── HOURS HELPER (matches original agent.py interface) ──────────────────────

def _hours_old(entry: dict) -> float:
    ts = entry.get('ts') or entry.get('created_at', '')
    if not ts:
        return 0.0
    try:
        created = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - created).total_seconds() / 3600
    except Exception:
        return 0.0


# ─── BROADCASTS ───────────────────────────────────────────────────────────────

def get_broadcast(broadcast_id: str, business_id: Optional[str] = None) -> Optional[dict]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('broadcasts').select('*').eq('id', broadcast_id).eq('business_id', b).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_broadcast: {e}')
        return None


def get_broadcast_recipients(broadcast_id: str, status: Optional[str] = None) -> list:
    try:
        q = _sb().table('broadcast_recipients').select('*').eq('broadcast_id', broadcast_id)
        if status:
            q = q.eq('status', status)
        return (q.execute().data or [])
    except Exception as e:
        print(f'  ⚠ get_broadcast_recipients: {e}')
        return []


def update_broadcast_recipient(recipient_id: str, updates: dict):
    try:
        _sb().table('broadcast_recipients').update(updates).eq('id', recipient_id).execute()
    except Exception as e:
        print(f'  ⚠ update_broadcast_recipient: {e}')


def update_broadcast(broadcast_id: str, updates: dict):
    try:
        _sb().table('broadcasts').update(updates).eq('id', broadcast_id).execute()
    except Exception as e:
        print(f'  ⚠ update_broadcast: {e}')


def get_reachable_leads(business_id: Optional[str] = None, within_hours: int = 23) -> list:
    """Return leads who messaged within `within_hours` (within Meta's 24h free-form window)."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        cutoff = (datetime.utcnow() - timedelta(hours=within_hours)).isoformat()
        r = _sb().table('leads').select('id,phone,name').eq('business_id', b) \
            .gte('last_active_at', cutoff).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_reachable_leads: {e}')
        return []


# ─── TOKEN ENCRYPTION HELPERS (used by migration script) ─────────────────────

def migrate_encrypt_tokens():
    """One-time migration: encrypt plaintext tokens in the businesses table."""
    if not _ENC_KEY:
        print('  ⚠ ENCRYPTION_KEY not set — skipping token migration')
        return
    try:
        rows = _sb().table('businesses').select('id,meta_access_token,twilio_auth_token').execute().data or []
        for row in rows:
            updates = {}
            for field in ('meta_access_token', 'twilio_auth_token'):
                val = row.get(field)
                if val and not val.startswith('enc:'):
                    encrypted = _encrypt_field(val)
                    updates[field] = encrypted
            if updates:
                _sb().table('businesses').update(updates).eq('id', row['id']).execute()
                print(f'  ✓ Encrypted tokens for business {row["id"][:8]}…')
        print('  ✓ Token migration complete')
    except Exception as e:
        print(f'  ⚠ migrate_encrypt_tokens: {e}')


# ─── PERSISTENT MESSAGE QUEUE ─────────────────────────────────────────────────

def get_business_by_id(business_id: str) -> Optional[dict]:
    try:
        r = _sb().table('businesses').select('*').eq('id', business_id).limit(1).execute()
        if r.data:
            return _decrypt_business(r.data[0])
    except Exception as e:
        print(f'  ⚠ get_business_by_id: {e}', flush=True)
    return None


def enqueue_message(business_id: str, to_number: str, payload: dict, send_at) -> None:
    """Persist a message to send at send_at (datetime). Survives deploys."""
    try:
        _sb().table('queued_messages').insert({
            'business_id': business_id,
            'to_number': to_number,
            'payload': payload,
            'send_at': send_at.isoformat() if hasattr(send_at, 'isoformat') else send_at,
            'status': 'pending',
        }).execute()
    except Exception as e:
        print(f'  ✗ enqueue_message: {e}', flush=True)


def reset_stale_processing_messages() -> None:
    """On startup: reset any messages stuck in 'processing' back to 'pending'."""
    try:
        _sb().table('queued_messages').update({'status': 'pending'}).eq('status', 'processing').execute()
    except Exception as e:
        print(f'  ⚠ reset_stale_processing_messages: {e}', flush=True)


def claim_due_messages() -> list:
    """Return pending messages whose send_at has passed and mark them as processing."""
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        r = _sb().table('queued_messages') \
            .select('*') \
            .eq('status', 'pending') \
            .lte('send_at', now) \
            .execute()
        if not r.data:
            return []
        ids = [row['id'] for row in r.data]
        _sb().table('queued_messages') \
            .update({'status': 'processing', 'attempt_count': 1}) \
            .in_('id', ids) \
            .execute()
        return r.data
    except Exception as e:
        print(f'  ✗ claim_due_messages: {e}', flush=True)
        return []


def complete_queued_message(msg_id: str, success: bool, error_msg: Optional[str] = None) -> None:
    try:
        patch = {'status': 'sent' if success else 'failed'}
        if error_msg:
            patch['error_msg'] = error_msg
        _sb().table('queued_messages').update(patch).eq('id', msg_id).execute()
    except Exception as e:
        print(f'  ✗ complete_queued_message: {e}', flush=True)


# ─── BUSINESS LINE ROUTING ────────────────────────────────────────────────────

def get_business_line_configs(business_id: Optional[str] = None) -> list:
    """Return full business line configs [{name, description, woocommerce_linked}]. Handles legacy string[] format."""
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('businesses').select('settings').eq('id', b).single().execute()
        raw = list((r.data or {}).get('settings', {}).get('business_lines', []) or [])
        result = []
        for item in raw:
            if isinstance(item, str):
                result.append({'name': item, 'description': '', 'woocommerce_linked': False})
            elif isinstance(item, dict) and item.get('name'):
                result.append(item)
        return result
    except Exception as e:
        print(f'  ⚠ get_business_line_configs: {e}')
        return []


def get_business_lines(business_id: Optional[str] = None) -> list:
    """Return list of business line name strings."""
    return [c['name'] for c in get_business_line_configs(business_id) if c.get('name')]


def get_conversation_business_line(phone: str, business_id: Optional[str] = None) -> Optional[str]:
    b = _bid(business_id)
    if not b:
        return None
    try:
        r = _sb().table('conversations').select('business_line') \
            .eq('phone', phone).eq('business_id', b) \
            .order('created_at', desc=True).limit(1).execute()
        return (r.data[0].get('business_line') if r.data else None)
    except Exception as e:
        print(f'  ⚠ get_conversation_business_line: {e}')
        return None


def set_conversation_business_line(phone: str, business_id: str, line: str) -> None:
    b = _bid(business_id) or business_id
    try:
        _sb().table('conversations').update({'business_line': line}) \
            .eq('phone', phone).eq('business_id', b).execute()
        print(f'  🏷 business_line={line} → {phone}', flush=True)
    except Exception as e:
        print(f'  ✗ set_conversation_business_line: {e}', flush=True)


def get_users_by_business_line(business_id: str, line: str) -> list:
    """Return active users assigned to the given business line."""
    b = _bid(business_id) or business_id
    try:
        r = _sb().table('users').select('id,name,phone,email,notification_pref,product_interests') \
            .eq('business_id', b).eq('active', True).execute()
        return [u for u in (r.data or []) if line in (u.get('product_interests') or [])]
    except Exception as e:
        print(f'  ⚠ get_users_by_business_line: {e}')
        return []


def get_team_by_zone(business_id: str, zone: str) -> Optional[dict]:
    """Find the team whose zone keyword matches the lead's zone string."""
    b = _bid(business_id) or business_id
    try:
        r = _sb().table('teams').select('id,name,zone').eq('business_id', b).eq('active', True).execute()
        zone_lower = zone.lower()
        for team in (r.data or []):
            team_zone = (team.get('zone') or '').lower()
            # Match if any word of the team zone appears in the lead zone or vice versa
            team_words = [w for w in team_zone.split() if len(w) > 3]
            if any(w in zone_lower for w in team_words):
                return team
        return None
    except Exception as e:
        print(f'  ⚠ get_team_by_zone: {e}')
        return None


def assign_conversation(phone: str, business_id: Optional[str],
                        assigned_user_id: Optional[str] = None,
                        assigned_name: Optional[str] = None,
                        team_id: Optional[str] = None) -> None:
    """Set assigned_to (UUID) and/or team_id on conversation and lead."""
    phone = _normalize_phone(phone)
    b = _bid(business_id)
    if not b or (not assigned_user_id and not team_id):
        return
    try:
        conv_update = {}
        if assigned_user_id:
            conv_update['assigned_to'] = assigned_user_id  # UUID FK to users.id
        if team_id:
            conv_update['team_id'] = team_id
        if conv_update:
            _sb().table('conversations').update(conv_update) \
                .eq('phone', phone).eq('business_id', b).execute()
        if team_id:
            _sb().table('leads').update({'team_id': team_id}) \
                .eq('phone', phone).eq('business_id', b).execute()
    except Exception as e:
        print(f'  ⚠ assign_conversation: {e}')


def enrich_lead(phone: str, business_id: Optional[str], updates: dict) -> None:
    """Update only null/empty lead fields. Tracks auto-filled fields in ai_enriched JSONB."""
    from datetime import datetime
    b = _bid(business_id)
    if not b or not updates:
        return
    try:
        r = _sb().table('leads').select('id,name,last_name,email,company,zone,product_interest,ai_enriched') \
            .eq('phone', phone).eq('business_id', b).limit(1).execute()
        lead = r.data[0] if r.data else None
        if not lead:
            return

        to_update: dict = {}
        ai_enriched: dict = dict(lead.get('ai_enriched') or {})
        now = datetime.utcnow().isoformat() + 'Z'

        for field, value in updates.items():
            if value and isinstance(value, str) and not lead.get(field):
                to_update[field] = value.strip()
                ai_enriched[field] = now

        if not to_update:
            return

        to_update['ai_enriched'] = ai_enriched
        _sb().table('leads').update(to_update).eq('id', lead['id']).execute()
        print(f'  🧠 Lead enriched {list(to_update.keys() - {"ai_enriched"})} → {phone}', flush=True)
    except Exception as e:
        print(f'  ⚠ enrich_lead: {e}', flush=True)
