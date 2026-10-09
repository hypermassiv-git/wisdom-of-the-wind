# Wisdom of the Wind

An independent, read-only web app that shows DeFi beginners which lending strategies on Neverland (an Aave V3 fork on Monad) are profitable at current rates. It has no wallet connection and makes no transactions.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (sample data by default)
npm test           # unit tests for the rate math and strategy engine
```

## Where things live

| Path | What |
|---|---|
| `config/assets.ts` | Every asset: price family, stablecoin or not, supply-only, built-in yield (with a hook for a live yield source) and loop pairing |
| `config/chain.ts` | ⚠️ Contract addresses (all TODO) and the RPC URL (env var) |
| `config/engine.ts` | Minimum rate (1%), leverage (50% of max), reward valuation, held rewards (DUST), risk scoring |
| `lib/data/` | Mock and live data sources, plus pure rate converters |
| `lib/engine/` | Pure strategy engine: generators, math, risk, text templates |
| `app/api/strategies` | Server endpoint: fetches the data, runs the engine and caches the result for 60s |

## Live data

Live mode is configured. `config/chain.ts` has the three PoolAddressesProviders and the DUST/USDC pair, all verified on-chain.

- **Rates, LTVs, caps, e-mode and DUST emissions:** read from the Aave V3 contracts through each market's PoolAddressesProvider.
- **MON incentives:** read from the Merkl API and matched to reserves by aToken address. If Merkl is down they are left out.
- **DUST price:** spot price from the DUST/USDC Uniswap V2 pair. It is used only to turn DUST emissions into token amounts. DUST is shown as "Your piece of Neverland" in tokens, never in dollars, and is left out of totals and ranking.
- **Built-in yields:**
  - shMON, sMON, gMON and earnAUSD come from DefiLlama's yields API.
  - PT fixed rates come from Pendle's API, matched by PT address, so a new PT is picked up automatically when the old one matures.
  - If a source is down, the `staticApr` fallback in `config/assets.ts` is used.
- **RPC:** `MONAD_RPC_URL` is tried first. Monad's public RPC is the backup.

```bash
npm run check:live   # smoke test against the real chain (needs MONAD_RPC_URL)
```

## Deploy

Hosted on Vercel as the project `wisdom-of-the-wind` in the hypermassiv-2243 personal scope. Production is at https://wisdom-of-the-wind.vercel.app. Env vars `DATA_MODE=live` and `MONAD_RPC_URL` are set for Production and Preview.

```bash
npx vercel deploy --prod --scope hypermassiv-2243s-projects
```
