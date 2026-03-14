'use strict';

/**
 * x402 Agent Template
 * -------------------
 * A minimal Express server that accepts USDC micropayments via x402
 * on Base, Polygon, and Solana before serving your API response.
 *
 * To build your agent:
 * 1. Set your env vars (copy .env.example → .env)
 * 2. Update PRICE_USDC and the description strings
 * 3. Replace the "YOUR LOGIC HERE" section with your business logic
 * 4. Deploy and register on https://agora402.io
 */

const express = require('express');
const fetch   = require('node-fetch');
const app     = express();
app.use(express.json());

const PORT = process.env.PORT || 3010;

// ── Wallets (set via env) ─────────────────────────────────────────────────────
const TREASURY_WALLET     = process.env.TREASURY_WALLET;     // EVM (Base/Polygon)
const TREASURY_WALLET_SOL = process.env.TREASURY_WALLET_SOL; // Solana

// ── Price ─────────────────────────────────────────────────────────────────────
// USDC has 6 decimals. Examples:
//   $0.001 = 1000
//   $0.01  = 10000
//   $0.10  = 100000
//   $1.00  = 1000000
const PRICE_USDC = 10000; // $0.01

// ── USDC contract addresses ───────────────────────────────────────────────────
const USDC_BASE    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_SOLANA  = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ── Your agent's public endpoint URL ─────────────────────────────────────────
const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT || 'https://your-agent.example.com/run';
const AGENT_DESC     = 'My x402 Agent — does something useful for $0.01 USDC';

// ── x402 payment requirements ─────────────────────────────────────────────────
const REQS = {
  base: {
    scheme: 'exact', network: 'eip155:8453',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_BASE, payTo: TREASURY_WALLET,
    description: AGENT_DESC,
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    extra: { name: 'USD Coin', version: '2' },
    facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
  },
  polygon: {
    scheme: 'exact', network: 'eip155:137',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_POLYGON, payTo: TREASURY_WALLET,
    description: AGENT_DESC,
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://x402.org/facilitator', // or your own
  },
  solana: {
    scheme: 'exact', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_SOLANA, payTo: TREASURY_WALLET_SOL,
    description: AGENT_DESC,
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://facilitator.payai.network',
  },
};

// ── Payment verify + settle (Base via CDP) ────────────────────────────────────
async function settleAndVerify(paymentHeader) {
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
  } catch {
    return { valid: false, error: 'Invalid payment header' };
  }

  const network = decoded.network || decoded.accepted?.network || '';

  // Solana path
  if (network.includes('solana')) {
    try {
      const r = await fetch('https://facilitator.payai.network/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 1,
          paymentPayload: paymentHeader,
          paymentRequirements: REQS.solana,
        }),
      });
      const data = await r.json();
      return { valid: data.isValid === true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  // Base (default) via Coinbase CDP
  try {
    const { generateJwt } = require('@coinbase/cdp-sdk/auth');
    const jwt = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: '/platform/v2/x402/verify',
    });
    const r = await fetch('https://api.cdp.coinbase.com/platform/v2/x402/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ x402Version: 2, paymentPayload: decoded, paymentRequirements: REQS.base }),
    });
    const result = await r.json();
    if (result?.isValid) {
      // Settle async (don't block the response)
      const jwtSettle = await generateJwt({
        apiKeyId: process.env.CDP_API_KEY_ID,
        apiKeySecret: process.env.CDP_API_KEY_SECRET,
        requestMethod: 'POST',
        requestHost: 'api.cdp.coinbase.com',
        requestPath: '/platform/v2/x402/settle',
      });
      fetch('https://api.cdp.coinbase.com/platform/v2/x402/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtSettle}` },
        body: JSON.stringify({ x402Version: 2, paymentPayload: decoded, paymentRequirements: REQS.base }),
      }).catch(e => console.error('[settle]', e.message));
    }
    return { valid: result?.isValid === true, error: result?.invalidReason };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check (free — no payment required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'my-agent', version: '1.0.0' });
});

// Main endpoint (requires payment)
app.get('/run', async (req, res) => {
  // 1. Check for payment header
  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    return res.status(402).json({
      x402Version: 1,
      error: 'Payment Required',
      accepts: Object.values(REQS),
    });
  }

  // 2. Verify + settle payment
  const { valid, error: payError } = await settleAndVerify(paymentHeader);
  if (!valid) {
    return res.status(402).json({ error: 'Payment invalid', reason: payError });
  }

  // 3. Validate input
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'q parameter required' });
  }

  // ── YOUR LOGIC HERE ──────────────────────────────────────────────────────
  // Payment is verified. Do your work here.
  // Example:
  const result = {
    input: q,
    output: `Processed: ${q}`,
    processed_at: new Date().toISOString(),
  };
  // ────────────────────────────────────────────────────────────────────────

  res.json({ success: true, ...result });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[agent] listening on port ${PORT}`);
});
