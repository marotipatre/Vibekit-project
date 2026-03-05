# 🌊 Algorand AMM DEX — Built with VibeKit + AI Agents

A fully functional **Constant Product AMM (Automated Market Maker)** decentralized exchange on Algorand, built entirely using **VibeKit MCP tools and AI agents** — from smart contract to React frontend.

> **This project was built from a basic AlgoKit template using only natural language prompts to an AI agent (GitHub Copilot with VibeKit MCP). No manual coding required.**

![Algorand](https://img.shields.io/badge/Algorand-black?logo=algorand) ![Python](https://img.shields.io/badge/PuyaPy-3776AB?logo=python&logoColor=white) ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

---

## 🎯 What This Project Does

- **Deploy** an AMM smart contract on Algorand
- **Bootstrap** a liquidity pool with any two ASA tokens
- **Mint** LP tokens by depositing token pairs
- **Swap** tokens using the constant product formula (x × y = k) with 0.5% fee
- **Burn** LP tokens to withdraw your share of the pool
- **View** pool info, reserves, price ratios, and formula explanations

## 📐 AMM Formulas (On-Chain)

| Operation | Formula |
|-----------|---------|
| Initial Mint | `LP = √(amount_A × amount_B) - 1000` |
| Subsequent Mint | `LP = min(1000 × A_deposit / A_reserve, 1000 × B_deposit / B_reserve) × issued / 1000` |
| Swap | `output = (input × 995 × out_reserve) / (in_reserve × 1000 + input × 995)` |
| Burn | `amount_out = reserve × burn_amount / total_issued` |

---

## 🛠️ Prerequisites

Before starting, ensure you have:

1. **[AlgoKit CLI](https://github.com/algorandfoundation/algokit-cli#install)** installed
2. **[Docker](https://www.docker.com/)** installed and running (for LocalNet)
3. **[Node.js](https://nodejs.org/)** (v18+) and **pnpm**
4. **[Python](https://www.python.org/)** (3.12+)
5. **VS Code** with [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
6. **VibeKit MCP** configured in VS Code (see [VibeKit docs](https://github.com/algorandfoundation/vibekit))

---

## 🚀 Recreate This Project — Step-by-Step Prompts

Below are the exact prompts you can give to GitHub Copilot (Agent mode with VibeKit MCP) to recreate this entire project from scratch.

### Phase 1: Project Setup

#### Step 1 — Initialize the AlgoKit Template

Run this in your terminal manually:

```bash
algokit init
```

Choose:
- Template: **Official** → **Full-stack (React frontend + Python smart contract)**
- Name: your project name
- Defaults for everything else

Then open the project in VS Code.

#### Step 2 — Start LocalNet

```bash
algokit localnet start
```

---

### Phase 2: Smart Contract Development

#### Prompt 1 — Create the AMM Contract

> "Create a Constant Product AMM smart contract in Algorand Python (PuyaPy). The contract should have these methods:
> - `bootstrap` — Initialize the pool with two ASA tokens, create a pool token (LP token with 3 decimals, total supply 10 billion), opt into both assets
> - `mint` — Accept deposits of both tokens and mint LP tokens proportionally. First mint uses sqrt(a*b)-1000, subsequent mints use min ratio
> - `burn` — Accept LP tokens back and return proportional share of both assets
> - `swap` — Accept one token and return the other using constant product formula with 0.5% fee (fee=5, scale=1000)
> - `set_governor` — Allow governor to transfer admin rights
>
> Use constants: TOTAL_SUPPLY=10_000_000_000, SCALE=1000, FEE=5, FACTOR=995.
> Place it in `smart_contracts/amm/contract.py`. Look at the canonical AMM example from `algorandfoundation/puya` repo for reference."

#### Prompt 2 — Write Tests

> "Write integration tests for the AMM contract in `tests/amm_client_test.py`. Test:
> 1. Bootstrap creates pool token and sets state correctly
> 2. Initial mint with equal token amounts returns correct LP tokens
> 3. Swap sends correct output token with fee applied
> 4. Burn returns proportional assets
>
> Use pytest with AlgorandClient and the generated Python client. Create two test ASA tokens with total supply of 10,000,000 each. Make sure all tests pass."

#### Prompt 3 — Build and Verify

> "Build the smart contract using `algokit project run build`, make sure it compiles successfully, then run the tests to verify all 5 pass."

---

### Phase 3: Frontend Development

#### Prompt 4 — Create the Frontend Components

> "Create a React frontend for the AMM DEX with these components:
>
> 1. **DeployPool** — Deploy the AMM contract, show App ID and App Address
> 2. **BootstrapPool** — Enter two asset IDs (auto-sort so user doesn't need to worry about A < B ordering), send seed payment + bootstrap call, show pool token ID. Fetch and display token names as user types asset IDs.
> 3. **MintLiquidity** — Deposit both tokens, show estimated LP tokens to receive, handle opt-in to LP token, show formula explanation
> 4. **SwapTokens** — Intuitive 'You Send → You Receive' UI with direction toggle button, live swap output estimate, show pool reserves and 0.5% fee info
> 5. **BurnLiquidity** — Enter LP tokens to burn, show estimated withdrawal amounts for both tokens
> 6. **PoolInfo** — Dashboard showing reserves, price ratio, LP tokens issued, swap fee, pool ALGO balance
>
> Also create a shared `useAssetInfo` hook in `src/hooks/useAssetInfo.ts` that:
> - Fetches ASA name, unit name, and decimals by asset ID with caching
> - Exports `formatAmount(bigint, decimals)` and `parseAmount(string, decimals)` utilities
> - Exports estimation functions: `estimateMint`, `estimateBurn`, `estimateSwapOutput`
> - Exports pool token constants (TOTAL_SUPPLY, DECIMALS, SCALE, FEE, FACTOR)
>
> Use the generated TypeScript client `ConstantProductAmmClient` for all contract calls. Show token names everywhere instead of just IDs. Include formula explainer dropdowns in each component.
>
> Wire everything together in `Home.tsx` with:
> - Tabbed navigation: Setup | Swap | Liquidity | Info
> - Progress stepper showing Deploy → Initialize → Ready
> - Pool status banner with token names
> - 'Connect to Existing Pool' section that auto-fetches token info
>
> Stack: React 18, TypeScript, TailwindCSS, DaisyUI, notistack for notifications, @txnlab/use-wallet-react for wallet connection."

#### Prompt 5 — Generate TypeScript Client

> "Generate the TypeScript application client from the ARC-56 app spec at `smart_contracts/artifacts/amm/ConstantProductAMM.arc56.json` and output it to `src/contracts/ConstantProductAMM.ts` in the frontend project."

---

### Phase 4: Testing & Bug Fixes

#### Prompt 6 — Test the Full Flow

> "Start the dev server and help me test the full flow: deploy contract, create two test tokens, bootstrap pool, add liquidity, swap tokens, check pool info, and remove liquidity."

#### Prompt 7 — Fix Common Issues (if encountered)

If swap returns the **same token** instead of the other:

> "The swap is returning the same token I sent instead of the other one. Check the contract's swap method — the `in_supply`, `out_supply`, and `out_asset` assignments in the match cases might be swapped. Compare with the canonical Beaker AMM example from `algorandfoundation/beaker`."

If burn gives a **division by zero** error when removing all liquidity:

> "Burning all LP tokens gives a '/ 0' error. Check `_update_ratio()` — when the pool is emptied, `b_balance` is 0, causing division by zero. Add a guard: if b_balance > 0, compute ratio; else set ratio to 0."

If burn estimation shows **wrong amounts**:

> "The burn estimation shows wrong amounts. Check the `tokens_to_burn` function — in AVM, the asset transfer in the group executes before the app call, so `pool_balance` already includes the returned LP tokens. The formula should be `issued = TOTAL_SUPPLY - (pool_balance - amount)` not `TOTAL_SUPPLY - pool_balance - amount`."

---

## 📂 Project Structure

```
├── projects/
│   ├── vibekit_template-contracts/       # Smart contract (Python/PuyaPy)
│   │   ├── smart_contracts/
│   │   │   ├── amm/
│   │   │   │   ├── contract.py           # AMM contract (354 lines)
│   │   │   │   └── deploy_config.py
│   │   │   └── artifacts/amm/            # Compiled TEAL + ARC-56 spec
│   │   └── tests/
│   │       └── amm_client_test.py        # 5 integration tests
│   │
│   └── vibekit_template-frontend/        # React frontend
│       └── src/
│           ├── Home.tsx                  # Main page with tabs + state management
│           ├── hooks/
│           │   └── useAssetInfo.ts       # Asset info fetching, caching, formulas
│           ├── components/
│           │   ├── DeployPool.tsx         # Deploy AMM contract
│           │   ├── BootstrapPool.tsx      # Initialize pool (auto-sort assets)
│           │   ├── MintLiquidity.tsx      # Add liquidity + LP estimate
│           │   ├── SwapTokens.tsx         # Swap with direction toggle
│           │   ├── BurnLiquidity.tsx      # Remove liquidity + estimates
│           │   ├── PoolInfo.tsx           # Pool dashboard
│           │   └── ConnectWallet.tsx      # Wallet connection modal
│           └── contracts/
│               └── ConstantProductAMM.ts # Generated TypeScript client
```

## ⚡ Quick Start (After Cloning)

```bash
# 1. Install dependencies
algokit project bootstrap all

# 2. Start LocalNet
algokit localnet start

# 3. Build smart contracts
cd projects/vibekit_template-contracts
algokit project run build

# 4. Start frontend
cd ../vibekit_template-frontend
npm run dev
```

Open http://localhost:5173, connect wallet (KMD for localnet), and start trading!

## 🧪 Run Tests

```bash
cd projects/vibekit_template-contracts
poetry run pytest tests/amm_client_test.py -v
```

## 🔑 Key Learnings

1. **VibeKit MCP** provides AI agents direct access to Algorand documentation, GitHub examples, and on-chain tools
2. **PuyaPy** compiles Python to TEAL — but it's an AVM-constrained subset, not full Python
3. **AVM execution order matters** — in atomic groups, asset transfers execute before app calls, affecting balance reads
4. **Always compare with canonical examples** from `algorandfoundation/puya` and `algorandfoundation/beaker`
5. **Pool token decimals** (3 in this case) require careful `formatAmount`/`parseAmount` conversions throughout the UI

## 📜 License

This project is provided as an educational example. Do NOT deploy to mainnet without thorough security audits.

---

*Built with ❤️ using [AlgoKit](https://github.com/algorandfoundation/algokit-cli) + [VibeKit](https://www.getvibekit.ai/) + GitHub Copilot*

The frontend starter also provides an example of interactions with your HelloWorldClient in [`AppCalls.tsx`](projects/vibekit_template-frontend/src/components/AppCalls.tsx) component by default.

## Next Steps

You can take this project and customize it to build your own decentralized applications on Algorand. Make sure to understand how to use AlgoKit and how to write smart contracts for Algorand before you start.
