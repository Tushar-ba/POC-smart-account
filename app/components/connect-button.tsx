"use client";

import { useAuthModal } from "@account-kit/react";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";

export default function ConnectButton() {
  const { openAuthModal } = useAuthModal();
  const {
    isConnected,
    isLoading,
    smartAccountAddress,
    connectionType,
    loginMethod,
    logout,
  } = useUnifiedWallet();

  // Shorten address: 0x1234...abcd
  const shortAddress = smartAccountAddress
    ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`
    : null;

  // Not connected → show Connect Wallet button
  if (!isConnected) {
    return (
      <button
        onClick={() => openAuthModal()}
        disabled={isLoading}
        style={{
          padding: "10px 20px",
          fontSize: "14px",
          fontWeight: "600",
          color: "white",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          borderRadius: "8px",
          cursor: isLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isLoading ? (
          <>
            <Spinner /> Connecting...
          </>
        ) : (
          "Connect Wallet"
        )}
      </button>
    );
  }

  // Connected → show address + disconnect
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {/* Connection badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          fontSize: "13px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            display: "inline-block",
          }}
        />
        <span style={{ color: "#166534", fontWeight: "500" }}>
          {connectionType === "eoa" ? "MetaMask" : loginMethod}
        </span>
      </div>

      {/* Address display */}
      <div
        style={{
          padding: "8px 14px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#334155",
          cursor: "pointer",
        }}
        title={smartAccountAddress ?? "Loading..."}
        onClick={() => {
          if (smartAccountAddress) {
            navigator.clipboard.writeText(smartAccountAddress);
          }
        }}
      >
        {shortAddress ?? "Loading..."}
      </div>

      {/* Disconnect button */}
      <button
        onClick={() => logout()}
        style={{
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: "500",
          color: "#ef4444",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Disconnect
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "14px",
        height: "14px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}
