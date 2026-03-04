import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { ConstantProductAmmClient } from '../contracts/ConstantProductAMM'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { useAssetInfo, fetchAssetInfo } from '../hooks/useAssetInfo'

interface BootstrapPoolProps {
  appId: bigint
  appAddress: string
  onBootstrapped: (poolTokenId: bigint, assetA: bigint, assetB: bigint, assetAName: string, assetBName: string) => void
}

const BootstrapPool = ({ appId, appAddress, onBootstrapped }: BootstrapPoolProps) => {
  const [loading, setLoading] = useState(false)
  const [tokenOneId, setTokenOneId] = useState('')
  const [tokenTwoId, setTokenTwoId] = useState('')
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  // Fetch asset info for live preview
  const ids = [
    tokenOneId ? BigInt(tokenOneId) : null,
    tokenTwoId ? BigInt(tokenTwoId) : null,
  ]
  const { getLabel } = useAssetInfo(ids)

  const handleBootstrap = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }
    if (!tokenOneId || !tokenTwoId) {
      enqueueSnackbar('Please enter both token IDs', { variant: 'warning' })
      return
    }
    if (tokenOneId === tokenTwoId) {
      enqueueSnackbar('Token IDs must be different', { variant: 'error' })
      return
    }

    // Auto-sort: contract requires asset_a.id < asset_b.id
    const id1 = BigInt(tokenOneId)
    const id2 = BigInt(tokenTwoId)
    const aId = id1 < id2 ? id1 : id2
    const bId = id1 < id2 ? id2 : id1

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const ammClient = new ConstantProductAmmClient({
        appId,
        algorand,
        defaultSender: activeAddress,
      })

      const result = await ammClient.send.bootstrap({
        args: {
          seed: algorand.createTransaction.payment({
            sender: activeAddress,
            receiver: appAddress,
            amount: AlgoAmount.MicroAlgo(300_000),
          }),
          aAsset: aId,
          bAsset: bId,
        },
        extraFee: AlgoAmount.MicroAlgo(3_000),
      })

      const poolTokenId = result.return
      if (poolTokenId !== undefined) {
        const [infoA, infoB] = await Promise.all([
          fetchAssetInfo(aId).catch(() => null),
          fetchAssetInfo(bId).catch(() => null),
        ])
        const nameA = infoA ? (infoA.unitName || infoA.name) : `Asset #${aId}`
        const nameB = infoB ? (infoB.unitName || infoB.name) : `Asset #${bId}`

        enqueueSnackbar(`Pool created! ${nameA} / ${nameB} — Pool Token ID: ${poolTokenId}`, { variant: 'success' })
        onBootstrapped(poolTokenId, aId, bId, nameA, nameB)
      }
    } catch (e: any) {
      enqueueSnackbar(`Error bootstrapping: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-lg">⚡ Initialize Pool</h2>
        <p className="text-sm opacity-70">
          Enter the IDs of the two tokens you want to create a liquidity pool for.
          They can be in any order — the system will sort them automatically.
        </p>

        <div className="form-control gap-3 mt-2">
          <div>
            <label className="label pb-1">
              <span className="label-text font-medium">First Token ID</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 1180"
              className="input input-bordered w-full"
              value={tokenOneId}
              onChange={(e) => setTokenOneId(e.target.value)}
            />
            {tokenOneId && (
              <label className="label pt-1">
                <span className="label-text-alt text-info">{getLabel(BigInt(tokenOneId))}</span>
              </label>
            )}
          </div>

          <div>
            <label className="label pb-1">
              <span className="label-text font-medium">Second Token ID</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 1181"
              className="input input-bordered w-full"
              value={tokenTwoId}
              onChange={(e) => setTokenTwoId(e.target.value)}
            />
            {tokenTwoId && (
              <label className="label pt-1">
                <span className="label-text-alt text-info">{getLabel(BigInt(tokenTwoId))}</span>
              </label>
            )}
          </div>
        </div>

        <div className="bg-base-300 rounded-lg p-3 mt-2 text-xs opacity-80">
          <strong>💡 Tip:</strong> Make sure both tokens have enough supply. The initial deposit needs{' '}
          <code className="bg-base-100 px-1 rounded">√(amount_A × amount_B) &gt; 1,000</code> to succeed.
        </div>

        <div className="card-actions justify-end mt-3">
          <button className="btn btn-primary" onClick={handleBootstrap} disabled={loading || !activeAddress}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : 'Create Pool'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BootstrapPool
