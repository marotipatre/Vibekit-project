import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConstantProductAmmClient } from '../contracts/ConstantProductAMM'
import { estimateSwapOutput, FEE, formatAmount, parseAmount, SCALE } from '../hooks/useAssetInfo'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

interface SwapTokensProps {
  appId: bigint
  appAddress: string
  assetA: bigint
  assetB: bigint
  assetAName: string
  assetBName: string
  assetADecimals: number
  assetBDecimals: number
  onSwapped: () => void
}

const SwapTokens = ({
  appId, appAddress, assetA, assetB,
  assetAName, assetBName, assetADecimals, assetBDecimals,
  onSwapped,
}: SwapTokensProps) => {
  const [loading, setLoading] = useState(false)
  const [sendAmount, setSendAmount] = useState('')
  const [direction, setDirection] = useState<'AtoB' | 'BtoA'>('AtoB')
  const [estimatedOutput, setEstimatedOutput] = useState<string>('')
  const [reserveA, setReserveA] = useState(0n)
  const [reserveB, setReserveB] = useState(0n)
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const signerRef = useRef(transactionSigner)
  signerRef.current = transactionSigner

  const sendAsset = direction === 'AtoB' ? assetA : assetB
  const receiveAsset = direction === 'AtoB' ? assetB : assetA
  const sendName = direction === 'AtoB' ? assetAName : assetBName
  const receiveName = direction === 'AtoB' ? assetBName : assetAName
  const sendDecimals = direction === 'AtoB' ? assetADecimals : assetBDecimals
  const receiveDecimals = direction === 'AtoB' ? assetBDecimals : assetADecimals

  // Fetch reserves for estimation
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
          if (BigInt(a.assetId) === assetA) setReserveA(BigInt(a.amount))
          if (BigInt(a.assetId) === assetB) setReserveB(BigInt(a.amount))
        }
      }
    } catch { /* silent */ }
  }, [activeAddress, appAddress, assetA, assetB])

  useEffect(() => { fetchReserves() }, [fetchReserves])

  // Estimate output when input changes
  useEffect(() => {
    if (!sendAmount || Number(sendAmount) <= 0) {
      setEstimatedOutput('')
      return
    }
    const inAmountRaw = parseAmount(sendAmount, sendDecimals)
    // in_supply = balance of the token we're sending INTO the pool (post-transfer, add our amount)
    // out_supply = balance of the token we'll RECEIVE from the pool
    const inSupply = (direction === 'AtoB' ? reserveA : reserveB) + inAmountRaw
    const outSupply = direction === 'AtoB' ? reserveB : reserveA
    if (inSupply <= 0n || outSupply <= 0n) {
      setEstimatedOutput('Pool has no liquidity')
      return
    }
    const outRaw = estimateSwapOutput(inAmountRaw, inSupply, outSupply)
    setEstimatedOutput(formatAmount(outRaw, receiveDecimals))
  }, [sendAmount, direction, reserveA, reserveB, sendDecimals, receiveDecimals])

  const handleOptIn = async (assetId: bigint, name: string) => {
    if (!activeAddress) return
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)
      await algorand.send.assetOptIn({ sender: activeAddress, assetId })
      enqueueSnackbar(`Opted into ${name}!`, { variant: 'success' })
    } catch (e: any) {
      enqueueSnackbar(`Error: ${e.message}`, { variant: 'error' })
    }
  }

  const handleSwap = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }
    if (!sendAmount || Number(sendAmount) <= 0) {
      enqueueSnackbar('Please enter an amount', { variant: 'warning' })
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

      const rawAmount = parseAmount(sendAmount, sendDecimals)

      await ammClient.send.swap({
        args: {
          swapXfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress,
            receiver: appAddress,
            assetId: sendAsset,
            amount: rawAmount,
          }),
          aAsset: assetA,
          bAsset: assetB,
        },
        extraFee: AlgoAmount.MicroAlgo(1_000),
      })

      enqueueSnackbar(
        `Swapped ${sendAmount} ${sendName} → ${estimatedOutput} ${receiveName}`,
        { variant: 'success' },
      )
      setSendAmount('')
      setEstimatedOutput('')
      fetchReserves()
      onSwapped()
    } catch (e: any) {
      enqueueSnackbar(`Error swapping: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const feePercent = (Number(FEE) / Number(SCALE) * 100).toFixed(1)

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-lg">🔄 Swap Tokens</h2>

        {/* Opt-in buttons */}
        <div className="flex gap-2 mb-2">
          <button className="btn btn-outline btn-xs" onClick={() => handleOptIn(assetA, assetAName)} disabled={!activeAddress}>
            Opt-In {assetAName}
          </button>
          <button className="btn btn-outline btn-xs" onClick={() => handleOptIn(assetB, assetBName)} disabled={!activeAddress}>
            Opt-In {assetBName}
          </button>
        </div>

        {/* Send section */}
        <div className="bg-base-300 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium opacity-70">You Send</span>
            <span className="badge badge-sm">{sendName}</span>
          </div>
          <input
            type="number"
            placeholder="0.00"
            className="input input-ghost w-full text-2xl font-bold p-0 focus:outline-none"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            step="any"
          />
        </div>

        {/* Direction toggle */}
        <div className="flex justify-center -my-2 z-10">
          <button
            className="btn btn-circle btn-sm btn-primary"
            onClick={() => {
              setDirection(d => d === 'AtoB' ? 'BtoA' : 'AtoB')
              setSendAmount('')
              setEstimatedOutput('')
            }}
            title="Switch direction"
          >
            ↕
          </button>
        </div>

        {/* Receive section */}
        <div className="bg-base-300 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium opacity-70">You Receive (estimated)</span>
            <span className="badge badge-sm">{receiveName}</span>
          </div>
          <div className="text-2xl font-bold opacity-80">
            {estimatedOutput || '0.00'}
          </div>
        </div>

        {/* Info row */}
        {reserveA > 0n && reserveB > 0n && (
          <div className="text-xs opacity-60 mt-1 space-y-1">
            <div className="flex justify-between">
              <span>Swap Fee</span>
              <span>{feePercent}%</span>
            </div>
            <div className="flex justify-between">
              <span>Pool Reserves</span>
              <span>{formatAmount(reserveA, assetADecimals)} {assetAName} / {formatAmount(reserveB, assetBDecimals)} {assetBName}</span>
            </div>
          </div>
        )}

        <button className="btn btn-primary w-full mt-3" onClick={handleSwap} disabled={loading || !activeAddress}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : `Swap ${sendName} → ${receiveName}`}
        </button>

        {/* Formula explainer */}
        <details className="mt-2">
          <summary className="text-xs opacity-50 cursor-pointer">How does the swap work?</summary>
          <div className="text-xs opacity-60 mt-2 bg-base-300 rounded-lg p-3 space-y-1">
            <p>This AMM uses the <strong>Constant Product</strong> formula (like Uniswap v2):</p>
            <p className="font-mono text-center my-1">x × y = k</p>
            <p>When you swap, a <strong>{feePercent}% fee</strong> is deducted from your input:</p>
            <p className="font-mono text-center my-1">output = (input × 995 × out_reserve) / (in_reserve × 1000 + input × 995)</p>
            <p>Where <code>in_reserve</code> and <code>out_reserve</code> are the pool balances <em>before</em> your swap. The fee stays in the pool, benefiting liquidity providers.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

export default SwapTokens
