// src/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import BootstrapPool from './components/BootstrapPool'
import BurnLiquidity from './components/BurnLiquidity'
import ConnectWallet from './components/ConnectWallet'
import DeployPool from './components/DeployPool'
import MintLiquidity from './components/MintLiquidity'
import PoolInfo from './components/PoolInfo'
import SwapTokens from './components/SwapTokens'
import { fetchAssetInfo } from './hooks/useAssetInfo'

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
  const [existingAppAddr, setExistingAppAddr] = useState('')
  const [existingAssetA, setExistingAssetA] = useState('')
  const [existingAssetB, setExistingAssetB] = useState('')
  const [existingPoolToken, setExistingPoolToken] = useState('')
  const [connectLoading, setConnectLoading] = useState(false)

  const handleConnectExisting = async () => {
    if (!existingAppId || !existingAppAddr || !existingAssetA || !existingAssetB || !existingPoolToken) return
    setConnectLoading(true)
    try {
      const aId = BigInt(existingAssetA)
      const bId = BigInt(existingAssetB)
      const [infoA, infoB] = await Promise.all([
        fetchAssetInfo(aId).catch(() => null),
        fetchAssetInfo(bId).catch(() => null),
      ])
      setAppId(BigInt(existingAppId))
      setAppAddress(existingAppAddr)
      setAssetA(aId)
      setAssetB(bId)
      setPoolTokenId(BigInt(existingPoolToken))
      setAssetAName(infoA ? (infoA.unitName || infoA.name) : `Asset #${aId}`)
      setAssetBName(infoB ? (infoB.unitName || infoB.name) : `Asset #${bId}`)
      setAssetADecimals(infoA?.decimals ?? 0)
      setAssetBDecimals(infoB?.decimals ?? 0)
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
                  Already deployed a pool? Enter the details below. Token names and decimals will be fetched automatically.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="App ID" className="input input-bordered input-sm"
                    value={existingAppId} onChange={(e) => setExistingAppId(e.target.value)} />
                  <input type="text" placeholder="App Address" className="input input-bordered input-sm"
                    value={existingAppAddr} onChange={(e) => setExistingAppAddr(e.target.value)} />
                  <input type="number" placeholder="Asset A ID" className="input input-bordered input-sm"
                    value={existingAssetA} onChange={(e) => setExistingAssetA(e.target.value)} />
                  <input type="number" placeholder="Asset B ID" className="input input-bordered input-sm"
                    value={existingAssetB} onChange={(e) => setExistingAssetB(e.target.value)} />
                  <input type="number" placeholder="Pool Token ID" className="input input-bordered input-sm col-span-2"
                    value={existingPoolToken} onChange={(e) => setExistingPoolToken(e.target.value)} />
                </div>
                <div className="card-actions justify-end mt-2">
                  <button className="btn btn-outline btn-sm" onClick={handleConnectExisting} disabled={connectLoading}>
                    {connectLoading ? <span className="loading loading-spinner loading-xs" /> : 'Connect'}
                  </button>
                </div>
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
