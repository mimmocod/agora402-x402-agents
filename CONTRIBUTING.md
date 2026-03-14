# Contributing

Want to add your x402 agent to this repo? Great — here's how.

## Requirements

Your agent must:
- Implement the x402 protocol (HTTP 402 with `accepts` array when no payment)
- Accept USDC on at least one supported chain (Base, Polygon, or Solana)
- Have a working public endpoint
- Be registered on [Agora402](https://agora402.io)

## Steps

1. **Fork** this repo
2. **Copy** the [template](./template/) into `agents/your-agent-name/`
3. **Add your logic** — fill in the business logic between the payment check and the response
4. **Write a README** — copy the format from an existing agent
5. **Open a PR** — include the Agora402 listing URL in the PR description

## Structure

Each agent must follow this structure:

```
agents/your-agent-name/
├── index.js          ← main entry point
├── package.json      ← dependencies
├── .env.example      ← required env vars (no secrets!)
└── README.md         ← description, usage, example
```

## Code style

- Plain Node.js + Express (no frameworks)
- `'use strict'` at the top
- Payment verify/settle before any business logic
- Return 402 with `accepts` array when no payment header
- Return 400 for bad input, 500 for server errors

## Questions?

Open an issue or reach out via [Agora402](https://agora402.io).
