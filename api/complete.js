// POST /api/complete — Verify wallet signature, check on-chain holdings, assign Discord roles
import { createPublicClient, http, verifyMessage } from 'viem';
import config from '../config.json' with { type: 'json' };

const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Build a map of chain_id → viem PublicClient
function getClients() {
  const clients = {};
  for (const chain of config.chains) {
    const rpcUrl = process.env[`${chain.name.toUpperCase()}_RPC`] || chain.rpc;
    clients[chain.id] = createPublicClient({
      chain: {
        id: chain.id,
        name: chain.name,
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
      transport: http(rpcUrl),
    });
  }
  return clients;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { wallet, signature, discord_user_id, discord_access_token, timestamp } = req.body;

    if (!wallet || !signature || !discord_user_id || !discord_access_token || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify timestamp is within 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return res.status(400).json({ error: 'Signature expired. Please try again.' });
    }

    // Verify the Discord access token actually belongs to this user
    const discordUserRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${discord_access_token}` },
    });

    if (!discordUserRes.ok) {
      return res.status(401).json({ error: 'Invalid Discord token. Please re-authorize.' });
    }

    const discordUser = await discordUserRes.json();
    if (discordUser.id !== discord_user_id) {
      return res.status(403).json({ error: 'Discord token does not match user ID.' });
    }

    // Verify wallet signature
    const message = `Verify NFT holdings for Discord: ${discord_user_id}\nTimestamp: ${timestamp}`;
    const valid = await verifyMessage({ address: wallet, message, signature });

    if (!valid) {
      return res.status(400).json({ error: 'Invalid signature. Wallet address does not match.' });
    }

    const clients = getClients();
    const guildId = process.env.DISCORD_GUILD_ID || config.guild_id;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: 'Server misconfigured: missing bot token' });
    }

    const rolesAssigned = [];
    const holdings = [];

    for (const collection of config.collections) {
      const chainId = collection.chain_id || config.chains[0]?.id;
      const client = clients[chainId];

      if (!client) {
        console.error(`No client for chain ${chainId} (collection: ${collection.name})`);
        holdings.push({ collection: collection.name, chain_id: chainId, count: 0, error: 'chain not configured' });
        continue;
      }

      let balance;
      try {
        balance = await client.readContract({
          address: collection.contract,
          abi: ERC721_ABI,
          functionName: 'balanceOf',
          args: [wallet],
        });
      } catch (err) {
        console.error(`Failed to read balanceOf for ${collection.name} on chain ${chainId}:`, err.message);
        balance = 0n;
      }

      const count = Number(balance);
      holdings.push({ collection: collection.name, chain_id: chainId, count });

      for (const role of collection.roles) {
        if (count >= role.min) {
          try {
            const roleRes = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${discord_user_id}/roles/${role.role_id}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bot ${botToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (roleRes.ok || roleRes.status === 204) {
              rolesAssigned.push({ collection: collection.name, role: role.name, count });
            } else {
              const errText = await roleRes.text();
              console.error(`Failed to assign role ${role.name}:`, errText);
            }
          } catch (err) {
            console.error(`Error assigning role ${role.name}:`, err.message);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      wallet,
      holdings,
      roles_assigned: rolesAssigned,
    });
  } catch (err) {
    console.error('Complete error:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
