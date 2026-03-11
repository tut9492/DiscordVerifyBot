// GET /api/verify — Redirects to Discord OAuth2 authorization

function validateHost(host) {
  if (!host || host.length > 253) return false;
  return /^[a-zA-Z0-9._:-]+$/.test(host);
}

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;

  const baseUrl = process.env.VERIFICATION_URL || (() => {
    const host = req.headers.host;
    if (!validateHost(host)) {
      console.error('verify: invalid Host header, VERIFICATION_URL not set');
      return null;
    }
    if (!process.env.VERIFICATION_URL) {
      console.warn('VERIFICATION_URL not set — falling back to Host header. Set this env var in production.');
    }
    return `https://${host}`;
  })();

  if (!baseUrl) {
    return res.status(500).json({ error: 'Internal server error.' });
  }

  const redirectUri = `${baseUrl}/api/callback`;
  const scope = 'identify';

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

  res.redirect(302, url);
}
