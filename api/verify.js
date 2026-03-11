// GET /api/verify — Redirects to Discord OAuth2 authorization
export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = process.env.VERIFICATION_URL || `https://${req.headers.host}`;
  const redirectUri = `${baseUrl}/api/callback`;
  const scope = 'identify';

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

  res.redirect(302, url);
}
