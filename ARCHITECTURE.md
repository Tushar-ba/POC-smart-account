# Gasless Transactions POC — Architecture Documentation

## Overview

This POC demonstrates **gasless (sponsored) transactions** on **Base Sepolia** using Alchemy's Account Kit. It supports **all wallet types** — Alchemy Embedded Wallets (email, passkey, Google) and External Wallets (MetaMask, WalletConnect) — through a **single unified code path** powered by `createSmartWalletClient`.

**Key insight**: There is no dual-path branching. Both embedded and EOA wallets go through the exact same `createSmartWalletClient → sendCalls() + paymaster` pipeline. Components never need to know which wallet type is connected.

---

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       Next.js Frontend (App Router)                       │
│                                                                           │
│  ┌──────────────────┐      ┌───────────────────────────────────────────┐  │
│  │   Auth Modal      │      │    UnifiedWalletProvider (Context)        │  │
│  │  (Account Kit UI) │      │                                          │  │
│  │                   │      │  1. Detect signer (embedded OR wagmi)     │  │
│  │  • Email          │      │  2. createSmartWalletClient() ← SINGLE   │  │
│  │  • Passkey        │─────▶│  3. Expose unified API to components:    │  │
│  │  • Google OAuth   │      │     • signMessage()                      │  │
│  │  • MetaMask / WC  │      │     • sendGaslessTransaction()           │  │
│  └──────────────────┘      │     • smartAccountAddress                 │  │
│                             └──────────────┬──────────────────────────┘  │
│                                            │                             │
│       ┌────────────────────────────────────┼────────────────────┐        │
│       │    Components (zero branching)      │                    │        │
│       │                                     │                    │        │
│       │  mint-and-list.tsx                  │  set-approval.tsx  │        │
│       │  sign-message.tsx                  │  account-info.tsx  │        │
│       │                                     │                    │        │
│       │  All call sendGaslessTransaction() — no connectionType  │        │
│       │  checks, no if/else, no dual-path logic                 │        │
│       └─────────────────────────────────────────────────────────┘        │
│                                            │                             │
└────────────────────────────────────────────┼─────────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  createSmartWalletClient  │
                              │  (single instance)        │
                              │                           │
                              │  • EOA signer → EIP-7702  │
                              │    (auto-delegates)       │
                              │  • Embedded signer → SCA  │
                              │    (requestAccount)       │
                              └────────────┬─────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │  smartWalletClient        │
                              │  .sendCalls({             │
                              │    calls: [...],          │
                              │    capabilities: {        │
                              │      paymasterService: {  │
                              │        policyId           │
                              │      }                    │
                              │    }                      │
                              │  })                       │
                              └────────────┬─────────────┘
                                           │
                              ┌────────────▼─────────────┐
                              │  Alchemy Wallet API      │
                              │  (EIP-5792: sendCalls)   │
                              │  + Gas Manager (Paymaster)│
                              └────────────┬─────────────┘
                                           │
                              ┌────────────▼─────────────┐
                              │     Base Sepolia (L2)     │
                              └──────────────────────────┘
```

---

## Single Unified Path — `createSmartWalletClient`

The entire architecture revolves around **one function**: `createSmartWalletClient` from `@account-kit/wallet-client`. This is the key API that makes both wallet types work identically.

### How It Works

```
┌─────────────────────────────────────────────────────┐
│              User connects wallet                     │
│                                                       │
│  Email / Passkey / Google    OR    MetaMask / WC     │
│         │                              │              │
│         ▼                              ▼              │
│  alchemySigner              WalletClientSigner        │
│  (from useSigner)           (wraps wagmi walletClient)│
│         │                              │              │
│         └──────────┬───────────────────┘              │
│                    ▼                                  │
│     createSmartWalletClient({                         │
│       transport: alchemy({ apiKey }),                 │
│       chain: baseSepolia,                             │
│       signer: <either signer>,                        │
│       policyId: POLICY_ID,                            │
│       account: <address>,  // optional for embedded   │
│     })                                                │
│                    │                                  │
│                    ▼                                  │
│         SmartWalletClient                             │
│         .sendCalls()    ← same API for BOTH paths    │
│         .signMessage()  ← same API for BOTH paths    │
└─────────────────────────────────────────────────────┘
```

### Embedded Wallet (SCA)

1. User authenticates via email / passkey / Google
2. `useSigner()` returns the Alchemy embedded signer (manages keys server-side)
3. `createSmartWalletClient({ signer: alchemySigner, policyId })` — no account yet
4. `client.requestAccount()` → Alchemy creates/retrieves a **Smart Contract Account** (new address)
5. Re-create client with `account: sca.address`
6. Ready: `sendCalls()` sends transactions through the SCA, paymaster sponsors gas

**Result**: Signer address ≠ SCA address (two different addresses)

### External Wallet / EOA (EIP-7702)

1. User connects MetaMask via Auth Modal or WalletConnect
2. wagmi `useWalletClient()` returns the viem `WalletClient`
3. Wrap: `new WalletClientSigner(walletClient, "external")` (from `@aa-sdk/core`)
4. `createSmartWalletClient({ signer, policyId, account: eoaAddress })` — EOA address IS the smart account
5. Ready: `sendCalls()` auto-detects if **EIP-7702 delegation** is needed, bundles it with the first tx
6. User just signs once — the delegation + actual call happen atomically

**Result**: EOA address = Smart Account address (same address, upgraded capabilities)

### What is EIP-7702 Delegation?

EIP-7702 allows an EOA to **temporarily delegate** its execution to a smart contract implementation. On the first call:
- The delegation transaction is bundled with the user's actual transaction
- The EOA's address doesn't change — it just gains smart account capabilities
- The paymaster sponsors the delegation gas too — user pays nothing
- After delegation, subsequent calls work directly (no repeated delegation)

---

## Where This Happens in Code

### Core: `useUnifiedWallet.tsx` (app/hooks/)

This is the **single source of truth** for all wallet logic:

```
File: app/hooks/useUnifiedWallet.tsx
│
├── Lines 1-30:    Imports (createSmartWalletClient, WalletClientSigner, etc.)
├── Lines 76-82:   Architecture comment explaining the single-path design
├── Lines 83-100:  Hook setup — embedded signer + wagmi EOA detection
├── Lines 102-110: Auto-close auth modal when EOA connects
├── Lines 120-127: Signer detection:
│                    hasEmbeddedSigner = signerStatus.isConnected && !!alchemySigner
│                    hasEoaSigner = eoaIsConnected && !!walletClient && !signerStatus.isConnected
│
├── Lines 131-200: █ SmartWalletClient creation (the KEY code) █
│   ├── Lines 152-167: EOA path:
│   │     signer = new WalletClientSigner(walletClient, "external")
│   │     client = createSmartWalletClient({ signer, policyId, account: eoaAddress })
│   │
│   └── Lines 169-188: Embedded path:
│         client = createSmartWalletClient({ signer: alchemySigner, policyId })
│         account = await client.requestAccount()
│         client = createSmartWalletClient({ ..., account: account.address })
│
├── Lines 241-248: signMessage() — smartWalletClient.signMessage({ message })
├── Lines 252-283: █ sendGaslessTransaction() █ — the UNIFIED transaction path:
│                    smartWalletClient.sendCalls({
│                      from: smartAccountAddress,
│                      calls: [{ to, data, value }],
│                      capabilities: { paymasterService: { policyId } }
│                    })
│                    → waitForCallsStatus() → return txHash
│
└── Lines 285-300: logout() — alchemyLogout or wagmiDisconnect + reset state
```

### Components: Zero dual-path logic

**mint-and-list.tsx** (app/components/):
```typescript
// Line 86-105 — the ONLY transaction code. No connectionType check.
const hash = await sendGaslessTransaction({
  target: MUSICAL_TOKEN_ADDRESS,
  data,         // encodeFunctionData for mintAndList
  value: BigInt(0),
});
```

**set-approval.tsx** (app/components/):
```typescript
// Line 36-54 — identical pattern. Just calls sendGaslessTransaction.
const hash = await sendGaslessTransaction({
  target: MUSICAL_TOKEN_ADDRESS,
  data,         // encodeFunctionData for setApprovalForAll
  value: BigInt(0),
});
```

**sign-message.tsx** (app/components/):
```typescript
// Calls signMessage() from unified hook — works for both wallet types
const signature = await signMessage(message);
```

**account-info.tsx** (app/components/):
```typescript
// Displays "Transaction Engine: createSmartWalletClient → sendCalls() + Paymaster"
// Shows EIP-7702 or SCA label based on connectionType (display only, not logic)
```

---

## Embedded vs EOA — Differences (Under the Hood)

Even though components see a single API, the underlying account types differ:

| Feature | Embedded (SCA) | EOA (EIP-7702) |
|---|---|---|
| **Account Type** | Smart Contract Account (new address) | EOA itself becomes smart (same address) |
| **Address** | SCA address (different from signer) | EOA address = Smart Account address |
| **Key Management** | Alchemy manages keys (embedded signer) | User manages keys (MetaMask) |
| **First Tx** | Deploys SCA (done by `requestAccount()`) | Sets EIP-7702 delegation (auto, bundled) |
| **SDK Call** | `createSmartWalletClient → sendCalls()` | `createSmartWalletClient → sendCalls()` |
| **Gas Sponsorship** | `capabilities.paymasterService.policyId` | `capabilities.paymasterService.policyId` |
| **Component Code** | `sendGaslessTransaction(...)` | `sendGaslessTransaction(...)` |

**The bottom three rows are identical** — that's the whole point of the unified architecture.

---

## Gas Sponsorship (Paymaster)

Both paths use the **Alchemy Gas Manager** via the same mechanism:

- **Policy ID**: Configured in `.env.local` as `NEXT_PUBLIC_ALCHEMY_POLICY_ID`
- **How it works**: Alchemy fronts the gas cost on-chain. The policy defines which transactions are eligible (contract addresses, methods, limits, etc.)
- **Billing**: Alchemy sponsors gas and bills the developer in USD (monthly invoice)
- **User experience**: User pays $0 gas. Clicks "Mint" and the transaction goes through

### Single Sponsorship Code (Both Paths)

```typescript
// This EXACT code runs for both embedded and EOA wallets
smartWalletClient.sendCalls({
  from: smartAccountAddress,
  calls: [
    {
      to: contractAddress,
      data: encodedCallData,
      value: "0x0",
    },
  ],
  capabilities: {
    paymasterService: {
      policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
    },
  },
});
```

For EOA wallets, the paymaster also sponsors the EIP-7702 delegation transaction (first tx only). The user never pays for anything.

---

## UnifiedWalletProvider — The Single Context

The `UnifiedWalletProvider` (in `app/hooks/useUnifiedWallet.tsx`) wraps the entire app and provides one context:

```
                    UnifiedWalletProvider
                    ┌────────────────────────────────────────┐
                    │                                        │
                    │  Step 1: Detect which signer exists    │
                    │  ┌──────────────────────────┐          │
                    │  │ useSignerStatus()        │──▶ embedded?
                    │  │ useSigner()              │          │
                    │  └──────────────────────────┘          │
                    │  ┌──────────────────────────┐          │
                    │  │ useAccount() (wagmi)     │──▶ eoa?  │
                    │  │ useWalletClient()        │          │
                    │  └──────────────────────────┘          │
                    │                                        │
                    │  Step 2: Create ONE SmartWalletClient  │
                    │  ┌──────────────────────────┐          │
                    │  │ createSmartWalletClient({ │          │
                    │  │   signer: <any signer>,  │          │
                    │  │   policyId,              │          │
                    │  │   account: <address>,    │          │
                    │  │ })                       │          │
                    │  └──────────────────────────┘          │
                    │                                        │
                    │  Step 3: Expose unified API             │
                    │  • isConnected                         │
                    │  • connectionType (display only)        │
                    │  • smartAccountAddress                  │
                    │  • signMessage()                        │
                    │  • sendGaslessTransaction()             │
                    │  • logout()                             │
                    └────────────────────────────────────────┘
```

**Priority**: If both signers exist, embedded takes priority.

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
│   │   └── useUnifiedWallet.tsx      # ★ Unified wallet context (single SmartWalletClient)
│   └── components/
│       ├── login-card.tsx            # Auth trigger button
│       ├── account-info.tsx          # Smart account details display
│       ├── sign-message.tsx          # Sign arbitrary messages
│       ├── mint-and-list.tsx         # Gasless mintAndList
│       ├── set-approval.tsx          # Gasless setApprovalForAll
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
| **Wallet API** | `createSmartWalletClient` → `sendCalls()` | Smart accounts for ALL wallet types |
| **Gas Manager** | Paymaster (via Policy ID in `sendCalls` capabilities) | Sponsor gas fees |
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

### Gasless Transaction — Embedded Wallet (Email / Passkey / Google)

```
1. User clicks "Sign In"
2. Auth Modal opens (email / passkey / Google)
3. User authenticates
4. useSignerStatus().isConnected = true, useSigner() returns alchemySigner
5. useUnifiedWallet creates SmartWalletClient:
   a. createSmartWalletClient({ signer: alchemySigner, policyId })
   b. client.requestAccount() → returns SCA address
   c. Re-create client with account: sca.address
6. User fills mintAndList form and clicks "Mint"
7. Component calls sendGaslessTransaction({ target, data, value })
8. Under the hood: smartWalletClient.sendCalls({
     from: scaAddress,
     calls: [{ to, data, value }],
     capabilities: { paymasterService: { policyId } }
   })
9. Alchemy Wallet API: prepares call, applies paymaster, submits on-chain
10. waitForCallsStatus() → transaction confirmed — user paid $0
```

### Gasless Transaction — MetaMask / External Wallet (EIP-7702)

```
1. User clicks "Sign In"
2. Auth Modal opens → user clicks "External Wallet" → MetaMask
3. MetaMask popup → user approves connection
4. wagmi useAccount().isConnected = true, useWalletClient() returns walletClient
5. useUnifiedWallet creates SmartWalletClient:
   a. signer = new WalletClientSigner(walletClient, "external")
   b. createSmartWalletClient({ signer, policyId, account: eoaAddress })
   c. EOA address IS the smart account address (EIP-7702)
6. User fills mintAndList form and clicks "Mint"
7. Component calls sendGaslessTransaction({ target, data, value })
   ← EXACT SAME FUNCTION as embedded path
8. Under the hood: smartWalletClient.sendCalls({
     from: eoaAddress,
     calls: [{ to, data, value }],
     capabilities: { paymasterService: { policyId } }
   })
9. First tx: Alchemy auto-bundles EIP-7702 delegation + contract call
   Subsequent tx: Just the contract call (delegation already set)
10. Paymaster sponsors ALL gas (including delegation) — user paid $0
```

---

## Previous Architecture (Deprecated)

The earlier version used a dual-path approach:
- **Embedded**: `useSmartAccountClient()` + `useSendUserOperation()` (ERC-4337 UserOps via Bundler)
- **EOA**: `createSmartWalletClient()` + `sendCalls()` (EIP-7702 via Wallet API)

This required every component to check `connectionType` and branch between two different transaction APIs. The current unified architecture eliminates all of that — both paths use `createSmartWalletClient` → `sendCalls()`.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@account-kit/react` | ^4.35.1 | Auth modal UI, hooks (useSignerStatus, useSigner, useUser) |
| `@account-kit/core` | ^4.35.1 | Core Account Kit utilities |
| `@account-kit/infra` | ^4.35.1 | Alchemy transport, baseSepolia chain config |
| `@account-kit/wallet-client` | ^4.35.1 | **`createSmartWalletClient`** — the key API for all wallet types |
| `@aa-sdk/core` | ^4.35.1 | `WalletClientSigner` — wraps MetaMask as SmartAccountSigner |
| `viem` | ^2.45.0 | ABI encoding (`encodeFunctionData`), utility types |
| `wagmi` | ^2.15.4 | EOA wallet connection (MetaMask, WalletConnect) |
| `@tanstack/react-query` | ^5.50.1 | Async state management |
| `next` | 14.2.4 | React framework (App Router) |
