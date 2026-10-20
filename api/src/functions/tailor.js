const { app } = require('@azure/functions');
const { INSTRUCTIONS, SCHEMA, prepare, validate, extractText, parseJSON, mock } = require('../lib/tailor');

// Cost guards. Counts are per Function instance and reset on restart, so the
// Azure budget alert and model quota are the real ceiling.
const PER_HOUR = 6;
const PER_DAY = 15;
const GLOBAL_PER_DAY = 300;
const hits = new Map();
let globalCount = { day: '', n: 0 };

function limited(ip) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (globalCount.day !== today) globalCount = { day: today, n: 0 };
  if (globalCount.n >= GLOBAL_PER_DAY) return 'The tailoring service has reached its daily limit. Try again tomorrow.';

  const recent = (hits.get(ip) || []).filter((t) => now - t < 86400000);
  if (recent.filter((t) => now - t < 3600000).length >= PER_HOUR || recent.length >= PER_DAY) {
    return `You can tailor ${PER_HOUR} times an hour and ${PER_DAY} times a day. Try again later.`;
  }
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  globalCount.n += 1;
  return null;
}

let cached = { token: null, exp: 0 };
async function getToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const res = await fetch(`https://login.microsoftonline.com/${process.env.AZ_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AZ_CLIENT_ID,
      client_secret: process.env.AZ_CLIENT_SECRET,
      scope: 'https://ai.azure.com/.default',
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const d = await res.json();
  cached = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return cached.token;
}

async function askModel(input) {
  const token = await getToken();
  const base = process.env.PROJECT_ENDPOINT.replace(/\/$/, '');
  const res = await fetch(`${base}/openai/v1/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: process.env.MODEL_DEPLOYMENT,
      instructions: INSTRUCTIONS,
      input,
      max_output_tokens: 3000,
      text: { format: { type: 'json_schema', name: 'cv_tailoring', schema: SCHEMA, strict: true } },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(`Model error ${res.status}: ${detail.slice(0, 500)}`), { status: res.status });
  }
  return parseJSON(extractText(await res.json()));
}

app.http('tailor', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, context) => {
    let body;
    try {
      body = await req.json();
    } catch {
      return { status: 400, jsonBody: { error: 'The request could not be read. Refresh the page and try again.' } };
    }

    const prepared = prepare(body);
    if (prepared.error) return { status: 400, jsonBody: { error: prepared.error } };

    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const block = process.env.MOCK_AI === '1' ? null : limited(ip);
    if (block) return { status: 429, jsonBody: { error: block } };

    try {
      const raw = process.env.MOCK_AI === '1' ? mock(prepared, String(body.jobAd)) : await askModel(prepared.input);
      return { jsonBody: validate(raw, prepared) };
    } catch (err) {
      context.error(err);
      if (err.status === 429) {
        return { status: 503, jsonBody: { error: 'The AI service is busy. Wait a minute and try again.' } };
      }
      return { status: 502, jsonBody: { error: 'Tailoring failed this time. Try again, and shorten the job advert if it is very long.' } };
    }
  },
});
