// POST /api/token-exchange — Exchange one-time code for Discord token data
// Tokens are stored in-memory with 60s TTL, deleted after use

const tokenStore = globalThis.__tokenStore || (globalThis.__tokenStore = new Map());

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of tokenStore) {
    if (now - entry.created > 60_000) tokenStore.delete(key);
  }
}

export { tokenStore };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' });
  }

  cleanup();

  const entry = tokenStore.get(code);
  if (!entry) {
    return res.status(404).json({ error: 'Code expired or invalid' });
  }

  // One-time use — delete immediately
  tokenStore.delete(code);

  return res.status(200).json(entry.data);
}
