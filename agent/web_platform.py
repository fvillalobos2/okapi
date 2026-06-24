"""
Okapi Platform — Web Admin Flask Blueprint
Routes: /dashboard /leads /bookings /providers /analytics /businesses /settings
"""

import os
from datetime import datetime
from functools import wraps
from flask import (Blueprint, render_template, request, redirect, url_for,
                   session, jsonify, flash)

import supabase_store as store

web_bp = Blueprint('web', __name__, template_folder='templates')

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')

# ─── AUTH DECORATOR ──────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated

# ─── DASHBOARD ────────────────────────────────────────────────────────────────

@web_bp.route('/')
@login_required
def index():
    return redirect(url_for('web.dashboard'))

@web_bp.route('/dashboard')
@login_required
def dashboard():
    biz = _current_biz()
    kpi = store.get_analytics(biz.get('id'))
    quotes   = store.get_all_pending_quotes(biz.get('id'))
    payments = {k: v for k, v in store.get_all_pending_payments(biz.get('id')).items()
                if not v.get('processed')}
    cold = store.get_cold_leads(biz.get('id'), hours=24)
    timed_out = store.get_timed_out_providers(biz.get('id'), hours=4)

    # Recent activity: last 10 bookings
    recent_bookings = store.get_bookings(biz.get('id'), limit=10)

    alerts = []
    if cold:
        alerts.append({'type': 'warning', 'msg': f'{len(cold)} lead(s) gone cold — follow-up pending'})
    if timed_out:
        alerts.append({'type': 'danger', 'msg': f'{len(timed_out)} provider(s) have not responded in 4h'})
    counter_offers = [q for q in quotes.values() if q.get('commission_status') == 'countered']
    if counter_offers:
        alerts.append({'type': 'info', 'msg': f'{len(counter_offers)} commission counter-offer(s) awaiting review'})

    return render_template('dashboard.html',
                           kpi=kpi, alerts=alerts, quotes=quotes,
                           payments=payments, recent_bookings=recent_bookings,
                           biz=biz, businesses=_all_biz())

# ─── LEADS ────────────────────────────────────────────────────────────────────

@web_bp.route('/leads')
@login_required
def leads():
    biz    = _current_biz()
    status = request.args.get('status', '')
    leads  = store.get_leads(biz.get('id'), status=status or None, limit=500)
    return render_template('leads.html', leads=leads, status_filter=status,
                           biz=biz, businesses=_all_biz())

@web_bp.route('/leads/<phone>')
@login_required
def lead_detail(phone: str):
    biz  = _current_biz()
    bid  = biz.get('id')
    lead = store.get_lead_by_phone(phone, bid)
    conv = store.get_conversation_by_phone(phone, bid)
    booking = None
    if lead:
        bookings = store.get_bookings(bid, limit=500)
        for b in bookings:
            if b.get('client_phone') == phone or b.get('client_phone') == f'whatsapp:{phone}':
                booking = b
                break
    return render_template('lead_detail.html', lead=lead, conv=conv,
                           booking=booking, biz=biz, businesses=_all_biz())

@web_bp.route('/api/leads/<phone>', methods=['DELETE'])
@login_required
def lead_delete(phone: str):
    biz = _current_biz()
    ok  = store.delete_lead(phone, biz.get('id'))
    return jsonify({'status': 'ok' if ok else 'error'})

@web_bp.route('/api/leads/<phone>/reply', methods=['POST'])
@login_required
def lead_reply(phone: str):
    """Send a manual reply to a lead via WhatsApp."""
    from agent import send_whatsapp, TWILIO_WA_NUMBER
    biz = _current_biz()
    msg = request.json.get('message', '').strip()
    if not msg:
        return jsonify({'error': 'Empty message'}), 400
    sender = biz.get('twilio_sender', TWILIO_WA_NUMBER)
    to     = phone if phone.startswith('whatsapp:') else f'whatsapp:{phone}'
    send_whatsapp(to, msg, sender)
    store.append_message(phone, 'assistant', msg, biz.get('id'))
    return jsonify({'status': 'sent'})

# ─── CONVERSATIONS ───────────────────────────────────────────────────────────

@web_bp.route('/conversations')
@login_required
def conversations():
    biz      = _current_biz()
    bookings = store.get_bookings(biz.get('id'), limit=200)
    bookings = [b for b in bookings if b.get('provider_number')]
    return render_template('conversations.html', bookings=bookings, selected=None,
                           provider_msgs=[], biz=biz, businesses=_all_biz())

@web_bp.route('/conversations/<booking_id>')
@login_required
def conversation_detail(booking_id: str):
    biz      = _current_biz()
    bookings = store.get_bookings(biz.get('id'), limit=200)
    bookings = [b for b in bookings if b.get('provider_number')]
    selected = store.get_booking_by_id(booking_id)
    msgs     = store.get_provider_messages(booking_id) if selected else []
    return render_template('conversations.html', bookings=bookings, selected=selected,
                           provider_msgs=msgs, biz=biz, businesses=_all_biz())

@web_bp.route('/api/conversations/<booking_id>/send', methods=['POST'])
@login_required
def conversation_send(booking_id: str):
    from agent import send_whatsapp, TWILIO_WA_NUMBER
    biz     = _current_biz()
    booking = store.get_booking_by_id(booking_id)
    if not booking:
        return jsonify({'error': 'Not found'}), 404
    msg    = (request.json or {}).get('message', '').strip()
    if not msg:
        return jsonify({'error': 'Empty'}), 400
    sender = biz.get('twilio_sender', TWILIO_WA_NUMBER)
    to     = booking['provider_number']
    send_whatsapp(to, msg, sender)
    store.log_provider_message(booking_id, 'agent', msg)
    return jsonify({'status': 'sent'})

# ─── BOOKINGS ─────────────────────────────────────────────────────────────────

@web_bp.route('/bookings')
@login_required
def bookings():
    biz    = _current_biz()
    pstat  = request.args.get('payment_status', '')
    items  = store.get_bookings(biz.get('id'), payment_status=pstat or None, limit=500)
    return render_template('bookings.html', bookings=items, pstat_filter=pstat,
                           biz=biz, businesses=_all_biz())

@web_bp.route('/bookings/<booking_id>')
@login_required
def booking_detail(booking_id: str):
    biz  = _current_biz()
    item = store.get_booking_by_id(booking_id)
    provider_msgs = store.get_provider_messages(booking_id) if item else []
    return render_template('booking_detail.html', booking=item,
                           provider_msgs=provider_msgs,
                           biz=biz, businesses=_all_biz())

@web_bp.route('/api/bookings/<booking_id>', methods=['PATCH'])
@login_required
def booking_update(booking_id: str):
    """Admin override: adjust commission, mark paid, cancel."""
    data    = request.json or {}
    allowed = {'commission_pct_final', 'payment_status', 'fee_amount', 'rental_amount'}
    payload = {k: v for k, v in data.items() if k in allowed}
    if not payload:
        return jsonify({'error': 'No valid fields'}), 400
    ok = store.update_booking(booking_id, payload)
    return jsonify({'status': 'ok' if ok else 'error'})

# ─── PROVIDERS ────────────────────────────────────────────────────────────────

@web_bp.route('/providers')
@login_required
def providers():
    biz   = _current_biz()
    items = store.get_providers_list(biz.get('id'))
    return render_template('providers.html', providers=items,
                           biz=biz, businesses=_all_biz())

@web_bp.route('/api/providers', methods=['POST'])
@login_required
def provider_create():
    biz  = _current_biz()
    data = request.json or {}
    data['business_id'] = biz['id']
    result = store.upsert_provider(data)
    return jsonify({'status': 'ok', 'id': result['id'] if result else None})

@web_bp.route('/api/providers/<provider_id>', methods=['PATCH'])
@login_required
def provider_update(provider_id: str):
    data    = request.json or {}
    allowed = {'default_commission_pct', 'active', 'location_name', 'whatsapp_number', 'whatsapp_verified'}
    payload = {k: v for k, v in data.items() if k in allowed}
    ok = store.update_provider(provider_id, payload)
    return jsonify({'status': 'ok' if ok else 'error'})

# ─── ANALYTICS ────────────────────────────────────────────────────────────────

@web_bp.route('/analytics')
@login_required
def analytics():
    biz   = _current_biz()
    bid   = biz.get('id')
    days  = int(request.args.get('days', 30))
    kpi   = store.get_analytics(bid, days)
    trend = store.get_monthly_trend(bid, months=6)

    # Provider leaderboard
    providers = store.get_providers_list(bid)
    providers_sorted = sorted(providers, key=lambda p: (
        -(p.get('acceptance_rate') or 0),
        (p.get('avg_response_time_minutes') or 9999)
    ))

    # Location breakdown from bookings
    bookings   = store.get_bookings(bid, limit=1000)
    loc_counts: dict = {}
    for b in bookings:
        bt  = b.get('booking_text', '')
        loc = ''
        for line in bt.splitlines():
            if line.lower().startswith('location:'):
                loc = line.split(':', 1)[1].strip()
                break
        if loc:
            if loc not in loc_counts:
                loc_counts[loc] = {'location': loc, 'total': 0, 'paid': 0, 'revenue': 0}
            loc_counts[loc]['total'] += 1
            if b.get('payment_status') == 'paid':
                loc_counts[loc]['paid']    += 1
                loc_counts[loc]['revenue'] += b.get('fee_amount') or 0

    return render_template('analytics.html', kpi=kpi, trend=trend,
                           providers=providers_sorted,
                           locations=sorted(loc_counts.values(),
                                            key=lambda x: -x['paid']),
                           days=days, biz=biz, businesses=_all_biz())

# ─── BUSINESSES ───────────────────────────────────────────────────────────────

@web_bp.route('/businesses')
@login_required
def businesses():
    items = store.get_all_businesses()
    return render_template('businesses.html', businesses=items,
                           biz=_current_biz(), all_biz=items)

@web_bp.route('/businesses/new', methods=['GET', 'POST'])
@login_required
def business_new():
    if request.method == 'POST':
        data = {
            'name':                          request.form.get('name', '').strip(),
            'slug':                          request.form.get('slug', '').strip().lower(),
            'whatsapp_number':               request.form.get('whatsapp_number', '').strip(),
            'twilio_sender':                 request.form.get('twilio_sender', '').strip(),
            'default_commission_pct':        float(request.form.get('default_commission_pct', 10)),
            'min_commission_pct':            float(request.form.get('min_commission_pct', 5)),
            'auto_accept_counter_within_pct': float(request.form.get('auto_accept_counter_within_pct', 2)),
            'active':                        True,
        }
        result = store.create_business(data)
        if result:
            return redirect(url_for('web.businesses'))
    return render_template('business_new.html', biz=_current_biz(), businesses=_all_biz())

@web_bp.route('/api/businesses/<business_id>', methods=['PATCH'])
@login_required
def business_update_api(business_id: str):
    data    = request.json or {}
    allowed = {'name', 'active', 'default_commission_pct', 'min_commission_pct',
               'auto_accept_counter_within_pct', 'follow_up_hours', 'provider_timeout_hours',
               'admin_whatsapp'}
    payload = {k: v for k, v in data.items() if k in allowed}
    ok      = store.update_business(business_id, payload)
    return jsonify({'status': 'ok' if ok else 'error'})

# ─── PROMPT EDITOR ────────────────────────────────────────────────────────────

@web_bp.route('/businesses/<slug>/prompt', methods=['GET', 'POST'])
@login_required
def prompt_editor(slug: str):
    biz = store.get_business_by_slug(slug)
    if not biz:
        return 'Business not found', 404

    if request.method == 'POST':
        action      = request.form.get('action', 'publish')
        prompt_text = request.form.get('prompt', '').strip()
        if action == 'publish' and prompt_text:
            store.save_prompt_version(prompt_text, biz['id'])
            flash('Prompt published — takes effect on next incoming message.', 'success')
        return redirect(url_for('web.prompt_editor', slug=slug))

    # Load current prompt (DB > file)
    current_prompt = store.get_active_prompt(biz['id'])
    if not current_prompt:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt.txt')
        try:
            with open(path) as f:
                current_prompt = f.read().strip()
        except Exception:
            current_prompt = ''

    versions  = store.get_prompt_versions(biz['id'])
    locations = store.get_providers_list(biz['id'])
    services_r = store._sb().table('services').select('*').eq('business_id', biz['id']).order('sort_order').execute()
    services  = services_r.data or []

    return render_template('prompt_editor.html', biz=biz, businesses=_all_biz(),
                           current_prompt=current_prompt, versions=versions,
                           locations=locations, services=services)

@web_bp.route('/api/businesses/<slug>/prompt/revert/<version_id>', methods=['POST'])
@login_required
def prompt_revert(slug: str, version_id: str):
    biz = store.get_business_by_slug(slug)
    if not biz:
        return jsonify({'error': 'Not found'}), 404
    text = store.get_prompt_version(version_id)
    if not text:
        return jsonify({'error': 'Version not found'}), 404
    store.save_prompt_version(text, biz['id'], created_by='revert')
    return jsonify({'status': 'ok', 'prompt': text})

@web_bp.route('/api/businesses/<slug>/prompt/test', methods=['POST'])
@login_required
def prompt_test(slug: str):
    """Test prompt with Claude without affecting real conversations."""
    import anthropic
    biz = store.get_business_by_slug(slug)
    if not biz:
        return jsonify({'error': 'Not found'}), 404
    data       = request.json or {}
    test_prompt = data.get('prompt', '')
    user_msg    = data.get('message', 'Hi, I want to rent a golf cart')
    api_key    = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        return jsonify({'error': 'No API key'}), 500
    client = anthropic.Anthropic(api_key=api_key)
    try:
        r = client.messages.create(
            model='claude-sonnet-4-6', max_tokens=512,
            system=test_prompt,
            messages=[{'role': 'user', 'content': user_msg}]
        )
        return jsonify({'response': r.content[0].text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── SERVICES & LOCATIONS EDITORS ────────────────────────────────────────────

@web_bp.route('/api/businesses/<slug>/services', methods=['GET', 'POST'])
@login_required
def services_api(slug: str):
    biz = store.get_business_by_slug(slug)
    if not biz:
        return jsonify({'error': 'Not found'}), 404
    if request.method == 'POST':
        data = request.json or {}
        data['business_id'] = biz['id']
        r = store._sb().table('services').insert(data).execute()
        return jsonify({'status': 'ok', 'id': r.data[0]['id'] if r.data else None})
    r = store._sb().table('services').select('*').eq('business_id', biz['id']).order('sort_order').execute()
    return jsonify(r.data or [])

@web_bp.route('/api/services/<service_id>', methods=['PATCH', 'DELETE'])
@login_required
def service_update(service_id: str):
    if request.method == 'DELETE':
        store._sb().table('services').delete().eq('id', service_id).execute()
        return jsonify({'status': 'ok'})
    data = request.json or {}
    store._sb().table('services').update(data).eq('id', service_id).execute()
    return jsonify({'status': 'ok'})

@web_bp.route('/api/businesses/<slug>/locations', methods=['GET', 'POST'])
@login_required
def locations_api(slug: str):
    biz = store.get_business_by_slug(slug)
    if not biz:
        return jsonify({'error': 'Not found'}), 404
    if request.method == 'POST':
        data = request.json or {}
        data['business_id'] = biz['id']
        r = store._sb().table('locations').insert(data).execute()
        return jsonify({'status': 'ok', 'id': r.data[0]['id'] if r.data else None})
    r = store._sb().table('locations').select('*').eq('business_id', biz['id']).execute()
    return jsonify(r.data or [])

@web_bp.route('/api/locations/<loc_id>', methods=['PATCH', 'DELETE'])
@login_required
def location_update(loc_id: str):
    if request.method == 'DELETE':
        store._sb().table('locations').delete().eq('id', loc_id).execute()
        return jsonify({'status': 'ok'})
    data = request.json or {}
    store._sb().table('locations').update(data).eq('id', loc_id).execute()
    return jsonify({'status': 'ok'})

# ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

@web_bp.route('/notifications')
@login_required
def notifications():
    biz   = _current_biz()
    items = store.get_notifications(biz.get('id'), limit=100)
    store.mark_all_notifications_read(biz.get('id'))
    return render_template('notifications.html', notifications=items,
                           biz=biz, businesses=_all_biz())

@web_bp.route('/api/notifications')
@login_required
def notifications_api():
    biz   = _current_biz()
    items = store.get_notifications(biz.get('id'), unread_only=True, limit=20)
    count = store.get_unread_count(biz.get('id'))
    return jsonify({'count': count, 'items': items})

@web_bp.route('/api/notifications/read', methods=['POST'])
@login_required
def notifications_mark_read():
    biz = _current_biz()
    store.mark_all_notifications_read(biz.get('id'))
    return jsonify({'status': 'ok'})

# ─── SETTINGS ─────────────────────────────────────────────────────────────────

@web_bp.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    biz = _current_biz()
    if request.method == 'POST':
        data = {
            'follow_up_hours':               int(request.form.get('follow_up_hours', 24)),
            'provider_timeout_hours':        int(request.form.get('provider_timeout_hours', 4)),
            'auto_accept_counter_within_pct': float(request.form.get('auto_accept_counter_within_pct', 2)),
            'admin_whatsapp':                request.form.get('admin_whatsapp', '').strip(),
        }
        store.update_business(biz['id'], data)
        flash('Settings saved.', 'success')
        return redirect(url_for('web.settings'))
    biz = _current_biz()   # re-fetch after possible update
    return render_template('settings.html', biz=biz, businesses=_all_biz())

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _current_biz() -> dict:
    slug = session.get('current_biz', 'golfcartrentalscr')
    biz  = store.get_business_by_slug(slug)
    return biz or {'id': None, 'name': 'GolfCartRentalsCR', 'slug': slug}

def _all_biz() -> list:
    return store.get_all_businesses()

@web_bp.route('/api/switch-biz/<slug>')
@login_required
def switch_biz(slug: str):
    session['current_biz'] = slug
    return redirect(request.referrer or url_for('web.dashboard'))

@web_bp.route('/api/analytics-data')
@login_required
def analytics_data():
    biz   = _current_biz()
    days  = int(request.args.get('days', 30))
    kpi   = store.get_analytics(biz.get('id'), days)
    trend = store.get_monthly_trend(biz.get('id'))
    return jsonify({'kpi': kpi, 'trend': trend})
