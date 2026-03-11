# BreadioBot 🍞

**Open-source Discord NFT verification bot for any EVM chain.**

Verify NFT holdings → assign Discord roles automatically. Works with Ethereum, MegaETH, Base, Polygon, Arbitrum, or any EVM-compatible chain.

## How It Works

```
User clicks "Verify" → Connects Wallet → Authorizes Discord → Signs Message → Gets Roles
```

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend    │────→│  /api/verify │────→│  Discord     │
│  (your site) │     │  OAuth start │     │  OAuth2      │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
┌─────────────┐     ┌──────────────┐     ┌──────▼──────┐
│  Any EVM    │←────│ /api/complete│←────│ /api/callback│
│  (balanceOf)│     │ verify+roles │     │ OAuth return │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Features

- **Multi-chain** — verify NFTs across multiple EVM chains simultaneously
- **Multi-collection** — support unlimited NFT collections per server
- **Tiered roles** — assign different roles based on holding thresholds (Holder, Whale, etc.)
- **Serverless** — deploys to Vercel with zero infrastructure
- **Stateless** — no database needed, all verification happens in real-time
- **Secure** — wallet ownership verified via EIP-191 signed messages (5-min expiry)
- **Embeddable** — API endpoints work standalone, embed in any existing site

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/tut9492/BreadioBot.git
cd BreadioBot/BreadioBot
```

Edit `config.json` with your chains, collections, and Discord role IDs:

```json
{
  "guild_id": "YOUR_DISCORD_SERVER_ID",
  "chains": [
    {
      "id": 1,
      "rpc": "https://ethereum-rpc.publicnode.com",
      "name": "Ethereum"
    },
    {
      "id": 4326,
      "rpc": "https://megaeth.drpc.org",
      "name": "MegaETH"
    }
  ],
  "collections": [
    {
      "name": "My NFT Collection",
      "contract": "0xYOUR_CONTRACT_ADDRESS",
      "chain_id": 1,
      "roles": [
        { "min": 1, "role_id": "DISCORD_ROLE_ID", "name": "Holder" },
        { "min": 10, "role_id": "DISCORD_ROLE_ID", "name": "Whale" }
      ]
    }
  ]
}
```

### 2. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. **Bot** tab → Reset Token → copy it
3. **OAuth2** tab → add redirect URL: `https://YOUR_DOMAIN/api/callback`
4. **Bot** tab → enable **Server Members Intent**
5. Invite to your server:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268435456&scope=bot
   ```
6. In Server Settings → Roles, drag the bot role **above** all roles it needs to assign

### 3. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/tut9492/BreadioBot/tree/main/BreadioBot)

Set these environment variables:

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | ✅ | Bot token from step 2 |
| `DISCORD_CLIENT_ID` | ✅ | OAuth2 application client ID |
| `DISCORD_CLIENT_SECRET` | ✅ | OAuth2 client secret |
| `VERIFICATION_URL` | ❌ | Base URL override (auto-detected) |
| `DISCORD_GUILD_ID` | ❌ | Override guild_id from config.json |
| `ETHEREUM_RPC` | ❌ | Override Ethereum RPC from config |
| `MEGAETH_RPC` | ❌ | Override MegaETH RPC from config |

### 4. Done!

Share your verification URL with your community. Users click → connect wallet → connect Discord → get roles.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/verify` | GET | Starts Discord OAuth2 flow |
| `/api/callback` | GET | Discord OAuth2 callback |
| `/api/complete` | POST | Verifies wallet, checks holdings, assigns roles |

### POST `/api/complete`

```json
{
  "wallet": "0x...",
  "signature": "0x...",
  "discord_user_id": "123456789",
  "discord_access_token": "...",
  "timestamp": 1234567890
}
```

### Response

```json
{
  "success": true,
  "wallet": "0x...",
  "holdings": [
    { "collection": "My NFTs", "chain_id": 1, "count": 5 }
  ],
  "roles_assigned": [
    { "collection": "My NFTs", "role": "Holder", "count": 5 }
  ]
}
```

## Site Integration

The API endpoints are standalone — embed verification in any existing website:

1. Redirect users to `/api/verify` to start Discord OAuth
2. After callback, prompt wallet signature
3. POST to `/api/complete` with the signed payload

The included `frontend/index.html` is a ready-to-use reference implementation.

## Adding a New Chain

Add an entry to the `chains` array in `config.json`:

```json
{
  "id": 8453,
  "rpc": "https://mainnet.base.org",
  "name": "Base"
}
```

Then reference `chain_id: 8453` in your collections. That's it.

## Tech Stack

- **Runtime:** Vercel serverless functions (Node.js ESM)
- **On-chain:** [viem](https://viem.sh) (ERC-721 balanceOf)
- **Auth:** Discord OAuth2 + EIP-191 wallet signatures
- **Frontend:** Vanilla HTML/JS + [ethers.js](https://docs.ethers.org/v6/)
- **Database:** None — fully stateless

## Security

- Wallet ownership verified via signed message with 5-minute expiry
- Discord identity verified via OAuth2 token exchange
- Bot token stays server-side only
- No data stored — all verification is real-time

## License

MIT — use it however you want 🍞
