import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { ConstantProductAmmFactory } from '../contracts/ConstantProductAMM'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

interface DeployPoolProps {
  onDeployed: (appId: bigint, appAddress: string) => void
}

const DeployPool = ({ onDeployed }: DeployPoolProps) => {
  const [loading, setLoading] = useState(false)
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const handleDeploy = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const factory = new ConstantProductAmmFactory({
        defaultSender: activeAddress,
        algorand,
      })

      // Create a fresh instance (bare create)
      const { appClient } = await factory.send.create.bare()

      // Fund the app account so it can do inner transactions
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appClient.appAddress,
        amount: AlgoAmount.Algo(1),
      })

      enqueueSnackbar(`Pool contract deployed! App ID: ${appClient.appId}`, { variant: 'success' })
      onDeployed(appClient.appId, String(appClient.appAddress))
    } catch (e: any) {
      enqueueSnackbar(`Error deploying pool: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-lg">🚀 Deploy Pool Contract</h2>
        <p className="text-sm opacity-70">
          Deploy a new AMM pool contract. This creates the smart contract on-chain.
        </p>
        <div className="card-actions justify-end mt-2">
          <button className="btn btn-primary" onClick={handleDeploy} disabled={loading || !activeAddress}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : 'Deploy Pool'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeployPool
