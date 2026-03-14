# Deploy on Railway

[Railway](https://railway.app) is the easiest way to deploy an x402 agent — no server management, free tier available.

## Steps

### 1. Fork this repo

Fork `agora402-x402-agents` to your GitHub account.

### 2. Create a new Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your fork

### 3. Configure the service

Railway will detect Node.js automatically.

Set the **Root Directory** to your agent folder, e.g.:
```
agents/domain-intel
```

Set the **Start Command**:
```
node index.js
```

### 4. Add environment variables

In Railway → your service → **Variables**, add:

```
TREASURY_WALLET=0xYourEVMWalletHere
TREASURY_WALLET_SOL=YourSolanaWalletHere
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
AGENT_ENDPOINT=https://your-service.railway.app/domain/lookup
PORT=3000
```

> Railway injects `PORT` automatically — you can leave it unset and use `process.env.PORT`.

### 5. Deploy

Railway will build and deploy automatically. You'll get a public URL like:
```
https://your-service.railway.app
```

### 6. Test it

```bash
curl https://your-service.railway.app/domain/health
# {"status":"ok","agent":"domain-intel","version":"1.0.0"}

curl https://your-service.railway.app/domain/lookup?q=stripe.com
# {"x402Version":1,"error":"Payment Required","accepts":[...]}
```

### 7. Register on Agora402

→ [register-on-agora402.md](./register-on-agora402.md)
