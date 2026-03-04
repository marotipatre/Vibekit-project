import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

export interface AssetInfo {
  id: bigint
  name: string
  unitName: string
  decimals: number
  total: bigint
}

// Module-level cache so asset info is shared across all components
const assetCache = new Map<string, AssetInfo>()

function getAlgorand() {
  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  return AlgorandClient.fromConfig({ algodConfig, indexerConfig })
}

export async function fetchAssetInfo(assetId: bigint): Promise<AssetInfo> {
  const key = assetId.toString()
  const cached = assetCache.get(key)
  if (cached) return cached

  const algorand = getAlgorand()
  const info = await algorand.asset.getById(assetId)

  const asset: AssetInfo = {
    id: assetId,
    name: (info as any).assetName || (info as any).name || `Asset ${assetId}`,
    unitName: (info as any).unitName || (info as any).unit || '',
    decimals: Number((info as any).decimals ?? 0),
    total: BigInt((info as any).total ?? 0),
  }
  assetCache.set(key, asset)
  return asset
}

/**
 * Hook to fetch and cache asset info for one or more asset IDs.
 * Returns a map of assetId → AssetInfo.
 */
export function useAssetInfo(assetIds: (bigint | null | undefined)[]) {
  const [assets, setAssets] = useState<Map<string, AssetInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef<Set<string>>(new Set())

  const validIds = assetIds.filter((id): id is bigint => id !== null && id !== undefined)

  const fetchAll = useCallback(async () => {
    const toFetch = validIds.filter((id) => !fetchedRef.current.has(id.toString()))
    if (toFetch.length === 0) return

    setLoading(true)
    try {
      const results = await Promise.allSettled(toFetch.map((id) => fetchAssetInfo(id)))
      const newMap = new Map(assets)

      results.forEach((result, idx) => {
        const id = toFetch[idx]
        fetchedRef.current.add(id.toString())
        if (result.status === 'fulfilled') {
          newMap.set(id.toString(), result.value)
        }
      })

      setAssets(newMap)
    } catch {
      // silent fail - UI will show fallback IDs
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validIds.map((id) => id.toString()).join(',')])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const getAsset = (id: bigint | null | undefined): AssetInfo | undefined => {
    if (id === null || id === undefined) return undefined
    return assets.get(id.toString())
  }

  const getLabel = (id: bigint | null | undefined): string => {
    const a = getAsset(id)
    if (!a) return id ? `Asset #${id}` : 'Unknown'
    return a.unitName ? `${a.name} (${a.unitName})` : a.name
  }

  const getShortLabel = (id: bigint | null | undefined): string => {
    const a = getAsset(id)
    if (!a) return id ? `#${id}` : '?'
    return a.unitName || a.name || `#${id}`
  }

  return { assets, loading, getAsset, getLabel, getShortLabel, refetch: fetchAll }
}

/**
 * Format a raw base-unit amount to a human-readable string with decimals.
 * e.g. formatAmount(1000000n, 6) → "1.000000"
 */
export function formatAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString()
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const frac = amount % divisor
  const fracStr = frac.toString().padStart(decimals, '0')
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fracStr.replace(/0+$/, '') || '0'
  const display = trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed
  return `${whole}.${display}`
}

/**
 * Parse a human-readable amount string into base units.
 * e.g. parseAmount("1.5", 6) → 1500000n
 */
export function parseAmount(input: string, decimals: number): bigint {
  if (!input || input === '') return 0n
  if (decimals === 0) return BigInt(Math.floor(Number(input)))
  const parts = input.split('.')
  const whole = parts[0] || '0'
  let frac = parts[1] || ''
  // Truncate or pad to match decimals
  if (frac.length > decimals) frac = frac.slice(0, decimals)
  else frac = frac.padEnd(decimals, '0')
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac)
}

// Pool token constants from the contract
export const POOL_TOKEN_TOTAL_SUPPLY = 10_000_000_000n
export const POOL_TOKEN_DECIMALS = 3
export const SCALE = 1000n
export const FEE = 5n
export const FACTOR = SCALE - FEE // 995

/**
 * Estimate LP tokens minted for given deposit amounts.
 * Returns the amount in base units (with pool token's 3 decimals).
 */
export function estimateMint(
  poolBalance: bigint,
  aBalance: bigint,
  bBalance: bigint,
  aAmount: bigint,
  bAmount: bigint,
): bigint {
  if (aAmount <= 0n || bAmount <= 0n) return 0n
  // The contract reads balances AFTER the transfers, so aBalance and bBalance
  // already include the deposited amounts. For initial mint detection, it checks
  // if a_balance == a_amount (meaning pool was empty before).
  const isInitial = aBalance === 0n && bBalance === 0n
  if (isInitial) {
    const product = aAmount * bAmount
    if (product <= 0n) return 0n
    const sq = BigInt(Math.floor(Math.sqrt(Number(product))))
    return sq > SCALE ? sq - SCALE : 0n
  }
  const issued = POOL_TOKEN_TOTAL_SUPPLY - poolBalance
  if (issued <= 0n) return 0n
  // The contract uses: ratio = SCALE * amount / (balance - amount)
  // where balance is post-transfer and (balance - amount) is pre-transfer
  const aPreBal = aBalance  // aBalance from pool info is pre-transfer (we haven't sent yet)
  const bPreBal = bBalance
  if (aPreBal <= 0n || bPreBal <= 0n) return 0n
  const aRatio = SCALE * aAmount / aPreBal
  const bRatio = SCALE * bAmount / bPreBal
  const ratio = aRatio < bRatio ? aRatio : bRatio
  return ratio * issued / SCALE
}

/**
 * Estimate tokens returned when burning LP tokens.
 */
export function estimateBurn(
  poolBalance: bigint,
  aSupply: bigint,
  bSupply: bigint,
  burnAmount: bigint,
): { aOut: bigint; bOut: bigint } {
  if (burnAmount <= 0n) return { aOut: 0n, bOut: 0n }
  // On-chain, pool_balance already includes the LP tokens transferred in the
  // atomic group (asset_transfer executes before the app_call). The contract
  // computes: issued = TOTAL_SUPPLY - (pool_balance - amount)
  //
  // When estimating in the frontend, poolBalance is the PRE-transfer balance
  // (read from account info before the user sends the txn). After the transfer
  // arrives the on-chain balance becomes poolBalance + burnAmount, so:
  //   issued = TOTAL_SUPPLY - ((poolBalance + burnAmount) - burnAmount)
  //          = TOTAL_SUPPLY - poolBalance
  const issued = POOL_TOKEN_TOTAL_SUPPLY - poolBalance
  if (issued <= 0n) return { aOut: 0n, bOut: 0n }
  return {
    aOut: aSupply * burnAmount / issued,
    bOut: bSupply * burnAmount / issued,
  }
}

/**
 * Estimate swap output amount.
 */
export function estimateSwapOutput(
  inAmount: bigint,
  inSupply: bigint,
  outSupply: bigint,
): bigint {
  if (inAmount <= 0n || inSupply <= 0n || outSupply <= 0n) return 0n
  const inTotal = SCALE * (inSupply - inAmount) + inAmount * FACTOR
  const outTotal = inAmount * FACTOR * outSupply
  return inTotal > 0n ? outTotal / inTotal : 0n
}
