/** Normalized market data. Both mock and live sources produce this shape. */

export interface Incentive {
  /** Reward token symbol, e.g. "DUST" or "MON". */
  token: string;
  /** Yearly reward rate valued at the token's current market price (0.02 = 2%). */
  apr: number;
}

/** Aave V3 variable-rate curve (all yearly APR decimals) plus the reserve factor. */
export interface RateModel {
  baseRate: number;
  slope1: number;
  slope2: number;
  /** Utilization where the steep slope kicks in (0.9 = 90%). */
  optimalUsage: number;
  /** Share of borrower interest kept by the protocol. */
  reserveFactor: number;
}

export interface Reserve {
  /** Asset symbol as in config/assets.ts. */
  symbol: string;
  /** Yearly rate earned by depositors (APY, decimal). */
  supplyRate: number;
  /** Yearly rate paid by borrowers (APY, decimal). */
  borrowRate: number;
  /** Max loan-to-value when used as a deposit to borrow against (0.8 = 80%). 0 if not allowed. */
  ltv: number;
  /** Point at which the position can be liquidated. */
  liquidationThreshold: number;
  canBorrow: boolean;
  canCollateral: boolean;
  /** False when frozen, paused or at the supply cap. */
  canSupply: boolean;
  priceUsd: number;
  totalSupplyUsd: number;
  /** Total currently borrowed. */
  totalDebtUsd: number;
  /** Cash available to borrow right now. */
  availableLiquidityUsd: number;
  /** Deposit/borrow caps in USD (undefined = no cap). */
  supplyCapUsd?: number;
  borrowCapUsd?: number;
  /** How rates respond to utilization; used to price in the user's own deposit/loan. */
  rateModel?: RateModel;
  supplyIncentives: Incentive[];
  borrowIncentives: Incentive[];
  /** Efficiency-mode category (correlated assets get higher LTV). */
  eModeId?: number;
}

export interface EMode {
  id: number;
  label: string;
  ltv: number;
  liquidationThreshold: number;
}

export interface Market {
  id: string;
  name: string;
  kind: "main" | "isolated";
  reserves: Reserve[];
  eModes: EMode[];
}

export interface MarketSnapshot {
  markets: Market[];
  dustPriceUsd: number;
  /** Built-in yields resolved at fetch time (symbol → yearly rate). */
  builtInYields: Record<string, number>;
  /** Which built-in yields came from a live source (false = config fallback). */
  builtInYieldsLive?: Record<string, boolean>;
  /** PT maturity dates read from chain (symbol → ISO date). */
  maturities?: Record<string, string>;
  fetchedAt: string;
  source: "mock" | "live";
  /** Set when live data failed and we're showing an older snapshot. */
  stale?: boolean;
}
