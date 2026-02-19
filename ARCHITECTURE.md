# Gasless Transactions POC — Architecture Documentation

## Overview

This POC demonstrates **gasless (sponsored) transactions** on **Base Sepolia** using Alchemy's Account Kit. It supports **two wallet paths** — Alchemy Embedded Wallets and External Wallets (MetaMask) — both of which get smart accounts with gas-sponsored transactions.

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (App Router)                   │
│                                                                        │
│  ┌──────────────────┐       ┌──────────────────────────────────────┐   │
│  │   Auth Modal      │       │   UnifiedWalletProvider (Context)    │   │
│  │  (Account Kit UI) │       │   - Detects connection type          │   │
│  │                   │       │   - Manages both wallet paths        │   │
│  │  • Email          │       │   - Exposes unified API:             │   │
│  │  • Passkey        │──────▶│     signMessage()                    │   │
│  │  • Google OAuth   │       │     sendGaslessTransaction()         │   │
│  │  • MetaMask / WC  │       │     smartAccountAddress              │   │
│  └──────────────────┘       └──────────┬───────────────────────────┘   │
│                                         │                              │
│                          ┌──────────────┴──────────────┐               │
│                          │                             │               │
│                    ┌─────▼─────┐              ┌────────▼────────┐      │
│                    │ EMBEDDED  │              │   EOA PATH      │      │
│                    │  PATH     │              │   (MetaMask)    │      │
│                    │           │              │                 │      │
│                    │ ERC-4337  │              │  EIP-7702       │      │
│                    │ UserOps   │              │  Delegation     │      │
│                    └─────┬─────┘              └────────┬────────┘      │
│                          │                             │               │
└──────────────────────────┼─────────────────────────────┼───────────────┘
                           │                             │
                    ┌──────▼──────┐              ┌───────▼───────┐
                    │  Alchemy    │              │   Alchemy     │
                    │  Bundler    │              │   Wallet API  │
                    │  (ERC-4337) │              │  (EIP-5792)   │
                    └──────┬──────┘              └───────┬───────┘
                           │                             │
                    ┌──────▼──────┐              ┌───────▼───────┐
                    │  Alchemy    │              │   Alchemy     │
                    │  Gas Manager│              │   Gas Manager │
                    │ (Paymaster) │              │  (Paymaster)  │
                    └──────┬──────┘              └───────┬───────┘
                           │                             │
                           └─────────────┬───────────────┘
                                         │
                                  ┌──────▼──────┐
                                  │ Base Sepolia│
                                  │  (L2 Chain) │
                                  └─────────────┘
```

---

## Two Wallet Paths Explained

### Path 1 — Embedded Wallet (ERC-4337)

**Auth Methods**: Email, Passkey, Google OAuth

**How it works**:

1. **User authenticates** via Alchemy's Auth Modal (email OTP, passkey, or Google popup)
2. **Alchemy creates an embedded signer** — a key pair managed by Alchemy's infrastructure, secured via the user's auth factor (email, passkey, biometrics)
3. **A Modular Account v2 (smart contract account)** is deployed counterfactually on Base Sepolia. This is an **ERC-4337 compliant** smart account
4. **Transactions are sent as UserOperations** — not regular Ethereum transactions. The `useSendUserOperation` hook constructs a UserOp containing the contract call
5. **The Alchemy Gas Manager (Paymaster)** intercepts the UserOp and sponsors the gas. The user pays $0
6. **The Alchemy Bundler** picks up the UserOp, wraps it into a regular transaction, and submits it on-chain
7. **The smart account executes** the call (e.g., `mintAndList`) on behalf of the user

**Key packages**: `@account-kit/react` (useSmartAccountClient, useSendUserOperation, useSignerStatus, useUser)

**Account Standard**: ERC-4337 (Account Abstraction via alt mempool)

```
User → Email/Passkey/Google
  → Alchemy Embedded Signer (manages keys)
    → Modular Account v2 (ERC-4337 Smart Contract Account)
      → UserOperation { sender, callData, ... }
        → Alchemy Paymaster (sponsors gas)
          → Alchemy Bundler (submits on-chain)
            → Base Sepolia
```

### Path 2 — External Wallet / EOA (EIP-7702)

**Auth Methods**: MetaMask, WalletConnect, any injected wallet

**How it works**:

1. **User connects MetaMask** via the Auth Modal's "External Wallets" section
2. **wagmi detects the EOA** connection (`useAccount`, `useWalletClient` from wagmi)
3. **We wrap the MetaMask WalletClient** as a `WalletClientSigner` (from `@aa-sdk/core`) — this adapts the EOA into a signer compatible with Alchemy's smart wallet infrastructure
4. **A SmartWalletClient is created** using `createSmartWalletClient` from `@account-kit/wallet-client`. This uses Alchemy's **Wallet API** which follows **EIP-5792** (`wallet_sendCalls`)
5. **EIP-7702 delegation occurs**: The first transaction triggers the EOA to delegate execution to a smart wallet implementation. After delegation, the EOA address itself behaves as a smart wallet — **same address, new capabilities**
6. **Gas sponsorship** is applied via `capabilities.paymasterService.policyId` in the `sendCalls` request
7. **The Alchemy Wallet API** handles the rest: prepares the calls, applies the paymaster, and submits the transaction

**Key packages**: `@account-kit/wallet-client` (createSmartWalletClient), `@aa-sdk/core` (WalletClientSigner), `wagmi` (useAccount, useWalletClient)

**Account Standard**: EIP-7702 (EOA delegation to smart wallet code)

```
User → MetaMask (EOA)
  → WalletClientSigner (wraps WalletClient)
    → SmartWalletClient (Wallet API)
      → requestAccount() — creates/retrieves smart account
      → sendCalls({ calls, capabilities.paymasterService })
        → EIP-7702 delegation (EOA → Smart Wallet impl)
          → Alchemy Wallet API (prepares + sponsors + submits)
            → Base Sepolia
```

---

## ERC-4337 vs EIP-7702 — Key Differences

| Feature | ERC-4337 (Embedded) | EIP-7702 (EOA/MetaMask) |
|---|---|---|
| **Account Type** | New smart contract account (different address from signer) | EOA itself becomes smart (same address) |
| **Address** | Counterfactual SCA address | MetaMask EOA address = smart account address |
| **Transaction Format** | UserOperation (alt mempool) | Regular transaction with delegation |
| **Gas Sponsorship** | Paymaster in UserOp | PaymasterService capability in sendCalls |
| **Infrastructure** | Bundler + EntryPoint + Paymaster | Wallet API + Paymaster |
| **Key Management** | Alchemy manages keys (embedded signer) | User manages keys (MetaMask/hardware wallet) |
| **First Tx** | Deploys SCA (initCode in first UserOp) | Sets EIP-7702 designation on EOA |
| **SDK Hook** | `useSendUserOperation` | `smartWalletClient.sendCalls()` |
| **EIP Standard** | EIP-4337 | EIP-7702 + EIP-5792 |

---

## Gas Sponsorship (Paymaster)

Both paths use the **Alchemy Gas Manager** for gas sponsorship:

- **Policy ID**: Configured in `.env.local` as `NEXT_PUBLIC_ALCHEMY_POLICY_ID`
- **How it works**: Alchemy fronts the gas cost. The policy defines which transactions are eligible for sponsorship (contract addresses, methods, limits, etc.)
- **Billing**: Alchemy sponsors gas on-chain and bills the developer in USD (monthly invoice)
- **User experience**: User pays $0 gas. Clicks "Mint" and the transaction goes through

### Embedded Path Sponsorship
```typescript
// Gas policy is set globally in config.ts
createConfig({
  policyId: SPONSORSHIP_POLICY_ID,
  // ...
});

// UserOps automatically use the paymaster
sendUserOperation({
  uo: { target, data, value },
});
```

### EOA Path Sponsorship
```typescript
// Policy applied per-call via capabilities
smartWalletClient.sendCalls({
  calls: [{ to, data, value }],
  capabilities: {
    paymasterService: {
      policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
    },
  },
});
```

---

## UnifiedWalletProvider — The Bridge

The `UnifiedWalletProvider` (in `app/hooks/useUnifiedWallet.tsx`) is the central piece that unifies both paths:

```
                    UnifiedWalletProvider
                    ┌─────────────────────────────┐
                    │                             │
                    │  Detects connection type:    │
                    │  ┌──────────────────────┐   │
                    │  │ useSignerStatus()    │───▶ isConnected? → "embedded"
                    │  │ (Alchemy signer)     │   │
                    │  └──────────────────────┘   │
                    │  ┌──────────────────────┐   │
                    │  │ useAccount()          │───▶ isConnected? → "eoa"
                    │  │ (wagmi/MetaMask)     │   │
                    │  └──────────────────────┘   │
                    │                             │
                    │  Unified API:                │
                    │  • isConnected              │
                    │  • connectionType            │
                    │  • smartAccountAddress       │
                    │  • signerAddress             │
                    │  • signMessage()             │
                    │  • sendGaslessTransaction()  │
                    │  • logout()                  │
                    └─────────────────────────────┘
```

**Priority**: If both are somehow connected, embedded takes priority (checked first).

**EOA Smart Account Setup Flow**:
1. wagmi detects MetaMask connection
2. `useWalletClient()` returns the viem `WalletClient`
3. Wrap it: `new WalletClientSigner(walletClient, "external")`
4. Create: `createSmartWalletClient({ transport, chain, signer, policyId })`
5. Request account: `client.requestAccount()` → returns `{ address }`
6. Store the smart account address and client in state

---

## Project Structure

```
gasless-poc/
├── config.ts                         # Alchemy Account Kit configuration
├── .env.local                        # API keys, policy ID, contract address
├── app/
│   ├── layout.tsx                    # Root layout, imports auth modal CSS
│   ├── page.tsx                      # Main page (login vs dashboard)
│   ├── providers.tsx                 # Provider tree: Query > Alchemy > UnifiedWallet
│   ├── hooks/
│   │   └── useUnifiedWallet.tsx      # Unified wallet context (both paths)
│   └── components/
│       ├── login-card.tsx            # Auth trigger button
│       ├── account-info.tsx          # Smart account details display
│       ├── sign-message.tsx          # Sign arbitrary messages (both paths)
│       ├── mint-and-list.tsx         # Gasless mintAndList (both paths)
│       ├── set-approval.tsx          # Gasless setApprovalForAll (both paths)
│       └── wallet-portfolio.tsx      # NFT & token balance display (Alchemy APIs)
├── lib/
│   ├── constants.ts                  # Contract ABIs and addresses
│   └── alchemy-api.ts               # Alchemy REST API utilities (NFT, Token, Balance)
└── package.json
```

---

## Alchemy APIs Used

| API | Endpoint | Purpose |
|-----|----------|---------|
| **Smart Wallets** | Account Kit SDK | Embedded wallet creation, smart accounts |
| **Wallet API** | `createSmartWalletClient` | EIP-7702 smart accounts for EOA |
| **Gas Manager** | Paymaster (via Policy ID) | Sponsor gas fees |
| **NFT API v3** | `GET /nft/v3/{apiKey}/getNFTsForOwner` | Display user's NFTs |
| **Token API** | `POST /v2/{apiKey}` → `alchemy_getTokenBalances` | Display ERC-20 token balances |
| **eth_getBalance** | Standard JSON-RPC | Native ETH balance |

---

## Contract: MusicalToken (ERC-1155)

- **Address**: `0x060Ee19779A50470062269F3CF7f39a419aeE27E` (Base Sepolia)
- **Standard**: ERC-1155 (multi-token), UUPS upgradeable
- **Key function**: `mintAndList(address, uint256, string, uint256, uint256, address[], uint256[])` — mints tokens and lists them on the integrated marketplace in one transaction
- **No `onlyOwner` restriction** on `mintAndList` — anyone can call it (gasless-friendly)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Alchemy API key for Base Sepolia |
| `NEXT_PUBLIC_ALCHEMY_POLICY_ID` | Gas Manager policy ID for sponsorship |
| `NEXT_PUBLIC_MUSICAL_TOKEN_ADDRESS` | MusicalToken contract address |

---

## Flow Diagrams

### Login → Gasless Transaction (Embedded)

```
1. User clicks "Sign In"
2. Auth Modal opens (email / passkey / Google)
3. User authenticates
4. useSignerStatus().isConnected = true
5. useSmartAccountClient() returns Modular Account v2
6. User fills mintAndList form and clicks "Mint"
7. useSendUserOperation() constructs UserOp:
   - sender: smart account address
   - callData: encodeFunctionData({ abi, functionName: "mintAndList", args })
8. Alchemy Gas Manager (Paymaster) sponsors gas
9. Alchemy Bundler submits on-chain
10. Transaction confirmed — user paid $0
```

### Login → Gasless Transaction (MetaMask)

```
1. User clicks "Sign In"
2. Auth Modal opens → user clicks "External Wallet" → MetaMask
3. MetaMask popup → user approves connection
4. wagmi useAccount().isConnected = true
5. UnifiedWalletProvider detects EOA, closes auth modal
6. Creates WalletClientSigner → SmartWalletClient → requestAccount()
7. EIP-7702 delegation setup (first time only)
8. User fills mintAndList form and clicks "Mint"
9. sendGaslessTransaction() calls smartWalletClient.sendCalls():
   - calls: [{ to: contractAddr, data: encodedCallData }]
   - capabilities: { paymasterService: { policyId } }
10. Alchemy Wallet API: prepares, sponsors gas, submits
11. Transaction confirmed — user paid $0
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@account-kit/react` | ^4.35.1 | Alchemy Account Kit UI + hooks |
| `@account-kit/core` | ^4.35.1 | Core Account Kit utilities |
| `@account-kit/infra` | ^4.35.1 | Alchemy transport, chain configs |
| `@account-kit/wallet-client` | ^4.35.1 | SmartWalletClient for EIP-7702 |
| `@aa-sdk/core` | ^4.35.1 | WalletClientSigner adapter |
| `viem` | ^2.45.0 | ABI encoding, utility types |
| `wagmi` | ^2.15.4 | EOA wallet connection (MetaMask) |
| `@tanstack/react-query` | ^5.50.1 | Async state management |
| `next` | 14.2.4 | React framework |
