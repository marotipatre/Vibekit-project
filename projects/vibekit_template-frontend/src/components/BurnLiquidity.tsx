import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConstantProductAmmClient } from '../contracts/ConstantProductAMM'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { estimateBurn, formatAmount, parseAmount, POOL_TOKEN_DECIMALS, POOL_TOKEN_TOTAL_SUPPLY } from '../hooks/useAssetInfo'

interface BurnLiquidityProps {
  appId: bigint
  appAddress: string
  assetA: bigint
  assetB: bigint
  assetAName: string
  assetBName: string
  assetADecimals: number
  assetBDecimals: number
  poolTokenId: bigint
  onBurned: () => void
}

const BurnLiquidity = ({
  appId, appAddress, assetA, assetB,
  assetAName, assetBName, assetADecimals, assetBDecimals,
  poolTokenId, onBurned,
}: BurnLiquidityProps) => {
  const [loading, setLoading] = useState(false)
  const [burnAmount, setBurnAmount] = useState('')
  const [reserveA, setReserveA] = useState(0n)
  const [reserveB, setReserveB] = useState(0n)
  const [poolBalance, setPoolBalance] = useState(0n)
  const [estimated, setEstimated] = useState<{ aOut: string; bOut: string } | null>(null)
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const signerRef = useRef(transactionSigner)
  signerRef.current = transactionSigner

  // Fetch reserves
  const fetchReserves = useCallback(async () => {
    if (!activeAddress) return
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(signerRef.current)
      const info = await algorand.account.getInformation(appAddress)
      if (info.assets) {
        for (const a of info.assets) {
          const aid = BigInt(a.assetId)
          const amt = BigInt(a.amount)
          if (aid === assetA) setReserveA(amt)
          else if (aid === assetB) setReserveB(amt)
          else if (aid === poolTokenId) setPoolBalance(amt)
        }
      }
    } catch { /* silent */ }
  }, [activeAddress, appAddress, assetA, assetB, poolTokenId])

  useEffect(() => { fetchReserves() }, [fetchReserves])

  // Estimate withdrawal
  useEffect(() => {
    if (!burnAmount || Number(burnAmount) <= 0) { setEstimated(null); return }
    const rawBurn = parseAmount(burnAmount, POOL_TOKEN_DECIMALS)
    const result = estimateBurn(poolBalance, reserveA, reserveB, rawBurn)
    setEstimated({
      aOut: formatAmount(result.aOut, assetADecimals),
      bOut: formatAmount(result.bOut, assetBDecimals),
    })
  }, [burnAmount, poolBalance, reserveA, reserveB, assetADecimals, assetBDecimals])

  const issued = POOL_TOKEN_TOTAL_SUPPLY - poolBalance

  const handleBurn = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }
    if (!burnAmount) {
      enqueueSnackbar('Please enter LP tokens to burn', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const ammClient = new ConstantProductAmmClient({
        appId, algorand, defaultSender: activeAddress,
      })

      const rawBurn = parseAmount(burnAmount, POOL_TOKEN_DECIMALS)

      await ammClient.send.burn({
        args: {
          poolXfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress, receiver: appAddress, assetId: poolTokenId, amount: rawBurn,
          }),
          poolAsset: poolTokenId,
          aAsset: assetA,
          bAsset: assetB,
        },
        extraFee: AlgoAmount.MicroAlgo(2_000),
      })

      enqueueSnackbar(
        `Burned ${burnAmount} LP → ~${estimated?.aOut} ${assetAName} + ~${estimated?.bOut} ${assetBName}`,
        { variant: 'success' },
      )
      setBurnAmount('')
      setEstimated(null)
      fetchReserves()
      onBurned()
    } catch (e: any) {
      enqueueSnackbar(`Error removing liquidity: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-lg">🔥 Remove Liquidity</h2>
        <p className="text-sm opacity-70">
          Burn your LP tokens to withdraw your proportional share of {assetAName} and {assetBName}.
        </p>

        <div className="form-control gap-3 mt-2">
          <div className="bg-base-300 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">LP Tokens to Burn</span>
              <span className="text-xs opacity-50">
                Total issued: {formatAmount(issued, POOL_TOKEN_DECIMALS)}
              </span>
            </div>
            <input
              type="number"
              placeholder="0.000"
              className="input input-ghost w-full text-xl font-bold p-0 focus:outline-none"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              step="any"
            />
          </div>

          {/* Estimated output */}
          {estimated && (
            <div className="bg-error/10 rounded-xl p-4">
              <div className="text-sm font-medium mb-2 opacity-70">You will receive approximately:</div>
              <div className="flex justify-between items-center">
                <span className="font-medium">{assetAName}</span>
                <span className="font-bold">{estimated.aOut}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="font-medium">{assetBName}</span>
                <span className="font-bold">{estimated.bOut}</span>
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-error w-full mt-3" onClick={handleBurn} disabled={loading || !activeAddress}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'Remove Liquidity'}
        </button>

        {/* Formula explainer */}
        <details className="mt-2">
          <summary className="text-xs opacity-50 cursor-pointer">How is withdrawal calculated?</summary>
          <div className="text-xs opacity-60 mt-2 bg-base-300 rounded-lg p-3 space-y-1">
            <p>When you burn LP tokens, you receive tokens proportional to your share:</p>
            <p className="font-mono text-center my-1">amount_out = reserve × burn_amount / total_issued</p>
            <p>For example, if you own 10% of LP tokens and the pool has 1000 of each token, you get 100 of each.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

export default BurnLiquidity
