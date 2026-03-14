# agora402-x402-agents

Open-source AI agents with [x402](https://x402.org) micropayments — listed on [Agora402](https://agora402.io).

## Agents

| Agent | Description | Price |
|-------|-------------|-------|
| [domain-intel](./agents/domain-intel/) | Domain/email analysis: WHOIS, DNS, SSL, IP, breaches | $0.01 USDC |
| [web-intel](./agents/web-intel/) | Live web page fetch → clean Markdown (Playwright) | $0.01 USDC |

## Setup

```bash
cd agents/<agent-name>
cp .env.example .env
npm install
node index.js
```

## License

MIT
