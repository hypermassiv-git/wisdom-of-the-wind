/**
 * Minimal Aave V3 ABIs. These functions have kept the same shape across Aave V3 versions
 * (3.0 → 3.3), unlike UiPoolDataProvider whose struct changes between releases, so a
 * fork on any V3 version decodes correctly.
 */
import { parseAbi } from "viem";

export const addressesProviderAbi = parseAbi([
  "function getPool() view returns (address)",
  "function getPriceOracle() view returns (address)",
  "function getPoolDataProvider() view returns (address)",
]);

export const poolAbi = parseAbi([
  "function getReservesList() view returns (address[])",
  // Aave 3.0/3.1 only. Missing on 3.2+, in which case e-mode is skipped (more conservative).
  "function getEModeCategoryData(uint8 id) view returns ((uint16 ltv, uint16 liquidationThreshold, uint16 liquidationBonus, address priceSource, string label))",
]);

export const dataProviderAbi = parseAbi([
  "function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)",
  "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
  "function getReserveCaps(address asset) view returns (uint256 borrowCap, uint256 supplyCap)",
  "function getPaused(address asset) view returns (bool)",
  "function getReserveEModeCategory(address asset) view returns (uint256)",
  "function getInterestRateStrategyAddress(address asset) view returns (address)",
]);

export const oracleAbi = parseAbi([
  "function getAssetsPrices(address[] assets) view returns (uint256[])",
  "function BASE_CURRENCY_UNIT() view returns (uint256)",
]);

export const aTokenAbi = parseAbi(["function getIncentivesController() view returns (address)"]);

export const rewardsControllerAbi = parseAbi([
  "function getRewardsByAsset(address asset) view returns (address[])",
  "function getRewardsData(address asset, address reward) view returns (uint256 index, uint256 emissionPerSecond, uint256 lastUpdateTimestamp, uint256 distributionEnd)",
]);

export const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export const uniV2PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

/** Aave 3.0/3.1 per-reserve strategy (values in ray). */
export const rateStrategyV1Abi = parseAbi([
  "function getBaseVariableBorrowRate() view returns (uint256)",
  "function getVariableRateSlope1() view returns (uint256)",
  "function getVariableRateSlope2() view returns (uint256)",
  "function OPTIMAL_USAGE_RATIO() view returns (uint256)",
]);

/** Aave 3.2+ shared strategy (values in bps). */
export const rateStrategyV2Abi = parseAbi([
  "function getInterestRateDataBps(address reserve) view returns ((uint16 optimalUsageRatio, uint32 baseVariableBorrowRate, uint32 variableRateSlope1, uint32 variableRateSlope2))",
]);
