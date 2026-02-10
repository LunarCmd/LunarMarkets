# LunarMarkets Trading Dashboard

[![Twitter Follow](https://img.shields.io/twitter/follow/LunarMarkets?style=social)](https://x.com/LunarMarkets)
[![GitHub](https://img.shields.io/github/stars/LunarCmd/LunarMarkets?style=social)](https://github.com/LunarCmd/LunarMarkets)

**Real-time trading dashboard for Percolator perpetual markets on Solana.**

This is a fork of the [Percolator risk engine](https://github.com/percolator-cli/percolator) with an added production-ready web trading interface.

## 🚀 Quick Start

```bash
cd dashboard
npm install
cp .env.example .env.local
# Configure your market settings in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start trading.

## ✨ Dashboard Features

### Trading & Market Data
- 📊 **Real-time market data** - Live order book, positions, and account states
- 📈 **Multi-market support** - Trade multiple perpetual markets from one interface
- 💹 **DexScreener integration** - Live price charts and market analytics
- 🎯 **Personal position tracking** - Real-time PnL calculations and position management
- 💰 **Deposit/Withdraw/Trade** - Full trading functionality with one-click execution

### Security & Wallet Management
- 🔐 **PIN-encrypted wallet storage** - AES-256-GCM encryption with PBKDF2 (100k iterations)
- 🛡️ **Failed attempt protection** - Auto-wipe after 10 failed PIN attempts
- 🧮 **Math challenge** - Anti-brute-force protection on 9th attempt
- 🔒 **Client-side only** - Keys never leave your browser, no server storage
- 💾 **Persistent saved wallets** - Encrypted keypairs survive browser/server restarts

### User Experience
- 🌙 **Dark mode optimized** - Professional trading interface with black/grey theme
- ⚡ **Custom RPC support** - Configure your own high-performance RPC endpoints
- 🎨 **Logo/branding support** - Customize with your own branding
- 📱 **Responsive design** - Works on desktop and mobile
- ⚠️ **Progressive warnings** - Clear alerts at 8 and 9 failed PIN attempts
- 🔄 **Auto-refresh with error handling** - Pauses on RPC errors, resumes on success

## 📸 Screenshots

[Add screenshots here when ready]

## 🔧 Configuration

### Required Environment Variables

Create a `.env.local` file in the `dashboard/` directory:

```env
# Market Configuration (Required - must be valid Solana public keys)
NEXT_PUBLIC_SLAB_ADDRESS=your_slab_address_here
NEXT_PUBLIC_TOKEN_ADDRESS=your_token_address_here
NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
NEXT_PUBLIC_MATCHER_PROGRAM_ID=your_matcher_program_id_here

# RPC Configuration (Recommended)
NEXT_PUBLIC_RPC_URL=https://your-rpc-endpoint.com

# Market Display
NEXT_PUBLIC_MARKET_NAME=LIQUID/SOL PERP
NEXT_PUBLIC_COLLATERAL_SYMBOL=SOL
NEXT_PUBLIC_UNDERLYING_SYMBOL=LIQUID
NEXT_PUBLIC_COLLATERAL_DECIMALS=9
NEXT_PUBLIC_UNDERLYING_DECIMALS=6

# Branding (Optional)
NEXT_PUBLIC_APP_NAME=LunarMarkets
NEXT_PUBLIC_APP_LOGO=/logo.png
```

### RPC Endpoints

⚠️ **Important**: The default public RPC is rate-limited and unreliable. Get your own RPC from:
- [Helius](https://helius.xyz) - Recommended for high performance
- [QuickNode](https://quicknode.com)
- [Alchemy](https://alchemy.com)
- Or run your own Solana validator

## 🏗️ Project Structure

```
LunarMarkets/
├── dashboard/              # Trading dashboard (Next.js app)
│   ├── src/
│   │   ├── app/           # Next.js pages and layouts
│   │   ├── components/    # React components
│   │   │   ├── Header.tsx
│   │   │   ├── TradingPanel.tsx
│   │   │   ├── PinModal.tsx
│   │   │   ├── AccountsTable.tsx
│   │   │   └── ...
│   │   ├── contexts/      # React contexts (WalletContext)
│   │   ├── hooks/         # Custom hooks (useMarketData, useTokenInfo)
│   │   ├── lib/           # Core libraries
│   │   │   ├── solana.ts      # Blockchain interaction
│   │   │   ├── crypto.ts      # Client-side encryption
│   │   │   ├── transactions.ts # Transaction building
│   │   │   └── config.ts      # Configuration management
│   │   └── types/         # TypeScript type definitions
│   ├── public/            # Static assets
│   └── package.json
│
└── [percolator engine code] # Original Percolator risk engine

```

## 🛡️ Security Notes

### Wallet Key Storage (Experimental)

⚠️ **For testing/development only** - Use with caution

- All encryption happens **client-side** using Web Crypto API
- Keys stored in browser `localStorage` (never on server)
- AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations)
- PIN stored in `sessionStorage` (cleared on browser close)
- After 10 failed PIN attempts, all keys are permanently deleted
- Math challenge required on 9th attempt to prevent brute force

**Verify for yourself:**
1. Open DevTools → Network tab (no key-related requests)
2. Open DevTools → Application → Local Storage (see encrypted data)
3. Review source code - no API endpoints for key storage

### Best Practices

✅ Always verify the URL before entering sensitive data
✅ Use strong, unique PINs (not 1234, 0000, etc.)
✅ Use a custom RPC endpoint for production trading
✅ Keep your browser and OS updated
✅ Consider using a dedicated browser profile for trading

## 🔗 Links

- **Twitter/X:** [@LunarMarkets](https://x.com/LunarMarkets)
- **GitHub:** [LunarCmd/LunarMarkets](https://github.com/LunarCmd/LunarMarkets)
- **Original Percolator:** [percolator-cli/percolator](https://github.com/percolator-cli/percolator)

## 💻 Tech Stack

- **Next.js 16.1.6** - React framework with Turbopack
- **React 19** - Latest React with new features
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first styling
- **@solana/web3.js** - Solana blockchain interaction
- **Web Crypto API** - Browser-native encryption
- **Lucide Icons** - Beautiful icon library

## 📦 Building for Production

```bash
cd dashboard
npm run build
npm run start
```

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

[Add your license here]

---

# Original Percolator Documentation

⚠️ **EDUCATIONAL RESEARCH PROJECT — NOT PRODUCTION READY** ⚠️
Do **NOT** use with real funds. Not audited. Experimental design.

Percolator is a **formally verified accounting + risk engine** for perpetual futures DEXs on Solana.

**Primary goal:**

> **No user can ever withdraw more value than actually exists on the exchange balance sheet.**

Percolator **does not move tokens**. A wrapper program performs SPL transfers and calls into the engine.

---

## What kind of perp design is this?

Percolator is a **hybrid**:
- **Synthetics-style risk**: users take positions against **LP accounts** (inventory holders), and the engine enforces margin, liquidations, ADL/socialization, and withdrawal safety against a shared balance sheet.
- **Orderbook-style execution extensibility**: LPs provide a **pluggable matcher program/context** (`MatchingEngine`) that can implement AMM/RFQ/CLOB logic and can **reject** trades.

### Design clarifications

- **Users choose which LP to trade with.**  
  The wrapper routes the trade to a specific LP account. The LP is not forced to take every trade: its **matcher** may reject, and the engine rejects if post-trade solvency fails.

- **Liquidity fragmentation is possible at the execution layer.**  
  If users must target a specific LP account, then the maximum fill against that LP is bounded by that LP’s inventory/margin. Aggregation/routing across LPs is a **wrapper-level** feature.

- **Positions opened with LP1 can be closed against LP2 — by design.**  
  The engine uses **variation margin** semantics: `entry_price` is **the last oracle mark at which the position was settled** (not per-counterparty trade entry).  
  Before mutating positions, the engine settles mark-to-oracle (`settle_mark_to_oracle`), making positions **fungible** across LPs for closing.

- **Liquidations are oracle-price closes of the liquidated account only — by design.**  
  Liquidation does **not** require finding the original counterparty LP. It closes the liquidated account at the oracle price and routes PnL via the engine’s waterfall.

---

## Balance-Sheet-Backed Net Extraction (Security Claim)

No sequence of trades, oracle updates, funding accruals, warmups, ADL/socialization, panic settles, force-realize scans, or withdrawals can allow net extraction beyond what is funded by others’ realized losses and spendable insurance.

---

## Wrapper usage (token movement)

### Deposits
1. Transfer tokens into the vault SPL account.
2. Call `RiskEngine::deposit(idx, amount, now_slot)`.

### Withdrawals
1. Call `RiskEngine::withdraw(idx, amount, now_slot, oracle_price)`.
2. If Ok, transfer tokens out of the vault SPL account.

Withdraw only returns **capital**. Positive PnL becomes capital only via warmup/budget rules.

Withdrawal safety checks enforced by the engine:
- **Fresh crank required** (time-based staleness gate)
- **Recent sweep started** for risk-increasing operations
- **No pending socialization** (blocks value extraction while `pending_profit_to_fund` or `pending_unpaid_loss` are non-zero)
- **Post-withdrawal margin checks** if a position remains open

---

## Trading

Wrapper validates signatures and oracle input, then calls:

`RiskEngine::execute_trade(matcher, lp_idx, user_idx, now_slot, oracle_price, size)`

Execution semantics (implementation-aligned):
- Funding is settled lazily on touched accounts.
- Positions are made fungible by settling mark-to-oracle before mutation:
  - `settle_mark_to_oracle()` realizes mark PnL into `account.pnl` and sets `entry_price = oracle_price`.
- Trade PnL is only execution-vs-oracle:
  - `trade_pnl = (oracle_price - exec_price) * exec_size / 1e6` (zero-sum between user and LP)
- Warmup slope is updated after PnL changes; profits warm over time and may become capital **even while a position remains open**, but withdrawals are still constrained by margin + system budget + socialization gates.

---

## Keeper crank, liveness, and cleanup

`RiskEngine::keeper_crank(...)` is permissionless.

The crank is **cursor-based**, not a fixed 16-step schedule:
- It scans up to `ACCOUNTS_PER_CRANK` occupied slots per call.
- It detects “sweep complete” when the scanning cursor wraps back to the sweep start.
- Liquidations and force-realize work are bounded by per-call budgets.

Budget constants (from code):
- `LIQ_BUDGET_PER_CRANK = 120`
- `FORCE_REALIZE_BUDGET_PER_CRANK = 32`
- `GC_CLOSE_BUDGET = 32`

### Liquidation semantics
- Liquidations close the **liquidated account** at the **oracle price** (no LP/AMM required).
- Profit/loss routing:
  - If `mark_pnl > 0`: profit must be funded; the engine funds it via ADL/socialization (excluding the winner from funding itself).
  - If `mark_pnl <= 0`: losses are realized from the account’s own capital immediately; any unpaid remainder becomes socialized loss.
- Liquidation fee is charged from remaining capital to insurance (if configured).

### Abandoned accounts / dust GC
User accounts with:
- `position_size == 0`
- `capital == 0`
- `reserved_pnl == 0`
- `pnl <= 0`

are eligible to be freed by crank GC. LP accounts are never GC’d.

(If maintenance fees are enabled, the intended behavior is that crank processing advances fee settlement so abandoned accounts eventually reach dust and are freed.)

---

## Formal verification

Kani harnesses verify key invariants including conservation, isolation, and no-teleport behavior for cross-LP closes.

```bash
cargo install --locked kani-verifier
cargo kani setup
cargo kani