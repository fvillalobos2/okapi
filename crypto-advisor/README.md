# crypto-advisor

A small **standalone** job (separate from `okapi-agents`) that sends you a daily
WhatsApp digest about your crypto watchlist: factual market indicators + your
dollar-cost-averaging (DCA) plan for the month, plus your real balances if you
add a read-only Binance key.

**It reports context, not predictions.** It will never tell you a coin "will go
up." It surfaces the conditions a long-term investor cares about (trend vs. the
200-day average, RSI, distance from the 1-year high) and reminds you to keep
buying on schedule. You place every order yourself.

## Setup

```bash
cd crypto-advisor
npm install
cp .env.example .env        # then fill it in
```

Fill `.env`:

- **Twilio** — same account/credentials as okapi-agents. `TWILIO_WHATSAPP_FROM`
  and `ALERT_WHATSAPP_TO` must include the `whatsapp:` prefix
  (e.g. `whatsapp:+14155238886`).
- **Binance keys are optional.** Market data (prices/indicators) needs no key.
  Only add `BINANCE_API_KEY` / `BINANCE_API_SECRET` if you want your real
  balances in the message — and only ever a **read-only** key (Enable Reading
  on; trading & withdrawals OFF).

## Run

```bash
npm run dry      # prints the message, sends nothing — use this to preview
npm start        # builds the digest and sends it via WhatsApp
```

## Customize the strategy

Edit `WATCHLIST` and `MONTHLY_BUDGET` in [src/config.ts](src/config.ts):
weights are the % of your monthly budget per asset. The default is a
moderate-aggressive long-term mix (45% BTC / 30% ETH / 20% SOL / 5% lotto).

## Schedule it (daily)

Runs as a one-shot, so any scheduler works.

**Railway / cron** — set the env vars in the project and add a cron service that
runs `npm start` on your schedule, e.g. `0 13 * * *` (daily 07:00 CR / 13:00 UTC).

**Local cron (macOS/Linux):**

```cron
0 13 * * * cd /path/to/crypto-advisor && /usr/local/bin/npm start >> advisor.log 2>&1
```

## Safety notes

- Never give this (or any) automated key trading or withdrawal permission.
- Keys live in `.env` only (gitignored). Never commit them.
- If a key is ever pasted somewhere public, delete it on Binance and recreate.
