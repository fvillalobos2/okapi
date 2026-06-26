#!/usr/bin/env python3
"""
Innova CS Analysis v2 — Won + Lost deals comparison.
Extracts: products, funnel, voice/tone, objections, onboarding, areas of improvement.

Usage:
  ANTHROPIC_API_KEY=sk-ant-... python3 scripts/analyze_innova_cs.py
  WON_CSV=/path/won.csv LOST_CSV=/path/lost.csv MAX_CHATS=400 ANTHROPIC_API_KEY=... python3 ...
"""

import json, os, re, sys, time, traceback
from datetime import datetime
import requests
import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
TIMELINES_TOKEN   = "ed99c00f-5375-464e-8c48-ad1043de1eea"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
BASE_URL          = "https://app.timelines.ai/integrations/api"
HEADERS           = {"Authorization": f"Bearer {TIMELINES_TOKEN}"}

WON_CSV           = os.environ.get("WON_CSV",  "/Users/fvlllbs/Downloads/deals-12546509-76.csv")
LOST_CSV          = os.environ.get("LOST_CSV",  "")   # set when available
OUTPUT_DIR        = os.path.dirname(os.path.abspath(__file__)) + "/.."
LOG_PATH          = f"{OUTPUT_DIR}/innova_cs_debug.log"

MAX_WON           = int(os.environ.get("MAX_CHATS", "400"))
MAX_LOST          = int(os.environ.get("MAX_LOST", "50"))
SKIP_WON          = os.environ.get("SKIP_WON", "0") == "1"  # reuse previous WON analysis
MESSAGES_PER_CHAT = 60
MIN_MESSAGES      = 3
BATCH_SIZE        = 3
REQUEST_DELAY     = 1.2

# ── Logger ────────────────────────────────────────────────────────────────────
log_file = open(LOG_PATH, "w", encoding="utf-8", buffering=1)

def log(msg, level="INFO"):
    ts   = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    log_file.write(line + "\n")

def log_warn(msg): log(msg, "WARN")
def log_err(msg):  log(msg, "ERROR")
def log_ok(msg):   log(msg, "OK")

# ── Timelines API ─────────────────────────────────────────────────────────────

def safe_get(url, params=None, retries=5):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=20)
            if r.status_code == 429:
                wait = 4 * (attempt + 1)
                log_warn(f"Rate limit — waiting {wait}s")
                time.sleep(wait)
                continue
            if r.status_code == 404:
                return None
            r.raise_for_status()
            text = r.content.decode("utf-8", errors="replace")
            text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
            return json.loads(text)
        except json.JSONDecodeError:
            if attempt == retries - 1:
                return None
        except requests.RequestException as e:
            if attempt == retries - 1:
                log_warn(f"Request failed: {e}")
                return None
        time.sleep(2 * (attempt + 1))
    return None


def extract_chat_ids(csv_path):
    ids = []
    with open(csv_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = re.search(r'/chat/(\d+)/messages', line)
            if m:
                ids.append(int(m.group(1)))
    return list(dict.fromkeys(ids))


def fetch_messages(chat_id):
    data = safe_get(f"{BASE_URL}/chats/{chat_id}/messages", {"limit": MESSAGES_PER_CHAT})
    if not data:
        return []
    return data.get("data", {}).get("messages", [])


def format_conversation(chat_id, messages, label=""):
    lines = [f"=== Chat {chat_id} {f'[{label}]' if label else ''} ==="]
    for m in reversed(messages):
        direction = "CS" if m.get("from_me") else "Cliente"
        ts   = (m.get("timestamp") or "")[:16]
        text = (m.get("text") or "").strip()
        if m.get("has_attachment") and not text:
            text = "[archivo adjunto]"
        if text:
            lines.append(f"[{ts}] {direction}: {text}")
    return "\n".join(lines)


def fetch_conversations(chat_ids, max_count, label):
    log(f"\nFetching {label} chats (max {max_count})...")
    if len(chat_ids) > max_count:
        step = len(chat_ids) // max_count
        sampled = chat_ids[::step][:max_count]
        log(f"Sampling {len(sampled)} of {len(chat_ids)} (every {step}th)")
    else:
        sampled = chat_ids

    conversations = []
    skipped = 0

    for i, chat_id in enumerate(sampled):
        messages = fetch_messages(chat_id)
        text_msgs = [m for m in messages if (m.get("text") or "").strip()]

        if len(text_msgs) < MIN_MESSAGES:
            skipped += 1
            time.sleep(REQUEST_DELAY * 0.5)
            continue

        conversations.append(format_conversation(chat_id, messages, label))

        if (i + 1) % 20 == 0:
            log(f"  {i+1}/{len(sampled)} checked | {len(conversations)} with content | {skipped} empty")

        time.sleep(REQUEST_DELAY)

    log_ok(f"{label}: {len(conversations)} chats fetched ({skipped} skipped)")
    return conversations

# ── Claude analysis ───────────────────────────────────────────────────────────

SYSTEM_WON = """Eres un analista de ventas para Innova (empresa costarricense de cortinas, persianas, toldos y pisos).
Analiza conversaciones de ventas EXITOSAS. Extrae insights concretos con frases TEXTUALES.
Responde en español. Solo JSON, sin texto extra."""

SYSTEM_LOST = """Eres un analista de ventas para Innova (empresa costarricense de cortinas, persianas, toldos y pisos).
Analiza conversaciones de ventas FALLIDAS (el cliente NO compró). Identifica qué salió mal.
Extrae patrones de fracaso, objeciones no resueltas, errores de CS, y oportunidades perdidas.
Responde en español. Solo JSON, sin texto extra."""

SYSTEM_COMPARE = """Eres un consultor de ventas senior para Innova. Recibes análisis de ventas ganadas vs perdidas.
Tu trabajo es identificar las diferencias críticas entre ambos grupos y dar recomendaciones específicas y accionables.
Responde en español."""


def analyze_batch_won(conversations, client, batch_num):
    combined = ("\n\n" + "-"*50 + "\n\n").join(conversations)
    prompt = f"""Analiza estas {len(conversations)} conversaciones de ventas EXITOSAS:

{combined}

JSON con esta estructura exacta:
{{
  "productos_detectados": ["producto"],
  "funnel_por_producto": {{
    "NombreProducto": {{
      "apertura": "cómo inicia",
      "argumentos_clave": ["arg"],
      "manejo_objeciones": ["objecion: respuesta"],
      "como_se_cierra": "cómo confirma la venta",
      "onboarding": ["paso post-venta"]
    }}
  }},
  "voz_y_tono": {{
    "formalidad": "formal/informal/mixto",
    "emojis": ["emoji: cuándo"],
    "frases_cs": ["frase textual exacta"],
    "estilo": "descripción"
  }},
  "objeciones": [{{"cliente": "texto", "cs": "respuesta"}}],
  "patrones_exito": ["patrón"],
  "areas_mejora_cs": ["algo que CS hizo mal o pudo haber hecho mejor en estas conversaciones exitosas"]
}}"""
    return _call_claude(client, SYSTEM_WON, prompt, batch_num, "WON")


def analyze_batch_lost(conversations, client, batch_num):
    combined = ("\n\n" + "-"*50 + "\n\n").join(conversations)
    prompt = f"""Analiza estas {len(conversations)} conversaciones donde el cliente NO compró:

{combined}

JSON con esta estructura exacta:
{{
  "productos_de_interes": ["producto que el cliente quería"],
  "razones_perdida": [
    {{"razon": "descripción clara", "frecuencia": "alta/media/baja", "ejemplo": "frase del chat"}}
  ],
  "errores_cs": [
    {{"error": "qué hizo mal CS", "momento": "en qué fase ocurrió", "ejemplo": "texto del chat"}}
  ],
  "objeciones_no_resueltas": [
    {{"objecion": "texto cliente", "respuesta_cs": "lo que CS dijo", "mejor_respuesta": "cómo debería haberse manejado"}}
  ],
  "oportunidades_perdidas": ["acción concreta que CS pudo hacer y no hizo"],
  "patron_abandono": "en qué momento del funnel se pierden más clientes"
}}"""
    return _call_claude(client, SYSTEM_LOST, prompt, batch_num, "LOST")


def _call_claude(client, system, prompt, batch_num, tag):
    try:
        log(f"  → Claude [{tag}] batch {batch_num} (~{len(prompt)//4} tokens)...")
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        )
        raw  = msg.content[0].text.strip()
        stop = msg.stop_reason
        log(f"  ← [{tag}] batch {batch_num} | stop={stop} | {len(raw)} chars")

        if stop == "max_tokens":
            log_warn(f"[{tag}] batch {batch_num} truncated — skipping")
            return {}

        if "```" in raw:
            raw = re.sub(r'```(?:json)?', '', raw).strip()

        result = json.loads(raw)
        log_ok(f"  [{tag}] batch {batch_num} parsed OK")
        return result

    except json.JSONDecodeError as e:
        log_err(f"[{tag}] batch {batch_num} JSON error: {e} | raw[:300]: {raw[:300]}")
        return {}
    except Exception as e:
        log_err(f"[{tag}] batch {batch_num} error: {e}")
        return {}


def run_batches(conversations, analyze_fn, client, tag):
    batches = [conversations[i:i+BATCH_SIZE] for i in range(0, len(conversations), BATCH_SIZE)]
    log(f"\nAnalyzing {len(conversations)} [{tag}] chats — {len(batches)} batches...")
    results = []
    failed  = 0
    for i, batch in enumerate(batches):
        r = analyze_fn(batch, client, i + 1)
        results.append(r)
        if not r:
            failed += 1
        time.sleep(0.3)
    log_ok(f"[{tag}] done: {len(batches)-failed}/{len(batches)} batches OK")
    return results


def merge_won(results):
    all_products, all_funnels = set(), {}
    all_emojis, all_phrases   = [], []
    all_objections, all_patterns, all_improvements = [], [], []
    formalidad_votes = []

    for r in results:
        if not r:
            continue
        for p in r.get("productos_detectados", []):
            all_products.add(p)
        for prod, f in r.get("funnel_por_producto", {}).items():
            if prod not in all_funnels:
                all_funnels[prod] = {"apertura": f.get("apertura",""),
                                     "argumentos_clave": [], "manejo_objeciones": [],
                                     "como_se_cierra": f.get("como_se_cierra",""), "onboarding": []}
            all_funnels[prod]["argumentos_clave"]  += f.get("argumentos_clave", [])
            all_funnels[prod]["manejo_objeciones"] += f.get("manejo_objeciones", [])
            all_funnels[prod]["onboarding"]        += f.get("onboarding", [])
        vt = r.get("voz_y_tono", {})
        all_emojis  += vt.get("emojis", [])
        all_phrases += vt.get("frases_cs", [])
        formalidad_votes.append(vt.get("formalidad", ""))
        all_objections  += r.get("objeciones", [])
        all_patterns    += r.get("patrones_exito", [])
        all_improvements += r.get("areas_mejora_cs", [])

    for prod in all_funnels:
        f = all_funnels[prod]
        f["argumentos_clave"]  = list(dict.fromkeys(f["argumentos_clave"]))[:12]
        f["manejo_objeciones"] = list(dict.fromkeys(f["manejo_objeciones"]))[:10]
        f["onboarding"]        = list(dict.fromkeys(f["onboarding"]))[:10]

    formalidad = max(set(formalidad_votes), key=formalidad_votes.count) if formalidad_votes else "mixto"
    return {
        "productos_detectados": sorted(all_products),
        "funnel_por_producto":  all_funnels,
        "voz_y_tono": {"formalidad": formalidad,
                       "emojis": list(dict.fromkeys(all_emojis))[:20],
                       "frases_cs": list(dict.fromkeys(all_phrases))[:35]},
        "objeciones":     all_objections[:30],
        "patrones_exito": list(dict.fromkeys(all_patterns))[:15],
        "areas_mejora_cs": list(dict.fromkeys(all_improvements))[:20],
    }


def merge_lost(results):
    all_products, all_reasons, all_errors = set(), [], []
    all_unresolved, all_opportunities = [], []
    abandon_patterns = []

    for r in results:
        if not r:
            continue
        for p in r.get("productos_de_interes", []):
            all_products.add(p)
        all_reasons      += r.get("razones_perdida", [])
        all_errors       += r.get("errores_cs", [])
        all_unresolved   += r.get("objeciones_no_resueltas", [])
        all_opportunities += r.get("oportunidades_perdidas", [])
        if r.get("patron_abandono"):
            abandon_patterns.append(r["patron_abandono"])

    return {
        "productos_de_interes":    sorted(all_products),
        "razones_perdida":         all_reasons[:20],
        "errores_cs":              all_errors[:20],
        "objeciones_no_resueltas": all_unresolved[:20],
        "oportunidades_perdidas":  list(dict.fromkeys(all_opportunities))[:15],
        "patron_abandono":         abandon_patterns,
    }


def generate_comparative_report(won, lost, stats, client):
    has_lost = bool(lost.get("razones_perdida"))
    log("Generating final report...")

    comparison_section = ""
    if has_lost:
        comparison_section = f"""
## Análisis de Deals PERDIDOS:
{json.dumps(lost, ensure_ascii=False, indent=2)}
"""

    prompt = f"""Basado en el análisis de {stats['won_chats']} conversaciones GANADAS y {stats.get('lost_chats', 0)} PERDIDAS de Innova:

## Análisis de Deals GANADOS:
{json.dumps(won, ensure_ascii=False, indent=2)}
{comparison_section}

Escribe un informe ejecutivo en markdown con estas secciones:

## 1. Resumen Ejecutivo
Bullets con hallazgos más importantes, incluyendo métricas clave.

## 2. Productos y Servicios — Catálogo Normalizado
Consolida los ~70 nombres detectados en un catálogo limpio de productos reales.

## 3. Playbook de Ventas por Producto
Para cada producto: apertura → pitch → objeciones → cierre → post-venta. Frases TEXTUALES reales.

## 4. Voz y Tono del Agente CS
Estilo, emojis, frases características, frases que nunca debe decir.

## 5. Flujo de Onboarding Post-Venta
Paso a paso por tipo de producto.

## 6. Tabla de Objeciones y Respuestas
Tabla: objeción → respuesta CS → principio detrás.

## 7. Áreas de Mejora — CS Actual
{'Analiza qué diferencia las conversaciones ganadas de las perdidas. Identifica errores concretos, momentos de abandono, objeciones no resueltas.' if has_lost else 'Basado en las conversaciones ganadas, identifica qué pudo haberse hecho mejor incluso en ventas cerradas.'}
Incluye ejemplos reales de cada error.

## 8. Guía para el Agente IA
Qué comportamientos replicar exactamente, frases clave obligatorias, qué errores evitar, cómo manejar cada etapa del funnel.

Sé específico. Cita frases textuales. Escribe en español."""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )
    log_ok("Report generated")
    return msg.content[0].text


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log("=" * 60)
    log("Innova CS Analysis v2 — Won + Lost + Areas de Mejora")
    log(f"MAX_WON={MAX_WON} | MAX_LOST={MAX_LOST} | BATCH={BATCH_SIZE} | MSGS={MESSAGES_PER_CHAT}")
    log("=" * 60)

    if not ANTHROPIC_API_KEY:
        log_err("ANTHROPIC_API_KEY not set — exiting")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # 1. Won deals
    if SKIP_WON:
        log("SKIP_WON=1 — loading previous WON analysis from innova_cs_analysis.json")
        with open(f"{OUTPUT_DIR}/innova_cs_analysis.json", encoding="utf-8") as f:
            prev = json.load(f)
        won_merged = prev.get("won", {})
        won_convs  = []
        log_ok(f"Loaded previous WON analysis ({len(won_merged.get('productos_detectados',[]))} products)")
    else:
        won_ids   = extract_chat_ids(WON_CSV)
        log(f"Won CSV: {len(won_ids)} chat IDs")
        won_convs = fetch_conversations(won_ids, MAX_WON, "WON")

    # 2. Lost deals — load already-fetched + fetch only new ones
    lost_convs = []
    already_fetched_ids = set()

    raw_path = f"{OUTPUT_DIR}/innova_cs_data.json"
    if os.path.exists(raw_path):
        with open(raw_path, encoding="utf-8") as f:
            prev_raw = json.load(f)
        prev_lost = prev_raw.get("lost_conversations", [])
        if prev_lost:
            lost_convs = prev_lost
            for c in prev_lost:
                m = re.search(r'Chat (\d+)', c)
                if m: already_fetched_ids.add(int(m.group(1)))
            log_ok(f"Loaded {len(lost_convs)} previously fetched LOST chats (IDs: {len(already_fetched_ids)})")

    if LOST_CSV and os.path.exists(LOST_CSV):
        all_lost_ids = extract_chat_ids(LOST_CSV)
        new_ids = [i for i in all_lost_ids if i not in already_fetched_ids]
        still_needed = MAX_LOST - len(lost_convs)
        log(f"Lost CSV: {len(all_lost_ids)} total | {len(already_fetched_ids)} already done | {len(new_ids)} new available | need {still_needed} more")

        if still_needed > 0 and new_ids:
            step = max(1, len(new_ids) // still_needed)
            new_sample = new_ids[::step][:still_needed]
            log(f"Fetching {len(new_sample)} new LOST chats...")
            new_convs = fetch_conversations(new_sample, len(new_sample), "LOST-NEW")
            lost_convs += new_convs
            log_ok(f"Total LOST chats: {len(lost_convs)}")
        else:
            log(f"Already have enough LOST chats ({len(lost_convs)}), skipping fetch")
    else:
        log_warn("No LOST_CSV provided — using previously fetched data only")

    # 3. Save raw data
    total_messages = len(won_convs) * MESSAGES_PER_CHAT  # approximate
    raw_path = f"{OUTPUT_DIR}/innova_cs_data.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump({"generated_at": datetime.now().isoformat(),
                   "won_conversations":  won_convs,
                   "lost_conversations": lost_convs}, f, ensure_ascii=False, indent=2)
    log_ok(f"Raw data saved → innova_cs_data.json")

    # 4. Analyze won deals
    if not SKIP_WON:
        won_results = run_batches(won_convs, analyze_batch_won, client, "WON")
        won_merged  = merge_won(won_results)

    # 5. Analyze lost deals
    lost_merged = {}
    if lost_convs:
        lost_results = run_batches(lost_convs, analyze_batch_lost, client, "LOST")
        lost_merged  = merge_lost(lost_results)

    # 6. Save analysis JSON
    stats = {"won_chats": len(won_convs), "lost_chats": len(lost_convs)}
    analysis_path = f"{OUTPUT_DIR}/innova_cs_analysis.json"
    with open(analysis_path, "w", encoding="utf-8") as f:
        json.dump({"generated_at": datetime.now().isoformat(), "stats": stats,
                   "won": won_merged, "lost": lost_merged}, f, ensure_ascii=False, indent=2)
    log_ok(f"Analysis saved → innova_cs_analysis.json")
    log(f"Products (won): {won_merged.get('productos_detectados', [])[:10]}")
    if lost_merged:
        log(f"Top loss reasons: {[r['razon'] for r in lost_merged.get('razones_perdida', [])[:3]]}")

    # 7. Generate report
    report = generate_comparative_report(won_merged, lost_merged, stats, client)
    report_path = f"{OUTPUT_DIR}/innova_cs_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Innova CS Analysis v2 — Won vs Lost\n")
        f.write(f"*Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}*  \n")
        f.write(f"*{len(won_convs)} conversaciones ganadas / {len(lost_convs)} perdidas*\n\n")
        f.write(report)
    log_ok(f"Report saved → innova_cs_report.md")
    log("\n✓ DONE")
    log_file.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_warn("Interrupted by user")
        log_file.close()
    except Exception as e:
        log_err(f"Fatal: {e}")
        traceback.print_exc()
        log_file.close()
        sys.exit(1)
