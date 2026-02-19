"use client";

import { useUnifiedWallet } from "../hooks/useUnifiedWallet";

export default function AccountInfo() {
  const {
    isConnected,
    connectionType,
    isLoading,
    smartAccountAddress,
    signerAddress,
    loginMethod,
    email,
    logout,
    error,
  } = useUnifiedWallet();

  return (
    <div style={{
      background: "white",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>
          Smart Account Info
        </h2>
        <button
          onClick={() => logout()}
          style={{
            padding: "6px 16px",
            fontSize: "13px",
            color: "#ef4444",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <InfoRow label="Status" value={isConnected ? "Connected ✅" : "Disconnected"} />
        <InfoRow label="Login Method" value={loginMethod} />
        <InfoRow label="Connection Type" value={connectionType === "embedded" ? "Embedded Wallet → Smart Account" : "External Wallet (EOA) → Smart Account"} />
        <InfoRow label="Email" value={email ?? "N/A"} />
        {signerAddress && (
          <InfoRow
            label={connectionType === "eoa" ? "EOA Address (MetaMask)" : "Signer (Embedded Wallet)"}
            value={signerAddress}
            mono
          />
        )}
        <InfoRow
          label="Smart Account Address"
          value={isLoading ? "Creating smart account..." : (smartAccountAddress ?? "Loading...")}
          mono
        />
        <InfoRow label="Chain" value="Base Sepolia (84532)" />
        <InfoRow label="Account Type" value={connectionType === "eoa" ? "Smart Wallet (via Wallet API)" : "Modular Account (v2)"} />

        {error && (
          <div style={{
            marginTop: "8px",
            padding: "12px",
            background: "#fef2f2",
            borderRadius: "8px",
            border: "1px solid #fecaca",
          }}>
            <p style={{ fontSize: "13px", color: "#dc2626" }}>
              Error: {error}
            </p>
          </div>
        )}

        <div style={{
          marginTop: "8px",
          padding: "12px",
          background: "#f0fdf4",
          borderRadius: "8px",
          border: "1px solid #bbf7d0",
        }}>
          <p style={{ fontSize: "13px", color: "#166534" }}>
            ✨ Whether you logged in via email, Google, passkey, or <strong>MetaMask</strong>,
            you get a <strong>smart account</strong>.
            All transactions are <strong>gasless</strong> via gas sponsorship.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: "12px", color: "#888", fontWeight: "500" }}>{label}</span>
      <p style={{
        fontSize: "14px",
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-all",
        color: "#333",
        marginTop: "2px",
      }}>
        {value}
      </p>
    </div>
  );
}
