const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Load local .env without adding a runtime dependency; never print its contents.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const PORT = Number(process.env.PORT || 3000);
const KEY = process.env.GOLDAPI_KEY || '';
const ROOT = __dirname;
const allowedMetals = new Set(['XAU', 'XAG', 'XPT', 'XPD']);
const allowedCurrencies = new Set('AED ARS AUD BDT BGN BHD BOB BRL BTC CAD CHF CLP CNY COP CZK DKK DOP DZD EGP EUR FJD GBP GHS GTQ HKD IDR ILS INR IQD IRR ISK JOD JPY KES KHR KRW KWD LAK LBP LKR MAD MMK MXN MYR NGN NOK NPR NZD OMR PEN PHP PKR PLN PYG QAR RON RUB SAR SEK SGD SYP THB TRY TWD UAH USD UYU UZS VND XAG YER ZAR'.split(' '));
const cache = new Map();
const CACHE_MS = 15_000;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

function send(res, status, data, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

async function fetchGoldApi(metal, currency, date='') {
  if (!KEY) throw Object.assign(new Error('در سرور کلید GoldAPI تنظیم نشده است. فایل .env را بسازید.'), { status:503 });
  const suffix = date ? `/${date}` : '';
  const cacheKey = `${metal}/${currency}${suffix}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const response = await fetch(`https://www.goldapi.io/api/price/${metal}/${currency}${suffix}`, {
    headers: { 'x-access-token': KEY, 'Content-Type':'application/json' }, signal: AbortSignal.timeout(12_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body.message || body.error || `GoldAPI پاسخ ${response.status} داد.`);
    err.status = response.status;
    throw err;
  }
  cache.set(cacheKey, { at: Date.now(), value: body });
  return body;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return send(res, 200, { configured: Boolean(KEY) });
  if (url.pathname === '/api/price') {
    const metal = (url.searchParams.get('metal') || 'XAU').toUpperCase();
    const currency = (url.searchParams.get('currency') || 'USD').toUpperCase();
    const date = url.searchParams.get('date') || '';
    if (!allowedMetals.has(metal) || !allowedCurrencies.has(currency)) return send(res, 400, { error:'فلز یا ارز انتخاب‌شده مجاز نیست.' });
    if (date && !/^\d{8}$/.test(date)) return send(res, 400, { error:'تاریخ باید با قالب YYYYMMDD باشد.' });
    try { return send(res, 200, await fetchGoldApi(metal, currency, date)); }
    catch (error) { return send(res, error.status || 502, { error: error.message || 'ارتباط با GoldAPI برقرار نشد.' }); }
  }
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.resolve(ROOT, `.${requested}`);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, { error:'مجاز نیست' });
  fs.readFile(file, (error, contents) => error ? send(res, 404, { error:'صفحه پیدا نشد.' }) : send(res, 200, contents, mime[path.extname(file)] || 'application/octet-stream'));
});

server.listen(PORT, () => console.log(`Gold dashboard: http://localhost:${PORT}`));
