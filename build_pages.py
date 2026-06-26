"""Generate and push all GolfCartRentalsCR pages to WordPress."""
import json, re, os, urllib.request, base64, time

BASE = 'https://salmon-ibex-825566.hostingersite.com'
CREDS = base64.b64encode(b'favillalobos2@gmail.com:pW29 5jIG DRQI o00A wJR0 NEiN').decode()
IMG = f'{BASE}/wp-content/uploads/2026/05'
WA = 'https://wa.me/14155238886'

# ─── SHARED CSS ───────────────────────────────────────────────────────────────

def _load_shared_css():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(script_dir, 'homepage.html'), 'r') as f:
        raw = f.read()
    m = re.search(r'<style>(.*?)</style>', raw, re.DOTALL)
    return re.sub(r'\n[ \t]*\n+', '\n', m.group(1).strip()) if m else ''

SHARED_CSS = _load_shared_css()

def strip_style_blanks(html):
    def _strip(m):
        return '<style>' + re.sub(r'\n[ \t]*\n+', '\n', m.group(1)) + '</style>'
    return re.sub(r'<style>(.*?)</style>', _strip, html, flags=re.DOTALL)

# ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

FOOTER = f"""
<footer class="gcr-footer">
  <div class="gcr-container">
    <div class="gcr-footer__grid">
      <div>
        <div class="gcr-footer__brand-name">GolfCartRentalsCR</div>
        <p class="gcr-footer__brand-desc">Costa Rica's golf cart rental marketplace. We connect you with vetted local providers across 6 beach towns — best price, zero hassle.</p>
        <div class="gcr-footer__social">
          <a href="{WA}" target="_blank" class="gcr-footer__social-link" title="WhatsApp">💬</a>
          <a href="#" class="gcr-footer__social-link" title="Instagram">📷</a>
          <a href="#" class="gcr-footer__social-link" title="Facebook">👥</a>
        </div>
      </div>
      <div>
        <div class="gcr-footer__col-title">Locations</div>
        <div class="gcr-footer__links">
          <a href="/location/tamarindo/">Tamarindo</a>
          <a href="/location/flamingo/">Flamingo</a>
          <a href="/location/playas-del-coco/">Playas del Coco</a>
          <a href="/location/jaco/">Jacó</a>
          <a href="/location/manuel-antonio/">Manuel Antonio</a>
          <a href="/location/potrero/">Potrero</a>
        </div>
      </div>
      <div>
        <div class="gcr-footer__col-title">Quick Links</div>
        <div class="gcr-footer__links">
          <a href="/how-it-works/">How It Works</a>
          <a href="/fleet/">Our Fleet</a>
          <a href="/faq/">FAQ</a>
          <a href="/contact/">Contact</a>
          <a href="/become-a-partner/">Become a Partner</a>
          <a href="/privacy-policy/">Privacy Policy</a>
        </div>
      </div>
      <div>
        <div class="gcr-footer__col-title">Contact Us</div>
        <div class="gcr-footer__contact-item"><span>💬</span><a href="{WA}" target="_blank">+506 8815-7780 (WhatsApp)</a></div>
        <div class="gcr-footer__contact-item"><span>📧</span><a href="mailto:info@golfcartrentalscr.com">info@golfcartrentalscr.com</a></div>
        <div class="gcr-footer__contact-item"><span>📍</span><span>Costa Rica · 6 Beach Locations</span></div>
        <div style="margin-top:1.25rem">
          <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--whatsapp" style="font-size:.875rem;padding:.625rem 1.25rem">Book on WhatsApp</a>
        </div>
      </div>
    </div>
    <div class="gcr-footer__bottom">
      <span>© 2025 GolfCartRentalsCR · Costa Rica</span>
      <span>Golf Cart Rentals in <a href="/location/tamarindo/">Tamarindo</a> · <a href="/location/flamingo/">Flamingo</a> · <a href="/location/jaco/">Jacó</a> · <a href="/location/manuel-antonio/">Manuel Antonio</a></span>
    </div>
  </div>
</footer>"""

WA_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'

def booking_form(selected_location=""):
    opts = ['Tamarindo','Flamingo','Playas del Coco','Jacó','Manuel Antonio','Potrero']
    opts_html = ''.join(f'<option{"  selected" if o==selected_location else ""}>{o}</option>' for o in opts)
    return f"""
<section class="gcr-book" id="booking-form">
  <div class="gcr-container">
    <div class="gcr-book__inner">
      <div class="gcr-book__info">
        <span class="gcr-label gcr-label--light">Get Availability &amp; Pricing</span>
        <h2 class="gcr-h2" style="color:#fff;margin-bottom:1rem">Request Your Cart in Minutes</h2>
        <p>Send us your details and we'll check availability with our local partner providers. We reply on WhatsApp within 1 hour with options, pricing, and delivery info.</p>
        <div style="margin-bottom:2rem">
          <a href="javascript:void(0)" onclick="gcrChatWhatsApp()" class="gcr-btn gcr-btn--whatsapp">{WA_SVG} Chat on WhatsApp</a>
        </div>
        <div class="gcr-book__features">
          <div class="gcr-book__feat"><span class="gcr-book__feat-icon">⚡</span> WhatsApp reply within 1 hour</div>
          <div class="gcr-book__feat"><span class="gcr-book__feat-icon">🤝</span> Multiple providers checked for you</div>
          <div class="gcr-book__feat"><span class="gcr-book__feat-icon">🚗</span> Hotel delivery available</div>
          <div class="gcr-book__feat"><span class="gcr-book__feat-icon">💬</span> 24/7 support on WhatsApp</div>
        </div>
      </div>
      <div class="gcr-form">
        <h3>Request a Golf Cart</h3>
        <p class="gcr-form__sub">We'll check availability with local providers and reply via WhatsApp within 1 hour.</p>
        <div class="gcr-form__group">
          <label for="f-location">📍 Location *</label>
          <select id="f-location" required><option value="">Select your beach town…</option>{opts_html}</select>
        </div>
        <div class="gcr-form__group">
          <label for="f-cart">🛒 Cart Type *</label>
          <select id="f-cart" required>
            <option value="">Select cart size…</option>
            <option>2-Passenger Cart</option>
            <option>4-Passenger Cart (Most Popular)</option>
            <option>6-Passenger Cart</option>
          </select>
        </div>
        <div class="gcr-form__divider">Pick-up</div>
        <div class="gcr-form__row">
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-pickup-date">📅 Pick-up Date *</label><input type="date" id="f-pickup-date" required></div>
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-pickup-time">🕐 Pick-up Time *</label><input type="time" id="f-pickup-time" required value="08:00"></div>
        </div>
        <div class="gcr-form__divider">Drop-off</div>
        <div class="gcr-form__row">
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-dropoff-date">📅 Drop-off Date *</label><input type="date" id="f-dropoff-date" required></div>
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-dropoff-time">🕐 Drop-off Time *</label><input type="time" id="f-dropoff-time" required value="17:00"></div>
        </div>
        <div class="gcr-form__divider">Your Details</div>
        <div class="gcr-form__row">
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-name">👤 Full Name *</label><input type="text" id="f-name" placeholder="John Smith" required></div>
          <div class="gcr-form__group" style="margin-bottom:0"><label for="f-phone">📱 Your Phone / WhatsApp *</label><input type="tel" id="f-phone" placeholder="+1 555 000 0000" required></div>
        </div>
        <div class="gcr-form__group" style="margin-top:1rem"><label for="f-email">📧 Email Address *</label><input type="email" id="f-email" placeholder="you@email.com" required></div>
        <div class="gcr-form__group"><label for="f-hotel">🏨 Hotel / Delivery Address</label><input type="text" id="f-hotel" placeholder="Hotel name or address for delivery"></div>
        <div class="gcr-form__group"><label for="f-notes">📝 Special Requests</label><textarea id="f-notes" placeholder="Any special requests, questions, or extra gear needed…"></textarea></div>
        <button type="button" class="gcr-btn gcr-btn--whatsapp gcr-form__submit" onclick="gcrSendBooking()">{WA_SVG} Send Booking via WhatsApp</button>
        <p class="gcr-form__note">You'll be redirected to WhatsApp to confirm. We respond within 1 hour.</p>
      </div>
    </div>
  </div>
</section>
<script>
function gcrSendBooking(){{
  var loc=document.getElementById('f-location').value,cart=document.getElementById('f-cart').value,
      pd=document.getElementById('f-pickup-date').value,pt=document.getElementById('f-pickup-time').value,
      dd=document.getElementById('f-dropoff-date').value,dt=document.getElementById('f-dropoff-time').value,
      nm=document.getElementById('f-name').value,ph=document.getElementById('f-phone').value,
      em=document.getElementById('f-email').value,ht=document.getElementById('f-hotel').value,
      nt=document.getElementById('f-notes').value;
  if(!msg.trim()){{alert('Please fill in at least one field.');return;}}
  var msg='🏖️ *Golf Cart Request — GolfCartRentalsCR*\\n\\n';
  if(loc) msg+='📍 *Location:* '+loc+'\\n';
  if(cart) msg+='🛒 *Cart:* '+cart+'\\n';
  if(pd||pt) msg+='\\n📅 *Pick-up:* '+(pd||'TBD')+' at '+(pt||'TBD')+'\\n';
  if(dd||dt) msg+='📅 *Drop-off:* '+(dd||'TBD')+' at '+(dt||'TBD')+'\\n';
  if(nm||ph||em) msg+='\\n';
  if(nm) msg+='👤 *Name:* '+nm+'\\n';
  if(ph) msg+='📱 *Phone:* '+ph+'\\n';
  if(em) msg+='📧 *Email:* '+em+'\\n';
  if(ht) msg+='🏨 *Hotel/Address:* '+ht+'\\n';
  if(nt) msg+='\\n📝 *Notes:* '+nt;
  window.open('{WA}?text='+encodeURIComponent(msg.trim()),'_blank');
}}
function gcrChatWhatsApp(){{
  var loc=document.getElementById('f-location')?document.getElementById('f-location').value:'';
  var cart=document.getElementById('f-cart')?document.getElementById('f-cart').value:'';
  var pd=document.getElementById('f-pickup-date')?document.getElementById('f-pickup-date').value:'';
  var dd=document.getElementById('f-dropoff-date')?document.getElementById('f-dropoff-date').value:'';
  var nm=document.getElementById('f-name')?document.getElementById('f-name').value:'';
  var ph=document.getElementById('f-phone')?document.getElementById('f-phone').value:'';
  var hasData=loc||cart||pd||dd||nm||ph;
  if(hasData){{
    var msg='🏖️ *Golf Cart Request — GolfCartRentalsCR*\\n\\n';
    if(loc) msg+='📍 *Location:* '+loc+'\\n';
    if(cart) msg+='🛒 *Cart:* '+cart+'\\n';
    if(pd) msg+='📅 *Pick-up:* '+pd+'\\n';
    if(dd) msg+='📅 *Drop-off:* '+dd+'\\n';
    if(nm) msg+='👤 *Name:* '+nm+'\\n';
    if(ph) msg+='📱 *Phone:* '+ph+'\\n';
    window.open('{WA}?text='+encodeURIComponent(msg.trim()),'_blank');
  }}else{{
    window.open('{WA}','_blank');
  }}
}}
(function(){{
  var t=new Date().toISOString().split('T')[0];
  var pd=document.getElementById('f-pickup-date'),dd=document.getElementById('f-dropoff-date');
  if(pd){{pd.min=t;pd.value=t;}}
  if(dd){{dd.min=t;var tm=new Date();tm.setDate(tm.getDate()+1);dd.min=tm.toISOString().split('T')[0];dd.value=tm.toISOString().split('T')[0];}}
}})();
</script>"""

def faq_block(items):
    html = '<div class="gcr-faq__list">'
    for q, a in items:
        html += f'<div class="gcr-faq-item"><div class="gcr-faq-item__q" onclick="gcrToggleFaq(this)"><span class="gcr-faq-item__q-text">{q}</span><span class="gcr-faq-item__icon">+</span></div><div class="gcr-faq-item__a">{a}</div></div>'
    html += '</div>'
    html += """<script>function gcrToggleFaq(el){var i=el.parentElement,w=i.classList.contains('open');document.querySelectorAll('.gcr-faq-item').forEach(function(x){x.classList.remove('open')});if(!w)i.classList.add('open');}</script>"""
    return html

def page_wrap(content):
    wa_float = f'<a href="{WA}" target="_blank" class="gcr-wa-float" aria-label="Book on WhatsApp">{WA_SVG} Book Now</a>'
    return f'<style>\n{SHARED_CSS}\n</style>\n<div class="gcr-wrap">{content}\n{wa_float}\n</div>'

# ─── LOCATION PAGE TEMPLATE ───────────────────────────────────────────────────

LOCATIONS = {
    12: {
        'name': 'Tamarindo',
        'slug': 'tamarindo',
        'img': 'ai-loc-tamarindo.jpg',
        'hero_sub': 'Explore Playa Grande, the estuary, and Tamarindo\'s best restaurants by golf cart. Available now — 1 hour confirmation.',
        'about': 'Tamarindo is Guanacaste\'s most popular beach town and the perfect place to explore by golf cart. The town is flat, walkable, and packed with beach access points, surf shops, and restaurants — all within easy cart distance.',
        'distance': '~1.5 hrs from Liberia Airport (LIR)',
        'best_for': 'Surfing, sunset dining, family beach days',
        'highlights': [
            ('🏄', 'Playa Grande', 'Drive 20 min north across the estuary bridge to this pristine leatherback turtle nesting beach and world-class surf break.'),
            ('🦅', 'Tamarindo Estuary', 'Cruise the estuary road at dusk for incredible birdwatching — herons, frigate birds, and the occasional crocodile.'),
            ('🍽️', 'Tamarindo Strip', 'Park your cart steps from the best ceviche, sushi, and smoothie spots in all of Guanacaste.'),
            ('🌊', 'Playa Langosta', 'A quieter beach just 10 min south of town, perfect for snorkeling and calm morning swims.'),
        ],
        'faqs': [
            ('Can I drive a golf cart to Playa Grande from Tamarindo?', 'Yes! Playa Grande is about 20 minutes north via the Las Baulas bridge road. The route is scenic and cart-friendly. Our providers will give you a local map when you pick up.'),
            ('How far is Playa Langosta by cart?', 'Playa Langosta is about 3–4 km south of central Tamarindo — roughly 10 minutes by cart. The road is paved and easy.'),
            ('Are there speed limits or areas I can\'t drive in Tamarindo?', 'Standard Costa Rica road rules apply. Golf carts (LSVs) are permitted on roads with speed limits up to 40 km/h. The main Tamarindo boulevard and beach roads are fully cart-accessible.'),
            ('Can you pick me up from Tamarindo Airport or the Daniel Oduber Airport?', 'For Tamarindo Airstrip arrivals, some providers offer direct pickup. For Liberia Airport (LIR), we can arrange a cart to be ready at your hotel when you arrive. Just let us know in your request.'),
        ],
    },
    13: {
        'name': 'Flamingo',
        'slug': 'flamingo',
        'img': 'ai-loc-flamingo.jpg',
        'hero_sub': 'Discover Playa Conchal, the Flamingo marina, and Brasilito\'s seaside restaurants by golf cart. White sand and crystal water await.',
        'about': 'Flamingo is one of Costa Rica\'s most upscale beach destinations, home to a full-service marina, pristine white-sand beaches, and easy access to Playa Conchal — consistently ranked among the best beaches in Central America.',
        'distance': '~1.5 hrs from Liberia Airport (LIR)',
        'best_for': 'Luxury beach days, sailing, Playa Conchal access',
        'highlights': [
            ('🐚', 'Playa Conchal', 'The beach famous for its crushed shell sand. Drive 5 minutes from Flamingo town to reach this stunning cove — perfect for snorkeling and paddleboarding.'),
            ('⛵', 'Flamingo Marina', 'The largest marina on Costa Rica\'s Pacific coast. Stroll the docks, book a fishing charter, or grab fresh sushi at the marina restaurants.'),
            ('🌅', 'Playa Brasilito', 'A charming fishing village 3 minutes by cart with laid-back sodas, great sunsets, and a very local vibe.'),
            ('🎣', 'Potrero Beach', 'A short 10-minute drive to quieter Playa Potrero — ideal for morning swims away from the crowds.'),
        ],
        'faqs': [
            ('Is Flamingo hilly for a golf cart?', 'Flamingo does have some hills — the road to the beach viewpoints can be steep. All our provider carts are street-legal LSVs with enough power for Flamingo\'s terrain. We\'ll note any hilly routes on your local map.'),
            ('Can I drive from Flamingo to Playa Conchal?', 'Yes! Playa Conchal is about 5–7 minutes south by cart via Brasilito. The route is paved and easy. Note that you park at the Brasilito entrance and walk the last 200m to the beach.'),
            ('Are there restaurants near the marina I can park at?', 'Absolutely — the marina area has multiple restaurants with easy cart parking right outside. It\'s one of the best lunch spots in Guanacaste.'),
            ('Can I get the cart delivered to my hotel or villa?', 'Yes! Most of our Flamingo providers offer delivery to hotels, villas, and vacation rentals in the area. Include your accommodation address when you request.'),
        ],
    },
    14: {
        'name': 'Playas del Coco',
        'slug': 'playas-del-coco',
        'img': 'ai-loc-coco.jpg',
        'hero_sub': 'Cruise Coco\'s beachfront strip, dive sites, and Playa Ocotal by golf cart. Closest beach town to Liberia Airport — arrive and ride.',
        'about': 'Playas del Coco is the most accessible beach town from Liberia International Airport — just 35 minutes away. It\'s a lively, social destination with a strong diving scene, a busy main beach strip, and great local dining.',
        'distance': '~35 min from Liberia Airport (LIR)',
        'best_for': 'Scuba diving, airport-adjacent stays, nightlife',
        'highlights': [
            ('🤿', 'Dive Sites', 'Coco is the gateway to some of Costa Rica\'s best Pacific dive sites. Drive your cart to the dive operators on the main strip and gear up.'),
            ('🏖️', 'Main Beach Strip', 'The flat waterfront boulevard is made for golf carts — restaurants, bars, and beach access all within one easy cruise.'),
            ('🌊', 'Playa Ocotal', 'A beautiful small cove 3 km south of Coco, accessible by cart. Calmer water, great snorkeling, and far fewer people.'),
            ('🍻', 'Coco Centro', 'The lively commercial center with sodas, supermarkets, and an evening seafood market — everything within cart distance.'),
        ],
        'faqs': [
            ('How far is Playas del Coco from Liberia Airport?', 'About 35 km — roughly 35 minutes by car. It\'s the closest beach town to LIR, making it ideal if you want to arrive, check in, and be on a cart the same afternoon.'),
            ('Can I drive to Playa Ocotal from Coco?', 'Yes! Playa Ocotal is about 3 km south — a 10-minute cart ride on a paved road. It\'s one of the nicest short drives in the area.'),
            ('Is the main beach area flat enough for a golf cart?', 'Very flat. The Coco beachfront road and commercial strip are ideal for golf carts. There are a few gentle hills heading out of town toward Ocotal.'),
            ('Is parking easy in Coco with a golf cart?', 'Much easier than a car! Golf carts can park in small spaces near most restaurants and shops on the main strip. Our providers will advise on the best spots.'),
        ],
    },
    15: {
        'name': 'Jacó',
        'slug': 'jaco',
        'img': 'ai-loc-jaco.jpg',
        'hero_sub': 'Ride Jacó\'s famous surf boulevard, reach Playa Hermosa, and explore the Central Pacific coast by golf cart. Closest beach to San José.',
        'about': 'Jacó is Costa Rica\'s liveliest Central Pacific beach town and the closest major beach to San José — just 1.5 hours away. Known for surfing, a buzzing nightlife scene, and easy access to Playa Hermosa and Carara National Park.',
        'distance': '~1.5 hrs from San José (SJO)',
        'best_for': 'Surfing, weekend getaways from San José, Central Pacific adventures',
        'highlights': [
            ('🏄', 'Playa Hermosa', 'Drive 6 km south on the coastal highway to Playa Hermosa — home to one of Costa Rica\'s most famous surf breaks and a beautiful black sand beach.'),
            ('🐊', 'Carara National Park', '30 minutes north by cart, where the dry and rainforest meet. Spot scarlet macaws, crocodiles, and sloths on a guided walk.'),
            ('🎭', 'Jacó Beachfront', 'The famous 4-km beach boulevard lined with surf shops, restaurants, and bars — cruise it end to end in your cart.'),
            ('🌴', 'Playa Esterillos', '25 km south — a wild, uncrowded beach for a half-day road trip by cart through the lush Central Pacific landscape.'),
        ],
        'faqs': [
            ('Can I take the golf cart on the coastal highway to Playa Hermosa?', 'The road to Playa Hermosa (Route 34) is a main highway — golf carts stay on the shoulder or use the beachside access roads. Our providers will advise the safest route and this short trip is very popular with cart renters.'),
            ('Is the Jacó beachfront safe for a golf cart at night?', 'Jacó is lively at night and the beach boulevard is well-lit. Keep standard precautions — same as any beach town. Our providers will share a local tips card with your cart.'),
            ('How long can I rent a cart in Jacó?', 'Most providers offer half-day (4h), full-day, and multi-day rentals. We\'ll find you the best rate for your duration when you request.'),
            ('Can the golf cart handle the hilly roads near Jacó?', 'The Jacó beachfront is flat. Roads toward Herradura and the hill areas have some incline but are manageable. We\'ll match you with the right cart and routes for your plans.'),
        ],
    },
    16: {
        'name': 'Manuel Antonio',
        'slug': 'manuel-antonio',
        'img': 'ai-loc-manuel.jpg',
        'hero_sub': 'Explore the Quepos corridor, national park beaches, and Manuel Antonio\'s scenic hilltop road by cart. Wildlife, waves, and freedom.',
        'about': 'Manuel Antonio combines Costa Rica\'s most visited national park with a stunning hilltop beach community. The famous road between Quepos and the park entrance is lined with jungle, restaurants, boutique hotels, and the best ocean views in the country.',
        'distance': '~3.5 hrs from San José (SJO)',
        'best_for': 'Wildlife, national park access, scenic drives',
        'highlights': [
            ('🐒', 'National Park Corridor', 'The 7-km road from Quepos to the park entrance is half the experience — monkeys hang from trees overhead, sloths sun on branches, and toucans cross the road.'),
            ('🏖️', 'Playa Biesanz', 'A secluded cove accessible by a short hike from the road above. Park your cart at the trailhead and walk 10 minutes to a quiet, snorkel-perfect beach.'),
            ('🌅', 'Punta Quepos Viewpoints', 'Drive to the lookout points above Manuel Antonio town for panoramic Pacific views — best at sunset.'),
            ('🛒', 'Quepos Market', 'The lively Quepos town center is 7 km north — a quick cart ride for fresh produce, local sodas, and the best sanduches in the area.'),
        ],
        'faqs': [
            ('Can I drive a golf cart on the Manuel Antonio park road?', 'Yes! The main road from Quepos to the park entrance is cart-accessible. It\'s the most scenic route in the area and the slow pace of a golf cart makes it even better for wildlife spotting.'),
            ('Is there parking near the national park entrance for golf carts?', 'Yes — there are small parking areas near the park entrance where carts can park. Arrive early (before 9am) to beat the crowds. The park itself requires entry tickets purchased online in advance.'),
            ('Can I get delivery to a hotel on the park road?', 'Absolutely — most Manuel Antonio providers deliver directly to hotels and lodges along the Quepos–park corridor, including the hillside hotels. Include your hotel name in your request.'),
            ('What is the road like? Is it safe for a golf cart?', 'The road is paved and in good condition, but it is hilly and curvy in sections. Our providers\' carts are fully capable on this road — and the views more than make up for the curves.'),
        ],
    },
    17: {
        'name': 'Potrero',
        'slug': 'potrero',
        'img': 'ai-loc-potrero.jpg',
        'hero_sub': 'Discover Playa Pan de Azúcar, quiet coves, and Potrero\'s unspoiled Guanacaste coast by cart. One of Costa Rica\'s best-kept secrets.',
        'about': 'Potrero is a quiet Guanacaste beach community just minutes from Flamingo, known for its calm bay, excellent sport fishing, and access to some of the most pristine beaches in Costa Rica including the legendary Playa Pan de Azúcar.',
        'distance': '~1.5 hrs from Liberia Airport (LIR)',
        'best_for': 'Off-the-beaten-path beaches, fishing, peaceful getaways',
        'highlights': [
            ('🍬', 'Playa Pan de Azúcar', '"Sugar Beach" — consistently ranked one of Costa Rica\'s most beautiful and least-visited beaches. Drive 10 minutes north of Potrero on a dirt road to reach this hidden gem.'),
            ('⛵', 'Playa Flamingo (nearby)', 'Flamingo\'s white sand beach and marina are just 5 minutes south — easily reached for a morning swim, then back to Potrero\'s quiet streets by noon.'),
            ('🎣', 'Potrero Bay', 'The calm bay in front of Potrero town is perfect for kayaking, paddleboarding, and watching the local fishing boats come in at dawn.'),
            ('🌄', 'Sunset Drives', 'Potrero\'s open roads and low traffic make it ideal for evening sunset drives along the coast. No rush hour, no crowds — just you and the Pacific.'),
        ],
        'faqs': [
            ('Is the road to Playa Pan de Azúcar accessible by golf cart?', 'The last section to Pan de Azúcar is a dirt road with some ruts — it\'s accessible in dry season (Nov–Apr) with no issues. In rainy season, it can be rougher. Ask your provider about current conditions.'),
            ('How far is Potrero from Flamingo?', 'About 5 km — less than 10 minutes by cart. They are effectively the same area, and you can easily split your day between the two beaches.'),
            ('Is Potrero a good choice for families?', 'It\'s one of the best. The bay is calm and safe for kids, traffic is minimal, and the relaxed pace suits families perfectly. The golf cart gives you freedom without the stress of renting a full car.'),
            ('Can I use the cart to explore both Potrero and Flamingo in one day?', 'Absolutely — that\'s one of the most popular things to do. Potrero in the morning, Conchal in the afternoon, Marina dinner at Flamingo. One cart, one amazing day.'),
        ],
    },
}

def location_page(data):
    name = data['name']
    img = data['img']
    hero_sub = data['hero_sub']
    about = data['about']
    distance = data['distance']
    best_for = data['best_for']
    highlights = data['highlights']
    faqs = data['faqs']

    highlights_html = ''.join(f"""
      <div class="gcr-step" style="text-align:left;padding:2rem">
        <div style="font-size:2.5rem;margin-bottom:.75rem">{icon}</div>
        <div class="gcr-step__title">{title}</div>
        <div class="gcr-step__desc">{desc}</div>
      </div>""" for icon, title, desc in highlights)

    general_faqs = [
        ('How does GolfCartRentalsCR work?', f'We\'re a marketplace that connects you with vetted local golf cart providers in {name}. Submit your request, we check availability with our partner providers, and reply on WhatsApp within 1 hour with pricing and options. You pay the provider directly.'),
        ('Do I need a special license to drive a golf cart in Costa Rica?', 'A valid driver\'s license from your home country is all you need. No special permit or international driving license is required for LSVs (Low Speed Vehicles) in Costa Rica.'),
        ('What is the cancellation policy?', 'Most providers offer free cancellation up to 24 hours before pickup. Message us on WhatsApp to modify or cancel and we\'ll coordinate with the provider.'),
    ]

    return page_wrap(f"""
<section class="gcr-hero">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/{img}')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>Available Now · {name}</div>
    <h1 class="gcr-hero__h1">Golf Cart Rental<br>in <em>{name}</em>,<br>Costa Rica</h1>
    <p class="gcr-hero__sub">{hero_sub}</p>
    <div class="gcr-hero__ctas">
      <a href="#booking-form" class="gcr-btn gcr-btn--primary">🏖️ Request a Cart</a>
      <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--whatsapp" style="font-size:.875rem">{WA_SVG} WhatsApp Us</a>
    </div>
  </div>
</section>

<div class="gcr-stats">
  <div class="gcr-stats__inner">
    <div class="gcr-stat"><div class="gcr-stat__num">1h</div><div class="gcr-stat__label">Avg Response Time</div></div>
    <div class="gcr-stat"><div class="gcr-stat__num">3</div><div class="gcr-stat__label">Cart Sizes Available</div></div>
    <div class="gcr-stat"><div class="gcr-stat__num">4.9★</div><div class="gcr-stat__label">Google Rating</div></div>
    <div class="gcr-stat"><div class="gcr-stat__num">✓</div><div class="gcr-stat__label">Hotel Delivery</div></div>
  </div>
</div>

<section class="gcr-section">
  <div class="gcr-container">
    <div class="gcr-guide__cols">
      <div class="gcr-guide__img"><img src="{IMG}/{img}" alt="Golf cart rental {name} Costa Rica" loading="lazy"></div>
      <div class="gcr-guide__text">
        <span class="gcr-label">About {name}</span>
        <h2 class="gcr-h2" style="margin-bottom:1rem">Golf Cart Rentals in {name}</h2>
        <p>{about}</p>
        <div style="margin-top:1.5rem;display:flex;flex-direction:column;gap:.75rem">
          <div style="display:flex;gap:.75rem;align-items:center;font-size:.9375rem;color:#475569"><span style="font-size:1.25rem">✈️</span><span>{distance}</span></div>
          <div style="display:flex;gap:.75rem;align-items:center;font-size:.9375rem;color:#475569"><span style="font-size:1.25rem">🏖️</span><span>Best for: {best_for}</span></div>
          <div style="display:flex;gap:.75rem;align-items:center;font-size:.9375rem;color:#475569"><span style="font-size:1.25rem">🛒</span><span>2, 4 &amp; 6-passenger carts available</span></div>
          <div style="display:flex;gap:.75rem;align-items:center;font-size:.9375rem;color:#475569"><span style="font-size:1.25rem">🚗</span><span>Hotel delivery available in most areas</span></div>
        </div>
        <div style="margin-top:2rem">
          <a href="#booking-form" class="gcr-btn gcr-btn--primary">Check Availability in {name}</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="gcr-section gcr-section--gray">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">Explore by Cart</span>
    <h2 class="gcr-h2">What to See in {name}</h2>
    <p class="gcr-lead" style="margin:0 auto">The best spots in {name} — all reachable by golf cart.</p>
    <div class="gcr-steps" style="margin-top:3rem">{highlights_html}</div>
  </div>
</section>

<section class="gcr-section gcr-section--dark">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label gcr-label--light">How It Works</span>
    <h2 class="gcr-h2" style="color:#fff;max-width:640px;margin:0 auto 1rem">Get a Golf Cart in {name} in 3 Steps</h2>
    <p class="gcr-lead" style="margin:0 auto">We handle the search — you enjoy the beach.</p>
    <div class="gcr-steps" style="margin-top:3rem">
      <div class="gcr-step"><div class="gcr-step__num">1</div><div class="gcr-step__icon">📋</div><div class="gcr-step__title">Send Your Request</div><div class="gcr-step__desc">Fill the form below with your dates, group size, and cart type. Takes 60 seconds.</div></div>
      <div class="gcr-step"><div class="gcr-step__num">2</div><div class="gcr-step__icon">🤝</div><div class="gcr-step__title">We Match &amp; Confirm</div><div class="gcr-step__desc">We check availability with local {name} providers and reply on WhatsApp within 1 hour.</div></div>
      <div class="gcr-step"><div class="gcr-step__num">3</div><div class="gcr-step__icon">🏖️</div><div class="gcr-step__title">Pick Up &amp; Cruise</div><div class="gcr-step__desc">Collect at the provider location or get hotel delivery. Quick walkthrough and you're off.</div></div>
    </div>
  </div>
</section>

{booking_form(name)}

<section class="gcr-section" id="faq">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">FAQs</span>
    <h2 class="gcr-h2">Golf Cart Rental {name} — FAQ</h2>
    <p class="gcr-lead" style="margin:0 auto">Everything you need to know about renting a golf cart in {name}.</p>
    {faq_block(faqs + general_faqs)}
  </div>
</section>

{FOOTER}""")


# ─── OTHER PAGES ─────────────────────────────────────────────────────────────

def locations_parent():
    cards = ''.join(f"""
      <div class="gcr-loc-card">
        <div class="gcr-loc-card__img"><img src="{IMG}/{d['img']}" alt="Golf cart rental {d['name']} Costa Rica" loading="lazy">{'<span class="gcr-loc-card__badge">Most Popular</span>' if d['name']=='Tamarindo' else ''}</div>
        <div class="gcr-loc-card__body">
          <div class="gcr-loc-card__name">{d['name']}</div>
          <div class="gcr-loc-card__desc">{d['hero_sub'][:80]}…</div>
          <a href="/location/{d['slug']}/" class="gcr-loc-card__link">Rent in {d['name']} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
        </div>
      </div>""" for d in LOCATIONS.values())
    return page_wrap(f"""
<section class="gcr-hero">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/hero-cr-beach.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>6 Locations Available</div>
    <h1 class="gcr-hero__h1">Golf Cart Rentals<br>Across Costa Rica's<br><em>Best Beach Towns</em></h1>
    <p class="gcr-hero__sub">From Tamarindo's surf breaks to Manuel Antonio's national park — we connect you with the best local cart providers in each destination.</p>
    <div class="gcr-hero__ctas">
      <a href="#locations-grid" class="gcr-btn gcr-btn--primary">🗺️ Choose Your Location</a>
      <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--outline">Ask on WhatsApp</a>
    </div>
  </div>
</section>
<section class="gcr-section gcr-section--gray" id="locations-grid">
  <div class="gcr-container">
    <span class="gcr-label">Where We Operate</span>
    <h2 class="gcr-h2">Choose Your Beach Town</h2>
    <p class="gcr-lead">Select a location to see local highlights, cart options, and request availability directly via WhatsApp.</p>
    <div class="gcr-locations__grid">{cards}</div>
  </div>
</section>
{booking_form()}
{FOOTER}""")


def how_it_works_page():
    hiw_faqs = faq_block([
        ('Is GolfCartRentalsCR a rental company?', "No — we're a marketplace and booking service. We connect you with local golf cart rental companies in Costa Rica's beach towns. We don't own any carts ourselves. Think of us as your local contact who knows all the best providers."),
        ('How do you make money?', "We earn a commission from the rental provider when a booking is confirmed. There is no extra charge to you — you pay the provider's standard rate directly."),
        ("What if I'm not happy with the cart or service?", "Contact us immediately on WhatsApp. We work with the provider to resolve the issue, including arranging a replacement cart if needed. Your satisfaction is important to us and our provider partners."),
        ('How quickly do you respond?', "We aim to reply within 1 hour during business hours (7am–9pm Costa Rica time). In peak season (Dec–Apr), response times may be slightly longer — we recommend requesting 48+ hours in advance."),
        ('Do you operate in cities or only beach towns?', "Currently we focus on Costa Rica's beach towns — Tamarindo, Flamingo, Playas del Coco, Jacó, Manuel Antonio, and Potrero. These are the locations where golf carts are legal, practical, and loved by visitors."),
    ])
    return page_wrap(f"""
<section class="gcr-hero">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/ai-cart-hero-cr.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>Simple &amp; Fast</div>
    <h1 class="gcr-hero__h1">How GolfCartRentalsCR<br><em>Works</em></h1>
    <p class="gcr-hero__sub">We're a marketplace connecting travelers with vetted local golf cart providers across Costa Rica's best beach towns. Here's exactly how we work.</p>
    <div class="gcr-hero__ctas">
      <a href="#booking-form" class="gcr-btn gcr-btn--primary">🏖️ Start Your Request</a>
    </div>
  </div>
</section>
<section class="gcr-section">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">The Process</span>
    <h2 class="gcr-h2">3 Steps to Your Golf Cart</h2>
    <p class="gcr-lead" style="margin:0 auto">No phone tag. No language barriers. No hunting for providers. One request to us — we handle everything.</p>
    <div class="gcr-steps" style="margin-top:3.5rem">
      <div class="gcr-step"><div class="gcr-step__num">1</div><div class="gcr-step__icon">📋</div><div class="gcr-step__title">Send Your Request</div><div class="gcr-step__desc">Fill in your location, dates, group size, and cart type using the form on this page. Alternatively, message us directly on WhatsApp. Takes 60 seconds.</div></div>
      <div class="gcr-step"><div class="gcr-step__num">2</div><div class="gcr-step__icon">🤝</div><div class="gcr-step__title">We Match &amp; Confirm</div><div class="gcr-step__desc">We check availability with all our local partner providers in your chosen town and reply within 1 hour with pricing, cart options, and delivery details.</div></div>
      <div class="gcr-step"><div class="gcr-step__num">3</div><div class="gcr-step__icon">🏖️</div><div class="gcr-step__title">Pick Up &amp; Cruise</div><div class="gcr-step__desc">Pick up from the provider location or request hotel delivery. Quick walkthrough, and you're on the road to the beach.</div></div>
    </div>
  </div>
</section>
<section class="gcr-section gcr-section--dark">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label gcr-label--light">Why Use a Marketplace</span>
    <h2 class="gcr-h2" style="color:#fff;max-width:640px;margin:0 auto 1rem">Why Book Through Us?</h2>
    <p class="gcr-lead" style="margin:0 auto">We save you hours of research and protect you from dealing with unreliable operators.</p>
    <div class="gcr-why__grid" style="margin-top:3rem">
      <div class="gcr-why-item"><div class="gcr-why-item__icon">🔍</div><div class="gcr-why-item__title">We Vet Every Provider</div><div class="gcr-why-item__desc">We only work with licensed, insured, and reputable local operators in each beach town. No random Craigslist finds.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">💰</div><div class="gcr-why-item__title">No Markup to You</div><div class="gcr-why-item__desc">We earn a commission from the provider — not from you. You pay the provider's standard rate, sometimes even better.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">🌎</div><div class="gcr-why-item__title">Local Knowledge</div><div class="gcr-why-item__desc">We know the best providers in each town, which routes are cart-friendly, and what to watch out for. Real local insight.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">💬</div><div class="gcr-why-item__title">One Point of Contact</div><div class="gcr-why-item__desc">Problems? Questions? Changes? Message us on WhatsApp. We handle communication with the provider so you don't have to.</div></div>
    </div>
  </div>
</section>
{booking_form()}
<section class="gcr-section" id="faq">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">FAQs</span>
    <h2 class="gcr-h2">Common Questions About How We Work</h2>
    {hiw_faqs}
  </div>
</section>
{FOOTER}""")


def fleet_page():
    def cart_card(name, pax, img, tag, cap, features, popular=False):
        badge = '<span class="gcr-fleet-card__popular-tag">Most Popular</span>' if popular else ''
        feats = ''.join(f'<div class="gcr-fleet-card__feature">{f}</div>' for f in features)
        return f"""
      <div class="gcr-fleet-card{' gcr-fleet-card--popular' if popular else ''}">
        <div class="gcr-fleet-card__img"><img src="{IMG}/{img}" alt="{name} golf cart rental Costa Rica" loading="lazy">{badge}</div>
        <div class="gcr-fleet-card__body">
          <div class="gcr-fleet-card__name">{name}</div>
          <div class="gcr-fleet-card__cap">{cap}</div>
          <div class="gcr-fleet-card__features">{feats}</div>
          <a href="#booking-form" class="gcr-fleet-card__cta">Request This Type</a>
        </div>
      </div>"""

    return page_wrap(f"""
<section class="gcr-hero">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/ai-cart-hero-cr.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>All Cart Types Available</div>
    <h1 class="gcr-hero__h1">Golf Cart Types<br>Available Across<br><em>Costa Rica</em></h1>
    <p class="gcr-hero__sub">2, 4, and 6-passenger street-legal golf carts available from our partner providers across 6 beach towns. Tell us your group size — we'll find the right cart.</p>
    <div class="gcr-hero__ctas">
      <a href="#booking-form" class="gcr-btn gcr-btn--primary">🛒 Request a Cart</a>
    </div>
  </div>
</section>
<section class="gcr-section gcr-section--gray">
  <div class="gcr-container">
    <span class="gcr-label">Cart Types Available</span>
    <h2 class="gcr-h2">2, 4 &amp; 6-Passenger Carts Across All Locations</h2>
    <p class="gcr-lead">All carts in our provider network are street-legal LSVs — registered, insured, and inspected before every rental.</p>
    <div class="gcr-fleet__grid">
      {cart_card('2-Passenger Cart','2','ai-cart-2pax-cr-1.jpg','','👥 Perfect for couples',['Street-legal &amp; insured','Bluetooth speaker','USB charging port','Cooler holder','Compact — easy parking'])}
      {cart_card('4-Passenger Cart','4','ai-cart-4pax-cr.jpg','','👨‍👩‍👧‍👦 Ideal for families &amp; groups',['Street-legal &amp; insured','Bluetooth speaker','USB ports + shade canopy','Extra storage for gear','Most popular size'],popular=True)}
      {cart_card('6-Passenger Cart','6','ai-cart-6pax-cr-1.jpg','','🎉 The party cart',['Street-legal &amp; insured','Bluetooth speaker','Full shade canopy','Maximum storage &amp; comfort','Great for large groups'])}
    </div>
  </div>
</section>
<section class="gcr-section">
  <div class="gcr-container">
    <div class="gcr-guide__cols">
      <div class="gcr-guide__text">
        <span class="gcr-label">What to Expect</span>
        <h2 class="gcr-h2" style="margin-bottom:1rem">All Our Partner Provider Carts Include</h2>
        <h3>Street Legal &amp; Insured</h3>
        <p>Every cart in our network is a registered Low Speed Vehicle (LSV) — plated, insured, and compliant with Costa Rica road law. You're legally on the road.</p>
        <h3>Full Walkthrough at Pickup</h3>
        <p>Your provider will walk you through the cart's controls, local traffic rules, and recommend the best routes for your plans. Takes 5 minutes and is incredibly useful.</p>
        <h3>Local Maps &amp; Route Tips</h3>
        <p>All our providers include a local map showing cart-friendly roads, must-see spots, and any areas to avoid. Printed or digital depending on the provider.</p>
        <h3>Emergency Contact Available</h3>
        <p>All providers offer a direct contact number for the duration of your rental. Anything goes wrong — one call and they're on it.</p>
      </div>
      <div class="gcr-guide__img"><img src="{IMG}/ai-cart-hero-cr.jpg" alt="Golf cart on Costa Rica beach road" loading="lazy"></div>
    </div>
  </div>
</section>
{booking_form()}
{FOOTER}""")


def faq_full_page():
    all_faqs = [
        ('Are golf carts street-legal in Costa Rica?', 'Yes. Golf carts classified as Low-Speed Vehicles (LSVs) are legally permitted on most roads in Costa Rica\'s beach towns, including Tamarindo, Flamingo, Jacó, Manuel Antonio, Playas del Coco, and Potrero. All providers in our network operate registered and insured LSVs.'),
        ('How does GolfCartRentalsCR work?', 'We\'re a marketplace. You submit a request with your dates, location, and group size. We check availability with our local partner providers and reply on WhatsApp within 1 hour with pricing and options. You pay the provider directly — we earn a small commission from them.'),
        ('What documents do I need to rent a golf cart?', 'A valid driver\'s license from your home country, a credit card for the security deposit, and to be at least 21 years old. An international driving permit is welcome but not required in Costa Rica.'),
        ('Do you deliver the cart to my hotel?', 'Yes! Most providers in our network offer hotel and vacation rental delivery. Include your hotel name or address in the request form and we\'ll confirm delivery details with the provider. A small delivery fee may apply depending on distance.'),
        ('How far in advance should I book?', 'We recommend at least 48 hours in advance, especially in high season (December–April). Same-day requests are sometimes possible — message us on WhatsApp and we\'ll check.'),
        ('Is a deposit required?', 'Yes, a refundable security deposit is held on your credit card at pickup. It\'s fully released when the cart is returned in the same condition.'),
        ('What happens if the cart breaks down?', 'All providers in our network offer roadside support. If anything goes wrong, WhatsApp us and we\'ll coordinate with the provider immediately to get you a replacement or assistance.'),
        ('Can I take the cart on the beach?', 'Beach access varies by location. Some beaches in Guanacaste permit vehicle access; others are pedestrian-only. Your provider will advise on permitted areas when you pick up.'),
        ('What is the cancellation policy?', 'Free cancellation up to 24 hours before pickup with most providers. Within 24 hours, a fee of one day\'s rental may apply. Message us on WhatsApp — we\'re flexible.'),
        ('How much does it cost to rent a golf cart?', 'Pricing varies by location, provider, cart size, and season. We find you the best available rate when you request. As a rough guide, a full day in a 4-passenger cart typically ranges from $60–$120 USD depending on the town and season.'),
        ('Is GolfCartRentalsCR a rental company?', 'No — we\'re a booking marketplace. We connect you with local golf cart rental companies. We don\'t own any carts. This means you get local expertise and competitive pricing without the markup.'),
        ('Can children ride in the golf cart?', 'Yes. Golf carts do not require seatbelts by law in Costa Rica, but most carts have safety bars. Children should be supervised at all times. Age and size restrictions vary by provider — ask when you request.'),
    ]
    return page_wrap(f"""
<section class="gcr-hero" style="min-height:50vh">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/hero-cr-beach.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>We Have Answers</div>
    <h1 class="gcr-hero__h1">Frequently Asked<br><em>Questions</em></h1>
    <p class="gcr-hero__sub">Everything you need to know about renting a golf cart in Costa Rica through GolfCartRentalsCR.</p>
    <div class="gcr-hero__ctas">
      <a href="#booking-form" class="gcr-btn gcr-btn--primary">🏖️ Request a Cart</a>
      <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--outline">Ask on WhatsApp</a>
    </div>
  </div>
</section>
<section class="gcr-section" id="faq">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">All FAQs</span>
    <h2 class="gcr-h2">Your Questions, Answered</h2>
    <p class="gcr-lead" style="margin:0 auto">Can't find your answer? Message us on WhatsApp — we're real people and we reply fast.</p>
    {faq_block(all_faqs)}
  </div>
</section>
{booking_form()}
{FOOTER}""")


def contact_page():
    return page_wrap(f"""
<section class="gcr-hero" style="min-height:50vh">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/hero-beach.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>Real People, Fast Replies</div>
    <h1 class="gcr-hero__h1">Contact<br><em>GolfCartRentalsCR</em></h1>
    <p class="gcr-hero__sub">The fastest way to reach us is WhatsApp. We're available 7am–9pm Costa Rica time and reply within 1 hour.</p>
    <div class="gcr-hero__ctas">
      <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--whatsapp">{WA_SVG} Message Us on WhatsApp</a>
    </div>
  </div>
</section>
<section class="gcr-section">
  <div class="gcr-container">
    <div class="gcr-guide__cols">
      <div class="gcr-guide__text">
        <span class="gcr-label">Get in Touch</span>
        <h2 class="gcr-h2" style="margin-bottom:1rem">How to Reach Us</h2>
        <h3>WhatsApp (Fastest)</h3>
        <p>Message us at <a href="{WA}" target="_blank" style="color:#F59E0B;font-weight:600">+506 8815-7780</a> for availability requests, questions, changes, or anything else. We reply within 1 hour.</p>
        <h3>Email</h3>
        <p>For non-urgent questions: <a href="mailto:info@golfcartrentalscr.com" style="color:#F59E0B;font-weight:600">info@golfcartrentalscr.com</a>. We aim to reply within 24 hours.</p>
        <h3>Service Area</h3>
        <p>We operate in 6 Costa Rica beach towns:</p>
        <ul>
          <li><strong>Guanacaste:</strong> Tamarindo, Flamingo, Playas del Coco, Potrero</li>
          <li><strong>Central Pacific:</strong> Jacó, Manuel Antonio</li>
        </ul>
        <h3>Hours</h3>
        <p>7:00 AM – 9:00 PM, Costa Rica Time (CST/UTC-6). We're available 7 days a week including holidays.</p>
        <div style="margin-top:2rem">
          <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--whatsapp">{WA_SVG} Open WhatsApp Chat</a>
        </div>
      </div>
      <div>
        <div style="background:#F8FAFC;border-radius:24px;padding:2.5rem">
          <h3 style="font-size:1.25rem;font-weight:800;color:#0A2540;margin-bottom:1.5rem">Send Us a Message</h3>
          <div class="gcr-form__group"><label>Your Name</label><input type="text" placeholder="John Smith"></div>
          <div class="gcr-form__group"><label>Email</label><input type="email" placeholder="you@email.com"></div>
          <div class="gcr-form__group"><label>Subject</label><input type="text" placeholder="Cart request, question, partnership…"></div>
          <div class="gcr-form__group"><label>Message</label><textarea placeholder="Tell us what you need…" style="min-height:120px"></textarea></div>
          <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--whatsapp" style="width:100%;justify-content:center">{WA_SVG} Send via WhatsApp</a>
          <p style="text-align:center;font-size:.8rem;color:#94A3B8;margin-top:.875rem">We'll respond directly on WhatsApp</p>
        </div>
      </div>
    </div>
  </div>
</section>
{FOOTER}""")


def partner_page():
    return page_wrap(f"""
<section class="gcr-hero">
  <div class="gcr-hero__bg" style="background-image:url('{IMG}/ai-cart-hero-cr.jpg')"></div>
  <div class="gcr-hero__overlay"></div>
  <div class="gcr-hero__content">
    <div class="gcr-hero__badge"><span class="gcr-hero__badge-dot"></span>Partner With Us</div>
    <h1 class="gcr-hero__h1">Grow Your Golf Cart<br>Rental Business<br><em>With Us</em></h1>
    <p class="gcr-hero__sub">We connect qualified travelers directly to local providers. If you run a golf cart rental company in Costa Rica, join our provider network and receive pre-qualified booking requests via WhatsApp.</p>
    <div class="gcr-hero__ctas">
      <a href="#partner-form" class="gcr-btn gcr-btn--primary">Apply to Join</a>
      <a href="{WA}" target="_blank" class="gcr-btn gcr-btn--outline">Ask Us First</a>
    </div>
  </div>
</section>
<section class="gcr-section">
  <div class="gcr-container" style="text-align:center">
    <span class="gcr-label">Why Partner With Us</span>
    <h2 class="gcr-h2">What You Get as a GolfCartRentalsCR Partner</h2>
    <div class="gcr-why__grid" style="margin-top:3rem;background:#0A2540;border-radius:24px;padding:3rem">
      <div class="gcr-why-item"><div class="gcr-why-item__icon">📲</div><div class="gcr-why-item__title">Pre-Qualified Leads</div><div class="gcr-why-item__desc">We send you booking requests from travelers who are ready to rent — dates confirmed, cart size chosen, hotel address included.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">💰</div><div class="gcr-why-item__title">Commission-Only Model</div><div class="gcr-why-item__desc">No listing fees, no monthly subscriptions. We earn a small commission only when a booking converts. Zero risk to join.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">🌐</div><div class="gcr-why-item__title">English-Language Reach</div><div class="gcr-why-item__desc">We market exclusively to English-speaking tourists — the highest-value rental segment in Costa Rica's beach towns.</div></div>
      <div class="gcr-why-item"><div class="gcr-why-item__icon">🤝</div><div class="gcr-why-item__title">We Handle Communication</div><div class="gcr-why-item__desc">We manage initial client communication, requests, and questions in English so you can focus on your operation.</div></div>
    </div>
  </div>
</section>
<section class="gcr-section gcr-section--gray" id="partner-form">
  <div class="gcr-container">
    <div class="gcr-guide__cols">
      <div class="gcr-guide__text">
        <span class="gcr-label">Partner Requirements</span>
        <h2 class="gcr-h2" style="margin-bottom:1rem">Who We Work With</h2>
        <h3>Licensed &amp; Insured</h3>
        <p>All partner providers must have registered, plated, and insured carts. We verify documentation before onboarding.</p>
        <h3>Operating in Our Locations</h3>
        <p>We currently need providers in Tamarindo, Flamingo, Playas del Coco, Jacó, Manuel Antonio, and Potrero.</p>
        <h3>Responsive</h3>
        <p>Providers must be able to respond to booking requests within 2 hours and maintain at least a 4.5-star guest experience rating.</p>
        <h3>Hotel Delivery (Preferred)</h3>
        <p>Providers that offer hotel delivery receive significantly more requests. Not required but strongly recommended.</p>
      </div>
      <div style="background:#fff;border-radius:24px;padding:2.5rem;box-shadow:0 4px 20px rgba(0,0,0,.10)">
        <h3 style="font-size:1.25rem;font-weight:800;color:#0A2540;margin-bottom:.5rem">Apply to Become a Partner</h3>
        <p style="font-size:.9rem;color:#94A3B8;margin-bottom:1.5rem">We'll review your application and reach out within 48 hours.</p>
        <div class="gcr-form__group"><label>Business / Owner Name</label><input type="text" placeholder="Your name or business name"></div>
        <div class="gcr-form__group"><label>Location(s)</label><select><option>Tamarindo</option><option>Flamingo</option><option>Playas del Coco</option><option>Jacó</option><option>Manuel Antonio</option><option>Potrero</option><option>Multiple Locations</option></select></div>
        <div class="gcr-form__group"><label>Number of Carts Available</label><input type="number" placeholder="e.g. 5" min="1"></div>
        <div class="gcr-form__group"><label>WhatsApp Number</label><input type="tel" placeholder="+506 8888 0000"></div>
        <div class="gcr-form__group"><label>Tell us about your operation</label><textarea placeholder="Types of carts, years in business, delivery area, anything else…" style="min-height:100px"></textarea></div>
        <a href="{WA}?text=Hi!%20I%27d%20like%20to%20become%20a%20GolfCartRentalsCR%20partner%20provider." target="_blank" class="gcr-btn gcr-btn--whatsapp" style="width:100%;justify-content:center">{WA_SVG} Submit Application via WhatsApp</a>
        <p style="text-align:center;font-size:.8rem;color:#94A3B8;margin-top:.875rem">This opens WhatsApp with your info pre-filled</p>
      </div>
    </div>
  </div>
</section>
{FOOTER}""")


# ─── BUILD ALL PAGES ─────────────────────────────────────────────────────────

PAGES = {}

# Location pages
for pid, data in LOCATIONS.items():
    PAGES[pid] = location_page(data)

# Other pages
PAGES[6]  = locations_parent()
PAGES[7]  = how_it_works_page()
PAGES[8]  = fleet_page()
PAGES[9]  = faq_full_page()
PAGES[10] = contact_page()
PAGES[11] = partner_page()

# ─── PUSH TO WORDPRESS ───────────────────────────────────────────────────────

def push_page(page_id, html):
    html = strip_style_blanks(html)
    payload = json.dumps({'content': html}).encode('utf-8')
    req = urllib.request.Request(
        f'{BASE}/wp-json/wp/v2/pages/{page_id}',
        data=payload,
        method='POST',
        headers={'Authorization': f'Basic {CREDS}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        return resp.status, data.get('modified',''), data.get('slug','')

print(f"Pushing {len(PAGES)} pages...")
for pid, html in PAGES.items():
    status, modified, slug = push_page(pid, html)
    print(f"  [{status}] ID:{pid:3d}  slug:{slug:30s}  html:{len(html):6d}chars  modified:{modified}")
    time.sleep(0.5)

print("Done!")
