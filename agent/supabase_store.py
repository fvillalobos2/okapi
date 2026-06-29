"""
Supabase-backed storage — drop-in replacement for all JSON file functions.
All public functions maintain the same signatures as the original implementations.
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

try:
    from supabase import create_client, Client
    print("[supabase_store] supabase package imported OK", flush=True)
except ImportError as _e:
    print(f"[supabase_store] FATAL: supabase not installed: {_e}", flush=True)
    raise

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://bzdaxldhvxsnolzkcgrs.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZGF4bGRodnhzbm9semtjZ3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc2NjcxMSwiZXhwIjoyMDk4MzQyNzExfQ.ZqK1LOuN-aEmjA4J2oCBfUY-q3d5vm4ZLPIr8v3rQWI')

DEFAULT_BUSINESS_SLUG = os.getenv('DEFAULT_BUSINESS_SLUG', 'golfcartrentalscr')

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
        return r.data[0] if r.data else None
    except Exception as e:
        print(f'  ⚠ get_business_by_slug({slug}): {e}')
        return None


def get_all_businesses() -> list:
    try:
        r = _sb().table('businesses').select('*').order('name').execute()
        return r.data or []
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

def _get_or_create_lead(phone: str, business_id: str) -> Optional[str]:
    try:
        now = datetime.utcnow().isoformat()
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
        print(f'  ⚠ _get_or_create_lead: {e}')
        return None


def update_lead_info(phone: str, data: dict, business_id: Optional[str] = None):
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
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('conversations').select('messages').eq('phone', phone).eq('business_id', b).limit(1).execute()
        return r.data[0].get('messages', []) if r.data else []
    except Exception as e:
        print(f'  ⚠ get_history: {e}')
        return []


def append_message(phone: str, role: str, content: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    now = datetime.utcnow().isoformat()
    new_msg = {'role': role, 'content': content, 'ts': now}
    try:
        lead_id = _get_or_create_lead(phone, b)
        if lead_id:
            _sb().table('leads').update({'last_active_at': now}).eq('id', lead_id).execute()

        r = _sb().table('conversations').select('id,messages').eq('phone', phone).eq('business_id', b).limit(1).execute()
        if r.data:
            msgs = r.data[0].get('messages', [])
            msgs.append(new_msg)
            if len(msgs) > 30:
                msgs = msgs[-30:]
            _sb().table('conversations').update({'messages': msgs, 'last_message_at': now}).eq('id', r.data[0]['id']).execute()
        else:
            _sb().table('conversations').insert({
                'phone': phone, 'business_id': b, 'lead_id': lead_id,
                'messages': [new_msg], 'last_message_at': now,
            }).execute()
    except Exception as e:
        print(f'  ⚠ append_message: {e}')


def clear_history(phone: str, business_id: Optional[str] = None):
    b = _bid(business_id)
    if not b:
        return
    try:
        _sb().table('conversations').update({'messages': [], 'status': 'active'}).eq('phone', phone).eq('business_id', b).execute()
        update_lead_status(phone, 'new', b)
    except Exception as e:
        print(f'  ⚠ clear_history: {e}')


def get_conversations(business_id: Optional[str] = None, limit: int = 100) -> list:
    b = _bid(business_id)
    if not b:
        return []
    try:
        r = _sb().table('conversations').select('*').eq('business_id', b).order('last_message_at', desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        print(f'  ⚠ get_conversations: {e}')
        return []


def get_conversation_by_phone(phone: str, business_id: Optional[str] = None) -> Optional[dict]:
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
        r = _sb().table('businesses').select('base_prompt').eq('id', b).limit(1).execute()
        return (r.data[0].get('base_prompt') if r.data else None) or None
    except Exception as e:
        print(f'  ⚠ get_active_prompt: {e}')
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
