# Percolator Dashboard

A web dashboard for monitoring Percolator Risk Engine markets on Solana.

## Features

- **Multi-Market Support**: Configure and switch between multiple markets (SLABs, programs, tokens)
- **Real-time Data**: Auto-refresh with configurable intervals
- **Account Monitoring**: View all user and LP accounts with positions, PnL, and capital
- **Market Statistics**: TVL, open interest, insurance fund balance, and more
- **Settings Management**: Add, edit, and delete market configurations via UI

## Configuration

The dashboard reads configuration from `.env.local`:

```bash
# RPC endpoint
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Market configurations (JSON array)
NEXT_PUBLIC_MARKETS=[
  {
    "id": "sol-perp",
    "name": "SOL-PERP",
    "description": "Solana Perpetual Futures",
    "slabAddress": "your-slab-address",
    "tokenAddress": "your-token-address",
    "programId": "your-program-id",
    "matcherProgramId": "your-matcher-program-id",
    "oracleAddress": "your-oracle-address"
  }
]

# Default market to load on startup
NEXT_PUBLIC_DEFAULT_MARKET_ID=sol-perp

# Refresh interval in milliseconds
NEXT_PUBLIC_REFRESH_INTERVAL=5000
```

## Getting Started

1. **Install dependencies**:
   ```bash
   cd dashboard
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your values
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: http://localhost:3000

## Architecture

```
dashboard/
├── src/
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and Solana integration
│   └── types/         # TypeScript types
├── .env.local         # Environment configuration
└── package.json       # Dependencies
```

## Key Components

- **Header**: Market selector, connection status, settings
- **StatsCard**: TVL, accounts, open interest, insurance fund
- **MarketInfo**: Display configured addresses with copy/explorer links
- **AccountsTable**: List of all accounts with positions
- **SettingsModal**: Add/edit/delete market configurations

## Data Flow

1. Configuration loaded from `.env.local`
2. Markets stored in localStorage for persistence
3. Solana Web3.js connection fetches on-chain data
4. Account data parsed from slab structure
5. Auto-refresh at configured interval

## Security Notes

⚠️ This dashboard is for educational purposes only.
- Never use with real funds on mainnet
- Always verify addresses before configuration
- Keep private keys out of the dashboard
