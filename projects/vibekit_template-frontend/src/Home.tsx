// src/Home.tsx
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { getApplicationAddress } from 'algosdk'
import React, { useState } from 'react'
import BootstrapPool from './components/BootstrapPool'
import BurnLiquidity from './components/BurnLiquidity'
import ConnectWallet from './components/ConnectWallet'
import DeployPool from './components/DeployPool'
import MintLiquidity from './components/MintLiquidity'
import PoolInfo from './components/PoolInfo'
import SwapTokens from './components/SwapTokens'
import { ConstantProductAmmClient } from './contracts/ConstantProductAMM'
import { fetchAssetInfo } from './hooks/useAssetInfo'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

type Tab = 'deploy' | 'swap' | 'liquidity' | 'info'

const Home: React.FC = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('deploy')

  // Pool state
  const [appId, setAppId] = useState<bigint | null>(null)
  const [appAddress, setAppAddress] = useState('')
  const [poolTokenId, setPoolTokenId] = useState<bigint | null>(null)
  const [assetA, setAssetA] = useState<bigint | null>(null)
  const [assetB, setAssetB] = useState<bigint | null>(null)
  const [assetAName, setAssetAName] = useState('')
  const [assetBName, setAssetBName] = useState('')
  const [assetADecimals, setAssetADecimals] = useState(0)
  const [assetBDecimals, setAssetBDecimals] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const { activeAddress } = useWallet()

  const toggleWalletModal = () => setOpenWalletModal(!openWalletModal)
  const refresh = () => setRefreshKey((k) => k + 1)

  const isPoolReady =
    appId !== null && appAddress !== '' &&
    poolTokenId !== null && assetA !== null && assetB !== null

  // Connect to existing pool
  const [existingAppId, setExistingAppId] = useState('')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState('')

  const handleConnectExisting = async () => {
    if (!existingAppId) return
    setConnectLoading(true)
    setConnectError('')
    try {
      const numericAppId = BigInt(existingAppId)

      // Derive app address from App ID
      const derivedAppAddress = getApplicationAddress(numericAppId)

      // Create a client to read global state
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })

      const client = new ConstantProductAmmClient({
        appId: numericAppId,
        algorand,
      })

      // Read all global state from the contract
      const globalState = await client.state.global.getAll()

      if (!globalState.assetA || !globalState.assetB || !globalState.poolToken) {
        setConnectError('Pool not bootstrapped yet — asset_a, asset_b, or pool_token missing.')
        return
      }

      const aId = globalState.assetA
      const bId = globalState.assetB
      const ptId = globalState.poolToken

      // Fetch asset info (names, decimals)
      const [infoA, infoB] = await Promise.all([
        fetchAssetInfo(aId).catch(() => null),
        fetchAssetInfo(bId).catch(() => null),
      ])

      setAppId(numericAppId)
      setAppAddress(String(derivedAppAddress))
      setAssetA(aId)
      setAssetB(bId)
      setPoolTokenId(ptId)
      setAssetAName(infoA ? (infoA.unitName || infoA.name) : `Asset #${aId}`)
      setAssetBName(infoB ? (infoB.unitName || infoB.name) : `Asset #${bId}`)
      setAssetADecimals(infoA?.decimals ?? 0)
      setAssetBDecimals(infoB?.decimals ?? 0)
    } catch (e: any) {
      setConnectError(e.message || 'Failed to connect to pool')
    } finally {
      setConnectLoading(false)
    }
  }

  // Step indicator
  const currentStep = !appId ? 1 : !poolTokenId ? 2 : 3

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="text-xl font-bold px-4">🌊 Algorand AMM DEX</span>
        </div>
        <div className="flex-none gap-2">
          {activeAddress && (
            <span className="badge badge-outline font-mono text-xs">
              {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={toggleWalletModal}>
            {activeAddress ? 'Wallet' : 'Connect Wallet'}
          </button>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl p-4 mt-4">
        {!activeAddress && (
          <div className="alert alert-info mb-6">
            <span>👆 Connect your wallet to get started with the AMM DEX.</span>
          </div>
        )}

        {/* Progress steps */}
        {activeAddress && !isPoolReady && (
          <ul className="steps steps-horizontal w-full mb-6">
            <li className={`step ${currentStep >= 1 ? 'step-primary' : ''}`}>Deploy Contract</li>
            <li className={`step ${currentStep >= 2 ? 'step-primary' : ''}`}>Initialize Pool</li>
            <li className={`step ${currentStep >= 3 ? 'step-primary' : ''}`}>Ready to Trade</li>
          </ul>
        )}

        {/* Tabs */}
        <div className="tabs tabs-boxed mb-6 justify-center">
          <a className={`tab ${activeTab === 'deploy' ? 'tab-active' : ''}`} onClick={() => setActiveTab('deploy')}>
            🚀 Setup
          </a>
          <a
            className={`tab ${activeTab === 'swap' ? 'tab-active' : ''} ${!isPoolReady ? 'tab-disabled opacity-50' : ''}`}
            onClick={() => isPoolReady && setActiveTab('swap')}
          >
            🔄 Swap
          </a>
          <a
            className={`tab ${activeTab === 'liquidity' ? 'tab-active' : ''} ${!isPoolReady ? 'tab-disabled opacity-50' : ''}`}
            onClick={() => isPoolReady && setActiveTab('liquidity')}
          >
            💧 Liquidity
          </a>
          <a
            className={`tab ${activeTab === 'info' ? 'tab-active' : ''} ${!isPoolReady ? 'tab-disabled opacity-50' : ''}`}
            onClick={() => isPoolReady && setActiveTab('info')}
          >
            📊 Info
          </a>
        </div>

        {/* Pool status banner */}
        {isPoolReady && (
          <div className="alert alert-success mb-4 text-sm">
            <div className="flex flex-col gap-1">
              <span>
                <strong>{assetAName} / {assetBName} Pool</strong> — App ID: <span className="font-mono">{appId.toString()}</span>
              </span>
              <span className="opacity-70 text-xs">
                Pool Token ID: {poolTokenId.toString()} • {assetAName} ID: {assetA.toString()} • {assetBName} ID: {assetB.toString()}
              </span>
            </div>
          </div>
        )}

        {/* ═══════ SETUP TAB ═══════ */}
        {activeTab === 'deploy' && (
          <div className="flex flex-col gap-6">
            <DeployPool
              onDeployed={(id, addr) => {
                setAppId(id)
                setAppAddress(addr)
                setActiveTab('deploy') // stay on setup
              }}
            />

            {appId !== null && poolTokenId === null && (
              <BootstrapPool
                appId={appId}
                appAddress={appAddress}
                onBootstrapped={async (pt, a, b, aName, bName) => {
                  setPoolTokenId(pt)
                  setAssetA(a)
                  setAssetB(b)
                  setAssetAName(aName)
                  setAssetBName(bName)
                  // Fetch decimals
                  const [infoA, infoB] = await Promise.all([
                    fetchAssetInfo(a).catch(() => null),
                    fetchAssetInfo(b).catch(() => null),
                  ])
                  setAssetADecimals(infoA?.decimals ?? 0)
                  setAssetBDecimals(infoB?.decimals ?? 0)
                }}
              />
            )}

            {isPoolReady && (
              <div className="alert alert-success">
                <span>✅ Pool is ready! Use the <strong>Swap</strong> and <strong>Liquidity</strong> tabs to start trading.</span>
              </div>
            )}

            {/* Connect to existing */}
            <div className="divider text-xs opacity-50">OR CONNECT TO EXISTING POOL</div>
            <div className="card bg-base-200 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-lg">🔗 Connect to Existing Pool</h2>
                <p className="text-sm opacity-70">
                  Already deployed a pool? Just enter the App ID — everything else is fetched automatically from the contract.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Enter App ID"
                    className="input input-bordered input-sm flex-1"
                    value={existingAppId}
                    onChange={(e) => setExistingAppId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnectExisting()}
                  />
                  <button className="btn btn-outline btn-sm" onClick={handleConnectExisting} disabled={connectLoading || !existingAppId}>
                    {connectLoading ? <span className="loading loading-spinner loading-xs" /> : '🔗 Connect'}
                  </button>
                </div>
                {connectError && (
                  <div className="alert alert-error text-sm mt-2 py-2">
                    <span>❌ {connectError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ SWAP TAB ═══════ */}
        {activeTab === 'swap' && isPoolReady && (
          <SwapTokens
            appId={appId} appAddress={appAddress}
            assetA={assetA} assetB={assetB}
            assetAName={assetAName} assetBName={assetBName}
            assetADecimals={assetADecimals} assetBDecimals={assetBDecimals}
            onSwapped={refresh}
          />
        )}

        {/* ═══════ LIQUIDITY TAB ═══════ */}
        {activeTab === 'liquidity' && isPoolReady && (
          <div className="flex flex-col gap-6">
            <MintLiquidity
              appId={appId} appAddress={appAddress}
              assetA={assetA} assetB={assetB}
              assetAName={assetAName} assetBName={assetBName}
              assetADecimals={assetADecimals} assetBDecimals={assetBDecimals}
              poolTokenId={poolTokenId}
              onMinted={refresh}
            />
            <BurnLiquidity
              appId={appId} appAddress={appAddress}
              assetA={assetA} assetB={assetB}
              assetAName={assetAName} assetBName={assetBName}
              assetADecimals={assetADecimals} assetBDecimals={assetBDecimals}
              poolTokenId={poolTokenId}
              onBurned={refresh}
            />
          </div>
        )}

        {/* ═══════ INFO TAB ═══════ */}
        {activeTab === 'info' && isPoolReady && (
          <PoolInfo
            key={refreshKey} appId={appId} appAddress={appAddress}
            assetAName={assetAName} assetBName={assetBName}
            assetADecimals={assetADecimals} assetBDecimals={assetBDecimals}
          />
        )}
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
