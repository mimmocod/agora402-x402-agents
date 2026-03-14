'use strict';

const express         = require('express');
const { chromium }    = require('playwright');
const TurndownService = require('turndown');
const fetch           = require('node-fetch');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3008;

// ── Wallets ───────────────────────────────────────────────────────────────────
const TREASURY_WALLET     = process.env.TREASURY_WALLET;
const TREASURY_WALLET_SOL = process.env.TREASURY_WALLET_SOL;

if (!TREASURY_WALLET) {
  console.error('ERROR: TREASURY_WALLET env var not set');
  process.exit(1);
}

// ── Price ─────────────────────────────────────────────────────────────────────
const PRICE_USDC = 10000; // $0.01

const USDC_BASE    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_SOLANA  = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT || 'https://your-agent.example.com/web/fetch';

// ── x402 payment requirements ─────────────────────────────────────────────────
const REQS = {
  base: {
    scheme: 'exact', network: 'eip155:8453',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_BASE, payTo: TREASURY_WALLET,
    description: 'Web Intel Agent — Live page fetch $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    extra: { name: 'USD Coin', version: '2' },
    facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
  },
  polygon: {
    scheme: 'exact', network: 'eip155:137',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_POLYGON, payTo: TREASURY_WALLET,
    description: 'Web Intel Agent — Live page fetch $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://x402.org/facilitator',
  },
  solana: {
    scheme: 'exact', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_SOLANA, payTo: TREASURY_WALLET_SOL,
    description: 'Web Intel Agent — Live page fetch $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://facilitator.payai.network',
  },
};

// ── Payment verify + settle ───────────────────────────────────────────────────
async function settleAndVerify(paymentHeader) {
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
  } catch {
    return { valid: false, error: 'Invalid payment header' };
  }

  const network = decoded.network || decoded.accepted?.network || '';

  if (network.includes('solana')) {
    try {
      const r = await fetch('https://facilitator.payai.network/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x402Version: 1, paymentPayload: paymentHeader, paymentRequirements: REQS.solana }),
      });
      const data = await r.json();
      return { valid: data.isValid === true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  try {
    const { generateJwt } = require('@coinbase/cdp-sdk/auth');
    const makeJwt = (path) => generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: path,
    });

    const jwt = await makeJwt('/platform/v2/x402/verify');
    const r = await fetch('https://api.cdp.coinbase.com/platform/v2/x402/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ x402Version: 2, paymentPayload: decoded, paymentRequirements: REQS.base }),
    });
    const result = await r.json();

    if (result?.isValid) {
      makeJwt('/platform/v2/x402/settle').then(j =>
        fetch('https://api.cdp.coinbase.com/platform/v2/x402/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${j}` },
          body: JSON.stringify({ x402Version: 2, paymentPayload: decoded, paymentRequirements: REQS.base }),
        })
      ).catch(e => console.error('[settle]', e.message));
    }

    return { valid: result?.isValid === true, error: result?.invalidReason };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Browser pool ──────────────────────────────────────────────────────────────
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('[web-intel] browser launched');
  }
  return browserInstance;
}

// ── HTML → Markdown ───────────────────────────────────────────────────────────
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg']);

async function fetchPage(url, options = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout:   options.timeout || 20000,
    });
    if (!response) throw new Error('No response received');

    await page.waitForTimeout(800);

    const title    = await page.title();
    const finalUrl = page.url();
    const html     = await page.content();

    let markdown = td.turndown(html);
    markdown = markdown.replace(/\n{4,}/g, '\n\n\n').trim();

    const maxChars = options.maxChars || 50000;
    if (markdown.length > maxChars) {
      markdown = markdown.slice(0, maxChars) + '\n\n[...truncated]';
    }

    return {
      url:          finalUrl,
      original_url: url,
      title,
      status_code:  response.status(),
      markdown,
      char_count:   markdown.length,
      fetched_at:   new Date().toISOString(),
    };
  } finally {
    await context.close();
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/web/health', (req, res) => {
  res.json({ status: 'ok', agent: 'web-intel', version: '1.0.0', port: PORT });
});

app.get('/web/fetch', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    return res.status(402).json({
      x402Version: 1,
      error: 'Payment Required',
      accepts: Object.values(REQS),
    });
  }

  const { valid, error: payError } = await settleAndVerify(paymentHeader);
  if (!valid) return res.status(402).json({ error: 'Payment invalid', reason: payError });

  const { url, wait_for, max_chars } = req.query;
  if (!url) return res.status(400).json({ error: 'url query parameter required' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs supported' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Block private/internal IPs
  const host = parsedUrl.hostname;
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
    return res.status(400).json({ error: 'Private/internal URLs not allowed' });
  }

  try {
    const result = await fetchPage(url, {
      waitUntil: wait_for === 'networkidle' ? 'networkidle' : 'domcontentloaded',
      maxChars:  max_chars ? Math.min(parseInt(max_chars) || 50000, 100000) : 50000,
      timeout:   25000,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[fetch] error:', e.message);
    res.status(500).json({ error: 'Fetch failed', reason: e.message, url });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[web-intel-agent] port ${PORT} ready`);
  getBrowser().catch(e => console.error('[browser warmup]', e.message));
});
