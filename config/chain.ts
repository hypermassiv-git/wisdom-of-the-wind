/**
 * ============================================================================
 *  ⚠️  CHAIN ADDRESSES & RPC — FILL THESE IN BEFORE SWITCHING TO LIVE MODE  ⚠️
 * ============================================================================
 *
 * Addresses provided by the project owner and verified on-chain (each answers getPool()).
 * Live mode refuses to run while any required address is missing.
 *
 * The RPC URL is read from the MONAD_RPC_URL environment variable (server-side only).
 */

import type { Address } from "viem";

export interface MarketAddresses {
  /** Stable id used in the app. */
  id: string;
  /** Plain-English name shown to users. */
  name: string;
  kind: "main" | "isolated";
  /**
   * Aave V3 PoolAddressesProvider. The Pool, oracle and data provider are all read from it,
   * and the rewards controller is read from each aToken.
   */
  poolAddressesProvider: Address | null;
}

export const CHAIN_ID = 143; // Monad mainnet

export const MARKETS: MarketAddresses[] = [
  {
    id: "main",
    name: "main pool",
    kind: "main",
    poolAddressesProvider: "0x49D75170F55C964dfdd6726c74fdEDEe75553A0f",
  },
  {
    id: "pt-ausd",
    name: "PT-AUSD isolated market",
    kind: "isolated",
    poolAddressesProvider: "0xb80397A931FcFdA3aC999a3a5639C328Dc72A58F",
  },
  {
    id: "pt-shmon",
    name: "PT-shMON isolated market",
    kind: "isolated",
    poolAddressesProvider: "0x300fA05F6fc9503EAbaAcB1dec7C35D65229f86f",
  },
  {
    id: "syzusd",
    name: "syzUSD isolated market",
    kind: "isolated",
    // "Neverland Isolated Yuzu" on-chain.
    poolAddressesProvider: "0xd5B80eCA4a3f67c2F8919927907e5f0B64f1f5D3",
  },
];

export const DUST = {
  /** DUST token address. */
  token: "0xAD96C3dffCD6374294e2573A7fBBA96097CC8d7c" as Address | null,
  /** DUST/USDC Uniswap V2 pair address. */
  usdcPair: "0x86dBF00485871C901C5129bD525348Db96c2eB2d" as Address | null,
};

export function getRpcUrl(): string | undefined {
  return process.env.MONAD_RPC_URL || undefined;
}

export function missingLiveConfig(): string[] {
  const missing: string[] = [];
  if (!getRpcUrl()) missing.push("MONAD_RPC_URL env var");
  for (const m of MARKETS) if (!m.poolAddressesProvider) missing.push(`${m.id}.poolAddressesProvider`);
  if (!DUST.token) missing.push("DUST.token");
  if (!DUST.usdcPair) missing.push("DUST.usdcPair");
  return missing;
}
