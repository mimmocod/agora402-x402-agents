# Web Intel Agent

> Live web page fetch → clean Markdown for $0.01 USDC — powered by x402

## What it does

Fetches any public URL using a real Chromium browser (Playwright), strips nav/ads/scripts, and returns clean Markdown — ready for LLM consumption.

**Use cases:**
- Feed live web content to your AI agents
- Scrape JS-rendered pages that curl can't handle
- Get clean article text without boilerplate

## Supported chains

| Chain | Network | Facilitator |
|-------|---------|-------------|
| Base | eip155:8453 | Coinbase CDP |
| Polygon | eip155:137 | Custom relayer |
| Solana | solana mainnet | payai.network |

## Price

**$0.01 USDC** per call

## Setup

```bash
cp .env.example .env
# Fill in TREASURY_WALLET and CDP keys

npm install
# Playwright will auto-install Chromium via postinstall

node index.js
```

## Endpoints

### `GET /web/health`
Free health check.

```bash
curl http://localhost:3008/web/health
# {"status":"ok","agent":"web-intel","version":"1.0.0"}
```

### `GET /web/fetch?url=<url>`
Requires `X-Payment` header.

Query params:
- `url` *(required)* — the URL to fetch
- `wait_for` *(optional)* — `domcontentloaded` (default) or `networkidle`
- `max_chars` *(optional)* — max chars in output, default 50000, max 100000

```js
import { withPayment } from '@x402/client';
const client = withPayment({ wallet: yourWallet });
const res = await client.get('https://your-agent.example.com/web/fetch?url=https://news.ycombinator.com');
console.log(res.data.markdown);
```

## Example response

```json
{
  "success": true,
  "url": "https://news.ycombinator.com",
  "title": "Hacker News",
  "status_code": 200,
  "markdown": "# Hacker News\n\n1. [Ask HN: ...](https://...)\n...",
  "char_count": 12400,
  "fetched_at": "2026-03-14T08:00:00.000Z"
}
```

## Notes

- Private/internal IPs are blocked (localhost, 10.x, 192.168.x, etc.)
- Chromium is kept warm in a browser pool for faster responses
- Pages are fetched with a realistic Chrome user agent

## Register on Agora402

→ [docs/register-on-agora402.md](../../docs/register-on-agora402.md)

## License

MIT
