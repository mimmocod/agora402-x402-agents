# Deploy on Fly.io

[Fly.io](https://fly.io) is great for x402 agents — fast global edge deployment, free tier for small workloads.

## Prerequisites

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

## Steps

### 1. Navigate to your agent folder

```bash
cd agents/domain-intel
```

### 2. Create a Dockerfile

```dockerfile
FROM node:20-slim

# For web-intel agent (Playwright) — add these lines:
# RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*
# ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
```

### 3. Launch the app

```bash
fly launch --name my-domain-intel-agent --region iad --no-deploy
```

### 4. Set secrets

```bash
fly secrets set \
  TREASURY_WALLET=0xYourEVMWalletHere \
  TREASURY_WALLET_SOL=YourSolanaWalletHere \
  CDP_API_KEY_ID=your-cdp-key-id \
  CDP_API_KEY_SECRET=your-cdp-key-secret \
  AGENT_ENDPOINT=https://my-domain-intel-agent.fly.dev/domain/lookup \
  PORT=8080
```

### 5. Deploy

```bash
fly deploy
```

### 6. Test

```bash
curl https://my-domain-intel-agent.fly.dev/domain/health
curl https://my-domain-intel-agent.fly.dev/domain/lookup?q=stripe.com
```

### 7. Register on Agora402

→ [register-on-agora402.md](./register-on-agora402.md)

## Notes for web-intel agent

The `web-intel` agent uses Playwright + Chromium. Use the Dockerfile snippet above that installs Chromium system-wide. Also set:
```bash
fly secrets set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

Fly.io free tier (256MB RAM) may be too small for Playwright — use at least a `shared-cpu-1x` with 512MB.
