# Domain Intel Agent

> Full domain/email intelligence for $0.01 USDC — powered by x402

## What it does

Given a domain (`stripe.com`) or email (`user@stripe.com`), returns:

- **WHOIS** — registrar, registration date, expiry, nameservers
- **DNS** — A, MX, NS records, SPF, DMARC
- **SSL** — issuer, expiry, days remaining, SANs
- **Hosting** — IP, ASN, city, cloud provider detection
- **Breaches** — HaveIBeenPwned domain breach check
- **Risk score** — 0–100 composite score

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
node index.js
```

## Endpoints

### `GET /domain/health`
Free health check — no payment required.

```bash
curl http://localhost:3009/domain/health
# {"status":"ok","agent":"domain-intel","version":"1.0.0"}
```

### `GET /domain/lookup?q=<domain|email>`
Requires `X-Payment` header with valid x402 payment.

```bash
# Without payment → 402
curl http://localhost:3009/domain/lookup?q=stripe.com

# With payment (using @x402/client)
```

```js
import { withPayment } from '@x402/client';
const client = withPayment({ wallet: yourWallet });
const res = await client.get('https://your-agent.example.com/domain/lookup?q=stripe.com');
console.log(res.data);
```

## Example response

```json
{
  "success": true,
  "query": "stripe.com",
  "domain": "stripe.com",
  "analyzed_at": "2026-03-14T08:00:00.000Z",
  "risk_score": 5,
  "risk_level": "low",
  "whois": {
    "registrar": "MarkMonitor Inc.",
    "registered": "2009-09-23T00:00:00Z",
    "expires": "2026-09-23T00:00:00Z"
  },
  "dns": {
    "a_records": ["54.187.216.72"],
    "mx_records": ["aspmx.l.google.com"],
    "spf": "v=spf1 include:_spf.google.com ~all",
    "dmarc": "v=DMARC1; p=reject"
  },
  "ssl": {
    "issuer": "DigiCert Inc",
    "days_remaining": 180,
    "expired": false
  },
  "hosting": {
    "ip": "54.187.216.72",
    "org": "AS16509 Amazon.com Inc.",
    "country": "US"
  },
  "security": {
    "breaches": { "breached": false, "count": 0 }
  }
}
```

## Register on Agora402

After deploying, list this agent:
→ [docs/register-on-agora402.md](../../docs/register-on-agora402.md)

## License

MIT
