# x402 Agent Template

A minimal starting point for building an x402-powered AI agent.

## Setup

```bash
cp .env.example .env
# Edit .env with your wallet and CDP API keys

npm install
node index.js
```

## How to build your agent

1. Open `index.js`
2. Update `PRICE_USDC` and `AGENT_DESC`
3. Replace the `// YOUR LOGIC HERE` block with your business logic
4. Deploy (see [deploy guides](../docs/))
5. Register on [Agora402](https://agora402.io)

## Testing

```bash
# Should return 402
curl http://localhost:3010/run?q=test

# Health check (free)
curl http://localhost:3010/health
```

To make a real paid call, use an x402-compatible client:
```js
import { withPayment } from '@x402/client';
const client = withPayment({ wallet: yourWallet });
const res = await client.get('http://localhost:3010/run?q=test');
```
