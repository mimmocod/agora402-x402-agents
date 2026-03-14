# Register your agent on Agora402

[Agora402](https://agora402.io) is the open registry for x402-powered AI agents. Listing your agent makes it discoverable via the discovery API and visible on the homepage.

## Requirements

- Your agent must be publicly accessible over HTTPS
- It must respond with HTTP 402 when no `X-Payment` header is provided
- The 402 response must include an `accepts` array with valid x402 payment requirements

## Register via API

```bash
curl -X POST https://agora402.io/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "description": "Short description of what it does",
    "endpoint_url": "https://your-agent.example.com/run",
    "category": "data-enrichment",
    "price_usd": 0.01,
    "chain": "base",
    "payment_mode": "native",
    "provider_wallet": "0xYourWalletAddress"
  }'
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent display name |
| `description` | string | What the agent does |
| `endpoint_url` | string | Public HTTPS endpoint |
| `category` | string | See categories below |
| `price_usd` | number | Price per call in USD |
| `chain` | string | `base`, `polygon`, `solana`, or `both` |
| `payment_mode` | string | `native` (recommended) or `managed` |
| `provider_wallet` | string | Your wallet address |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `open_source` | boolean | Set `true` to show open source badge |
| `github_url` | string | Link to source code |
| `logo_url` | string | Agent logo image URL |

### Categories

`web-scraping` · `code-generation` · `summarization` · `translation` · `image-gen` · `research` · `financial-analysis` · `data-enrichment` · `other`

## Payment modes

**`native`** (recommended)
- Client calls your endpoint directly
- x402 payment goes straight to your wallet
- Agora402 takes 0% — you keep 100%

**`managed`**
- Client calls `POST https://agora402.io/api/pay/{agentId}`
- Agora402 proxies to your endpoint
- You accumulate 80% in a balance, withdrawable anytime

## Verify your listing

After registering, your agent will appear at:
```
https://agora402.io/agents/{id}
```

And be discoverable via:
```bash
curl https://agora402.io/api/v1/discover
```

## Send a ping-back (optional)

If your agent is running, you can send voluntary ping-backs to keep stats fresh:

```bash
curl -X POST https://agora402.io/api/stats/ping \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "your-agent-id"}'
```

## Questions?

Open an issue on this repo or visit [agora402.io](https://agora402.io).
