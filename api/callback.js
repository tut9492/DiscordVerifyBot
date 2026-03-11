// GET /api/callback — Discord OAuth2 callback, exchanges code for token, redirects to frontend
export default async function handler(req, res) {
  const baseUrl = process.env.VERIFICATION_URL || `https://${req.headers.host}`;
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

    const params = new URLSearchParams({
      access_token: tokenData.access_token,
      discord_user_id: user.id,
      discord_username: user.username,
      discord_avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : '',
    });

    res.redirect(302, `${baseUrl}/?${params.toString()}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(302, `${baseUrl}/?error=internal`);
  }
}
