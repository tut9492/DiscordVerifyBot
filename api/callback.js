// GET /api/callback — Discord OAuth2 callback
// Exchanges code for token, stores in memory with one-time opaque code, redirects frontend
import { randomBytes } from 'crypto';

// Share the in-memory token store with token-exchange endpoint
const tokenStore = globalThis.__tokenStore || (globalThis.__tokenStore = new Map());

function validateHost(host) {
  if (!host || host.length > 253) return false;
  return /^[a-zA-Z0-9._:-]+$/.test(host);
}

export default async function handler(req, res) {
  const baseUrl = process.env.VERIFICATION_URL || (() => {
    const host = req.headers.host;
    if (!validateHost(host)) {
      console.error('token-exchange: invalid Host header, VERIFICATION_URL not set');
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

  const { code } = req.query;

  if (!code) {
    return res.redirect(302, `${baseUrl}/?error=no_code`);
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl}/api/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect(302, `${baseUrl}/?error=token_exchange`);
    }

    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect(302, `${baseUrl}/?error=user_fetch`);
    }

    const user = await userRes.json();

    // Generate a random one-time code and store token data server-side
    const opaqueCode = randomBytes(32).toString('hex');
    tokenStore.set(opaqueCode, {
      created: Date.now(),
      data: {
        access_token: tokenData.access_token,
        discord_user_id: user.id,
        discord_username: user.username,
        discord_avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : '',
      },
    });

    // Redirect with only the opaque code — no token in URL
    res.redirect(302, `${baseUrl}/?code=${opaqueCode}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(302, `${baseUrl}/?error=internal`);
  }
}
