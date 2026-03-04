import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConstantProductAmmClient } from '../contracts/ConstantProductAMM'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { estimateMint, formatAmount, parseAmount, POOL_TOKEN_DECIMALS, POOL_TOKEN_TOTAL_SUPPLY, SCALE } from '../hooks/useAssetInfo'

interface MintLiquidityProps {
  appId: bigint
  appAddress: string
  assetA: bigint
  assetB: bigint
  assetAName: string
  assetBName: string
  assetADecimals: number
  assetBDecimals: number
  poolTokenId: bigint
  onMinted: () => void
}

const MintLiquidity = ({
  appId, appAddress, assetA, assetB,
  assetAName, assetBName, assetADecimals, assetBDecimals,
  poolTokenId, onMinted,
}: MintLiquidityProps) => {
  const [loading, setLoading] = useState(false)
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [reserveA, setReserveA] = useState(0n)
  const [reserveB, setReserveB] = useState(0n)
  const [poolBalance, setPoolBalance] = useState(0n)
  const [estimatedLP, setEstimatedLP] = useState('')
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const signerRef = useRef(transactionSigner)
  signerRef.current = transactionSigner

  // Fetch pool reserves
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

  // Estimate LP tokens
  useEffect(() => {
    const aRaw = amountA ? parseAmount(amountA, assetADecimals) : 0n
    const bRaw = amountB ? parseAmount(amountB, assetBDecimals) : 0n
    if (aRaw <= 0n || bRaw <= 0n) { setEstimatedLP(''); return }
    const lp = estimateMint(poolBalance, reserveA, reserveB, aRaw, bRaw)
    setEstimatedLP(formatAmount(lp, POOL_TOKEN_DECIMALS))
  }, [amountA, amountB, reserveA, reserveB, poolBalance, assetADecimals, assetBDecimals])

  const isInitialMint = reserveA === 0n && reserveB === 0n

  const handleOptInPoolToken = async () => {
    if (!activeAddress) return
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)
      await algorand.send.assetOptIn({ sender: activeAddress, assetId: poolTokenId })
      enqueueSnackbar('Opted into LP token!', { variant: 'success' })
    } catch (e: any) {
      enqueueSnackbar(`Error opting in: ${e.message}`, { variant: 'error' })
    }
  }

  const handleMint = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }
    if (!amountA || !amountB) {
      enqueueSnackbar('Please enter amounts for both tokens', { variant: 'warning' })
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

      const rawA = parseAmount(amountA, assetADecimals)
      const rawB = parseAmount(amountB, assetBDecimals)

      await ammClient.send.mint({
        args: {
          aXfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress, receiver: appAddress, assetId: assetA, amount: rawA,
          }),
          bXfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress, receiver: appAddress, assetId: assetB, amount: rawB,
          }),
          poolAsset: poolTokenId,
          aAsset: assetA,
          bAsset: assetB,
        },
        extraFee: AlgoAmount.MicroAlgo(1_000),
      })

      enqueueSnackbar(
        `Added ${amountA} ${assetAName} + ${amountB} ${assetBName} → ~${estimatedLP} LP tokens`,
        { variant: 'success' },
      )
      setAmountA('')
      setAmountB('')
      fetchReserves()
      onMinted()
    } catch (e: any) {
      enqueueSnackbar(`Error adding liquidity: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const issued = POOL_TOKEN_TOTAL_SUPPLY - poolBalance

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-lg">💧 Add Liquidity</h2>
        <p className="text-sm opacity-70">
          {isInitialMint
            ? 'This is the initial deposit. You set the price ratio for this pool.'
            : 'Deposit both tokens proportionally to receive LP tokens.'}
        </p>

        <div className="form-control gap-3 mt-2">
          {/* Token A */}
          <div className="bg-base-300 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">{assetAName}</span>
              <span className="text-xs opacity-50">ID: {assetA.toString()}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="input input-ghost w-full text-xl font-bold p-0 focus:outline-none"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              step="any"
            />
            {!isInitialMint && reserveA > 0n && (
              <div className="text-xs opacity-50 mt-1">
                Pool balance: {formatAmount(reserveA, assetADecimals)}
              </div>
            )}
          </div>

          <div className="flex justify-center text-lg opacity-40">+</div>

          {/* Token B */}
          <div className="bg-base-300 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">{assetBName}</span>
              <span className="text-xs opacity-50">ID: {assetB.toString()}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="input input-ghost w-full text-xl font-bold p-0 focus:outline-none"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              step="any"
            />
            {!isInitialMint && reserveB > 0n && (
              <div className="text-xs opacity-50 mt-1">
                Pool balance: {formatAmount(reserveB, assetBDecimals)}
              </div>
            )}
          </div>
        </div>

        {/* LP estimate */}
        {estimatedLP && (
          <div className="bg-primary/10 rounded-lg p-3 mt-2 text-sm">
            <span className="opacity-70">You will receive approximately </span>
            <strong>{estimatedLP}</strong>
            <span className="opacity-70"> LP tokens</span>
            {!isInitialMint && issued > 0n && (
              <span className="opacity-50 text-xs ml-1">
                (Total issued: {formatAmount(issued, POOL_TOKEN_DECIMALS)})
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button className="btn btn-outline btn-sm flex-1" onClick={handleOptInPoolToken} disabled={!activeAddress}>
            1. Opt-In LP Token
          </button>
          <button className="btn btn-primary flex-1" onClick={handleMint} disabled={loading || !activeAddress}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : '2. Add Liquidity'}
          </button>
        </div>

        {/* Formula explainer */}
        <details className="mt-2">
          <summary className="text-xs opacity-50 cursor-pointer">How are LP tokens calculated?</summary>
          <div className="text-xs opacity-60 mt-2 bg-base-300 rounded-lg p-3 space-y-1">
            <p><strong>Initial deposit:</strong></p>
            <p className="font-mono text-center">LP = √(amount_A × amount_B) - 1,000</p>
            <p className="mt-1">The 1,000 is burned to prevent rounding attacks. Pool token has <strong>3 decimals</strong>, so 1,000 raw = 1.000 LP token burned.</p>
            <p className="mt-2"><strong>Subsequent deposits:</strong></p>
            <p className="font-mono text-center">LP = min(a_ratio, b_ratio) × issued / 1000</p>
            <p>where ratio = 1000 × your_deposit / pool_balance. You get LP proportional to the smaller of the two deposit ratios.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

export default MintLiquidity
