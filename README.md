# agora402-x402-agents

> A collection of open-source x402-powered AI agents — deploy, monetize, and list on [Agora402](https://agora402.io)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![x402](https://img.shields.io/badge/protocol-x402-blue)](https://x402.org)
[![Agora402](https://img.shields.io/badge/registry-Agora402-green)](https://agora402.io)

---

## What is this?

This repo contains production-ready AI agents that accept **USDC micropayments** via the [x402 protocol](https://x402.org). Each agent:

- Exposes an HTTP API that returns **HTTP 402** if no payment is provided
- Accepts payment on **Base**, **Polygon**, and **Solana**
- Is registered and discoverable on [Agora402](https://agora402.io) — the open registry for x402 agents

## Agents

| Agent | Description | Price | Chains |
|-------|-------------|-------|--------|
| [domain-intel](./agents/domain-intel/) | Full domain/email analysis: WHOIS, DNS, SSL, IP, breaches | $0.01 | Base, Polygon, Solana |
| [web-intel](./agents/web-intel/) | Live web page fetch → clean Markdown (Playwright) | $0.01 | Base, Polygon, Solana |

## Quick Start

### 1. Clone & pick an agent

```bash
git clone https://github.com/mimmocod/agora402-x402-agents.git
cd agora402-x402-agents/agents/domain-intel
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your wallet address and CDP API keys
```

### 3. Install & run

```bash
npm install
node index.js
```

### 4. Test it

```bash
# Without payment → 402
curl http://localhost:3009/domain/lookup?q=stripe.com

# With payment → data
# Use any x402-compatible client (e.g. @x402/client)
```

### 5. Register on Agora402

Once deployed, list your agent on the registry:
→ [docs/register-on-agora402.md](./docs/register-on-agora402.md)

---

## Build Your Own

Use the [template](./template/) as a starting point:

```bash
cp -r template my-agent
cd my-agent
# Edit index.js — add your logic between the payment check and the response
```

The template has the full x402 payment flow wired up. You only need to fill in your business logic.

---

## How x402 Works

```
Client                    Agent
  │                         │
  ├── GET /endpoint ────────►│
  │                         │ (no X-Payment header)
  │◄── 402 + payment reqs ──┤
  │                         │
  │  [client pays on-chain] │
  │                         │
  ├── GET /endpoint ────────►│
  │   X-Payment: <proof>    │
  │                         │ (verify + settle)
  │◄── 200 + data ──────────┤
```

The agent verifies the payment on-chain, settles it, and returns the result. No subscriptions, no API keys — just pay per call.

---

## Contributing

Want to add your agent? See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Registry

All agents in this repo are listed on **[Agora402](https://agora402.io)** — an open registry for x402-powered AI agents.

- **Discovery API**: `GET https://agora402.io/api/v1/discover`
- **Register**: `POST https://agora402.io/api/agents`

---

## License

MIT — see [LICENSE](./LICENSE)
