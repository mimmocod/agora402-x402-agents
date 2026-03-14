'use strict';

const express = require('express');
const dns     = require('dns').promises;
const tls     = require('tls');
const net     = require('net');
const fetch   = require('node-fetch');
const app     = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;

// ── Wallets ───────────────────────────────────────────────────────────────────
const TREASURY_WALLET     = process.env.TREASURY_WALLET;
const TREASURY_WALLET_SOL = process.env.TREASURY_WALLET_SOL;

if (!TREASURY_WALLET) {
  console.error('ERROR: TREASURY_WALLET env var not set');
  process.exit(1);
}

// ── Price ─────────────────────────────────────────────────────────────────────
const PRICE_USDC = 10000; // $0.01 (USDC has 6 decimals)

// ── USDC contract addresses ───────────────────────────────────────────────────
const USDC_BASE    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_SOLANA  = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT || 'https://your-agent.example.com/domain/lookup';

// ── x402 payment requirements ─────────────────────────────────────────────────
const REQS = {
  base: {
    scheme: 'exact', network: 'eip155:8453',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_BASE, payTo: TREASURY_WALLET,
    description: 'Domain Intel Agent — Full domain/email analysis $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    extra: { name: 'USD Coin', version: '2' },
    facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
  },
  polygon: {
    scheme: 'exact', network: 'eip155:137',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_POLYGON, payTo: TREASURY_WALLET,
    description: 'Domain Intel Agent — Full domain/email analysis $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://x402.org/facilitator',
  },
  solana: {
    scheme: 'exact', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    amount: String(PRICE_USDC), maxAmountRequired: String(PRICE_USDC),
    asset: USDC_SOLANA, payTo: TREASURY_WALLET_SOL,
    description: 'Domain Intel Agent — Full domain/email analysis $0.01 USDC',
    mimeType: 'application/json', maxTimeoutSeconds: 300,
    resource: AGENT_ENDPOINT,
    facilitator: 'https://facilitator.payai.network',
  },
};

// ── CDP (Base) helpers ────────────────────────────────────────────────────────
async function cdpVerifySettle(decoded) {
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
    makeJwt('/platform/v2/x402/settle').then(jwtSettle =>
      fetch('https://api.cdp.coinbase.com/platform/v2/x402/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtSettle}` },
        body: JSON.stringify({ x402Version: 2, paymentPayload: decoded, paymentRequirements: REQS.base }),
      })
    ).catch(e => console.error('[settle]', e.message));
  }

  return { valid: result?.isValid === true, error: result?.invalidReason };
}

// ── Payment verify ────────────────────────────────────────────────────────────
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
    return await cdpVerifySettle(decoded);
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Intel helpers ─────────────────────────────────────────────────────────────

function extractDomain(q) {
  const s = q.trim().toLowerCase();
  if (s.includes('@')) return { email: s, domain: s.split('@')[1] };
  return { domain: s.replace(/^https?:\/\//, '').replace(/\/.*$/, '') };
}

async function getWhois(domain) {
  try {
    const r = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const events = d.events || [];
    const getEvent = (t) => events.find(e => e.eventAction === t)?.eventDate || null;
    const entities = d.entities || [];
    const registrar = entities.find(e => e.roles?.includes('registrar'))
      ?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || null;
    return {
      registrar,
      registered: getEvent('registration'),
      updated:    getEvent('last changed'),
      expires:    getEvent('expiration'),
      status:     d.status || [],
      nameservers: (d.nameservers || []).map(n => n.ldhName?.toLowerCase()).filter(Boolean),
    };
  } catch { return null; }
}

async function getDns(domain) {
  const safe = async (fn) => { try { return await fn(); } catch { return []; } };
  const [a, aaaa, mx, txt, ns] = await Promise.all([
    safe(() => dns.resolve4(domain)),
    safe(() => dns.resolve6(domain)),
    safe(() => dns.resolveMx(domain).then(r => r.sort((a, b) => a.priority - b.priority).map(m => m.exchange))),
    safe(() => dns.resolveTxt(domain).then(r => r.map(t => t.join('')))),
    safe(() => dns.resolveNs(domain)),
  ]);
  const spf = txt.find(t => t.startsWith('v=spf1')) || null;
  const dmarc_txt = await safe(() => dns.resolveTxt(`_dmarc.${domain}`).then(r => r.map(t => t.join(''))));
  const dmarc = dmarc_txt.find(t => t.startsWith('v=DMARC1')) || null;
  return { a, aaaa, mx, ns, spf, dmarc, txt_count: txt.length };
}

function detectEmailProvider(mx) {
  if (!mx?.length) return 'unknown';
  const m = mx[0].toLowerCase();
  if (m.includes('google') || m.includes('gmail'))      return 'Google Workspace';
  if (m.includes('outlook') || m.includes('microsoft')) return 'Microsoft 365';
  if (m.includes('mimecast'))   return 'Mimecast';
  if (m.includes('proofpoint')) return 'Proofpoint';
  if (m.includes('mailgun'))    return 'Mailgun';
  if (m.includes('sendgrid'))   return 'SendGrid';
  if (m.includes('amazonses') || m.includes('amazonaws')) return 'Amazon SES';
  if (m.includes('fastmail'))   return 'Fastmail';
  if (m.includes('zoho'))       return 'Zoho Mail';
  return mx[0];
}

async function getSsl(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { servername: domain, rejectUnauthorized: false, timeout: 6000 }, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        socket.destroy();
        if (!cert?.subject) return resolve(null);
        resolve({
          issuer:         cert.issuer?.O || cert.issuer?.CN || null,
          subject:        cert.subject?.CN || null,
          valid_from:     cert.valid_from,
          valid_to:       cert.valid_to,
          days_remaining: Math.floor((new Date(cert.valid_to) - Date.now()) / 86400000),
          san:            cert.subjectaltname?.split(', ').map(s => s.replace('DNS:', '')) || [],
          expired:        new Date(cert.valid_to) < new Date(),
        });
      } catch { socket.destroy(); resolve(null); }
    });
    socket.on('error', () => resolve(null));
    socket.setTimeout(6000, () => { socket.destroy(); resolve(null); });
  });
}

async function getIpInfo(domain) {
  try {
    const ips = await dns.resolve4(domain).catch(() => []);
    if (!ips.length) return null;
    const ip = ips[0];
    const r = await fetch(`https://ipinfo.io/${ip}/json`);
    const d = await r.json();
    return {
      ip,
      city:    d.city || null,
      region:  d.region || null,
      country: d.country || null,
      org:     d.org || null,
      hosting: ['amazon', 'google', 'cloudflare', 'microsoft', 'digitalocean', 'linode']
        .some(h => d.org?.toLowerCase().includes(h)),
    };
  } catch { return null; }
}

async function getBreaches(domain) {
  try {
    const r = await fetch(`https://haveibeenpwned.com/api/v3/breacheddomain/${domain}`, {
      headers: { 'User-Agent': 'x402-DomainIntelAgent/1.0' },
    });
    if (r.status === 404) return { breached: false, count: 0, breaches: [] };
    if (!r.ok) return null;
    const data = await r.json();
    const names = Object.keys(data);
    return { breached: names.length > 0, count: names.length, breaches: names.slice(0, 5) };
  } catch { return null; }
}

function validateEmailFormat(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const local = email.split('@')[0];
  const roleAccounts = ['admin', 'info', 'support', 'contact', 'help', 'noreply', 'no-reply', 'sales', 'billing'];
  return {
    valid_format: re.test(email),
    role_based:   roleAccounts.includes(local.toLowerCase()),
    local_part:   local,
  };
}

function computeRiskScore({ whois, dns, ssl, breaches }) {
  let score = 0;
  if (!whois) score += 20;
  else {
    if (!whois.registrar) score += 5;
    if (whois.expires && new Date(whois.expires) < new Date(Date.now() + 30 * 86400000)) score += 10;
  }
  if (!dns?.spf)  score += 15;
  if (!dns?.dmarc) score += 15;
  if (!ssl) score += 20;
  else if (ssl.expired) score += 25;
  else if (ssl.days_remaining < 14) score += 10;
  if (breaches?.breached) score += Math.min(breaches.count * 5, 20);
  return Math.min(score, 100);
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/domain/health', (req, res) => {
  res.json({ status: 'ok', agent: 'domain-intel', version: '1.0.0' });
});

app.get('/domain/lookup', async (req, res) => {
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

  const q = req.query.q || req.query.domain || req.query.email;
  if (!q) return res.status(400).json({ error: 'q parameter required. Example: ?q=stripe.com' });

  const { domain, email } = extractDomain(q);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  console.log(`[domain-intel] lookup: ${q}`);

  const [whois, dnsData, ssl, ipInfo, breaches] = await Promise.all([
    getWhois(domain),
    getDns(domain),
    getSsl(domain),
    getIpInfo(domain),
    getBreaches(domain),
  ]);

  const emailProvider = detectEmailProvider(dnsData?.mx);
  const riskScore = computeRiskScore({ whois, dns: dnsData, ssl, breaches });

  res.json({
    success: true,
    query: q,
    domain,
    analyzed_at: new Date().toISOString(),
    risk_score: riskScore,
    risk_level: riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : 'high',
    whois:   whois || { error: 'unavailable' },
    dns: {
      a_records:    dnsData?.a || [],
      aaaa_records: dnsData?.aaaa || [],
      mx_records:   dnsData?.mx || [],
      ns_records:   dnsData?.ns || [],
      spf:          dnsData?.spf || null,
      dmarc:        dnsData?.dmarc || null,
      txt_count:    dnsData?.txt_count || 0,
    },
    email: {
      provider:  emailProvider,
      has_mx:    (dnsData?.mx?.length || 0) > 0,
      has_spf:   !!dnsData?.spf,
      has_dmarc: !!dnsData?.dmarc,
      ...(email ? validateEmailFormat(email) : {}),
    },
    ssl:      ssl || { error: 'unavailable' },
    hosting:  ipInfo || { error: 'unavailable' },
    security: { breaches: breaches || { error: 'unavailable' } },
  });
});

app.listen(PORT, () => {
  console.log(`[domain-intel-agent] port ${PORT} ready`);
});
