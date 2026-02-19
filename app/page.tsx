"use client";

import { useUnifiedWallet } from "./hooks/useUnifiedWallet";
import LoginCard from "./components/login-card";
import AccountInfo from "./components/account-info";
import WalletPortfolio from "./components/wallet-portfolio";
import SignMessage from "./components/sign-message";
import MintAndList from "./components/mint-and-list";
import SetApproval from "./components/set-approval";

export default function Home() {
  const { isConnected, isLoading } = useUnifiedWallet();

  return (
    <div style={{ minHeight: "100vh", padding: "20px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          marginBottom: "32px",
          paddingTop: "20px",
        }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111" }}>
            Gasless Transactions POC
          </h1>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Alchemy Embedded Wallets + Smart Accounts + Gas Sponsorship | Base Sepolia
          </p>
        </div>

        {isConnected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Section 1: Smart Account Info */}
            <AccountInfo />

            {/* Section 2: Wallet Portfolio (Balances, NFTs, Tokens) */}
            <WalletPortfolio />

            {/* Section 3: Sign Message */}
            <SignMessage />

            {/* Section 3: Gasless mintAndList */}
            <MintAndList />

            {/* Section 4: Gasless Approval */}
            <SetApproval />

            {/* How It Works */}
            <div style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
                How Gasless Transactions Work
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", color: "#444" }}>
                <Step num={1} title="Authentication">
                  User logs in via email, passkey, Google, or connects an external wallet (MetaMask). Both paths get a smart account.
                </Step>
                <Step num={2} title="Smart Account Created">
                  A smart contract account is created for the user. Embedded wallets use Alchemy&apos;s signer; external wallets use the EOA as the owner.
                </Step>
                <Step num={3} title="UserOperation / EIP-7702">
                  Embedded wallets use ERC-4337 UserOperations. External wallets (MetaMask) use EIP-7702 delegation via the Wallet API.
                </Step>
                <Step num={4} title="Gas Sponsorship (Paymaster)">
                  The Alchemy Gas Manager policy sponsors the gas fees. The user pays nothing.
                </Step>
                <Step num={5} title="On-Chain Execution">
                  Embedded path: Bundler submits the UserOp. EOA path: Wallet API prepares and submits the transaction. Both paths are gasless.
                </Step>
              </div>
            </div>
          </div>
        ) : (
          <LoginCard />
        )}
      </div>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "12px" }}>
      <div style={{
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: "#6366f1",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: "bold",
        flexShrink: 0,
      }}>
        {num}
      </div>
      <div>
        <p style={{ fontWeight: "600", marginBottom: "2px" }}>{title}</p>
        <p style={{ color: "#666", fontSize: "13px" }}>{children}</p>
      </div>
    </div>
  );
}
