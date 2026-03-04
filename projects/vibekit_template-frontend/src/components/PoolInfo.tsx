import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConstantProductAmmClient } from '../contracts/ConstantProductAMM'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { formatAmount, POOL_TOKEN_DECIMALS, POOL_TOKEN_TOTAL_SUPPLY, SCALE, FEE } from '../hooks/useAssetInfo'

interface PoolInfoProps {
  appId: bigint
  appAddress: string
  assetAName: string
  assetBName: string
  assetADecimals: number
  assetBDecimals: number
}

const PoolInfo = ({ appId, appAddress, assetAName, assetBName, assetADecimals, assetBDecimals }: PoolInfoProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assetAId, setAssetAId] = useState(0n)
  const [assetBId, setAssetBId] = useState(0n)
  const [poolTokenId, setPoolTokenId] = useState(0n)
  const [ratio, setRatio] = useState(0n)
  const [governor, setGovernor] = useState('')
  const [reserveA, setReserveA] = useState(0n)
  const [reserveB, setReserveB] = useState(0n)
  const [poolBalance, setPoolBalance] = useState(0n)
  const [algoBalance, setAlgoBalance] = useState(0n)
  const { transactionSigner, activeAddress } = useWallet()
  const signerRef = useRef(transactionSigner)
  signerRef.current = transactionSigner

  const fetchPoolInfo = useCallback(async () => {
    if (!activeAddress) return
    setLoading(true)
    setError(null)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(signerRef.current)

      const ammClient = new ConstantProductAmmClient({
        appId, algorand, defaultSender: activeAddress,
      })

      const gs = await ammClient.state.global.getAll()
      if (gs) {
        setAssetAId(gs.assetA ?? 0n)
        setAssetBId(gs.assetB ?? 0n)
        setPoolTokenId(gs.poolToken ?? 0n)
        setRatio(gs.ratio ?? 0n)
        setGovernor(gs.governor?.toString() ?? '')
      }

      const info = await algorand.account.getInformation(appAddress)
      setAlgoBalance(info.balance?.microAlgo ?? 0n)
      if (info.assets) {
        for (const a of info.assets) {
          const aid = BigInt(a.assetId)
          const amt = BigInt(a.amount)
          if (gs?.assetA && aid === gs.assetA) setReserveA(amt)
          else if (gs?.assetB && aid === gs.assetB) setReserveB(amt)
          else if (gs?.poolToken && aid === gs.poolToken) setPoolBalance(amt)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch pool info')
      console.error('PoolInfo error:', e)
    } finally {
      setLoading(false)
    }
  }, [activeAddress, appId, appAddress])

  useEffect(() => { fetchPoolInfo() }, [fetchPoolInfo])

  const issued = POOL_TOKEN_TOTAL_SUPPLY - poolBalance
  const priceAinB = reserveB > 0n ? Number(reserveA) / Number(reserveB) : 0
  const priceBinA = reserveA > 0n ? Number(reserveB) / Number(reserveA) : 0

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-lg">📊 Pool Dashboard</h2>
          <button className="btn btn-ghost btn-sm" onClick={fetchPoolInfo} disabled={loading || !activeAddress}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : '🔄'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error text-sm py-2">
            <span>⚠️ {error}</span>
            <button className="btn btn-ghost btn-xs" onClick={fetchPoolInfo}>Retry</button>
          </div>
        )}

        {!error && reserveA > 0n && (
          <>
            {/* Pool pair header */}
            <div className="text-center py-2">
              <div className="text-2xl font-bold">{assetAName} / {assetBName}</div>
              <div className="text-xs opacity-50 mt-1">App ID: {appId.toString()} • Pool Token ID: {poolTokenId.toString()}</div>
            </div>

            {/* Reserves */}
            <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
              <div className="stat">
                <div className="stat-title">{assetAName} Reserve</div>
                <div className="stat-value text-lg">{formatAmount(reserveA, assetADecimals)}</div>
                <div className="stat-desc">ID: {assetAId.toString()}</div>
              </div>
              <div className="stat">
                <div className="stat-title">{assetBName} Reserve</div>
                <div className="stat-value text-lg">{formatAmount(reserveB, assetBDecimals)}</div>
                <div className="stat-desc">ID: {assetBId.toString()}</div>
              </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-base-300 rounded-lg p-3">
                <div className="text-xs opacity-50">Price Ratio</div>
                <div className="font-bold text-sm">1 {assetAName} = {priceBinA.toFixed(4)} {assetBName}</div>
                <div className="text-xs opacity-50">1 {assetBName} = {priceAinB.toFixed(4)} {assetAName}</div>
              </div>
              <div className="bg-base-300 rounded-lg p-3">
                <div className="text-xs opacity-50">LP Tokens Issued</div>
                <div className="font-bold text-sm">{formatAmount(issued, POOL_TOKEN_DECIMALS)}</div>
                <div className="text-xs opacity-50">of {formatAmount(POOL_TOKEN_TOTAL_SUPPLY, POOL_TOKEN_DECIMALS)} max</div>
              </div>
              <div className="bg-base-300 rounded-lg p-3">
                <div className="text-xs opacity-50">Swap Fee</div>
                <div className="font-bold text-sm">{(Number(FEE) / Number(SCALE) * 100).toFixed(1)}%</div>
                <div className="text-xs opacity-50">per trade</div>
              </div>
              <div className="bg-base-300 rounded-lg p-3">
                <div className="text-xs opacity-50">Contract ALGO</div>
                <div className="font-bold text-sm">{(Number(algoBalance) / 1_000_000).toFixed(3)}</div>
                <div className="text-xs opacity-50">ALGO balance</div>
              </div>
            </div>

            {/* Governor */}
            <div className="mt-3 text-xs opacity-50">
              <span className="font-medium">Governor: </span>
              <span className="font-mono break-all">{governor}</span>
            </div>
          </>
        )}

        {!error && reserveA === 0n && !loading && (
          <p className="text-sm opacity-60">No liquidity in the pool yet. Add liquidity to see pool stats.</p>
        )}

        {/* How it works */}
        <details className="mt-3">
          <summary className="text-xs opacity-50 cursor-pointer">How does this AMM work?</summary>
          <div className="text-xs opacity-60 mt-2 bg-base-300 rounded-lg p-3 space-y-2">
            <p>This is a <strong>Constant Product AMM</strong> (like Uniswap v2). The core invariant is:</p>
            <p className="font-mono text-center text-sm my-2">reserve_A × reserve_B = k (constant)</p>
            <p><strong>Swaps:</strong> When you trade token A for token B, you increase A reserves and decrease B reserves, keeping k constant (minus the 0.5% fee).</p>
            <p><strong>Liquidity:</strong> When you add liquidity, you deposit both tokens proportionally and receive LP tokens representing your pool share.</p>
            <p><strong>LP Token:</strong> Has 3 decimals. Total supply is 10,000,000,000 base units = 10,000,000.000 tokens. On initial deposit, 1.000 LP token is burned (locked) to prevent rounding attacks.</p>
            <p><strong>Price Impact:</strong> Larger trades cause more price movement. The formula automatically adjusts prices based on supply.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

export default PoolInfo
