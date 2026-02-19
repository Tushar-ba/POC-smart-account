"use client";

import { useAuthModal } from "@account-kit/react";

export default function LoginCard() {
  const { openAuthModal } = useAuthModal();

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "80vh",
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "40px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%",
      }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "12px" }}>
          Gasless Transactions POC
        </h1>
        <p style={{ color: "#666", marginBottom: "8px" }}>
          Alchemy Embedded Wallets + Smart Accounts
        </p>
        <p style={{ color: "#888", fontSize: "14px", marginBottom: "24px" }}>
          Base Sepolia Network
        </p>
        <button
          onClick={() => openAuthModal()}
          style={{
            width: "100%",
            padding: "14px 24px",
            fontSize: "16px",
            fontWeight: "600",
            color: "white",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Login with Alchemy
        </button>
        <p style={{ color: "#aaa", fontSize: "12px", marginTop: "16px" }}>
          Email, Passkey, Google, or MetaMask
        </p>
      </div>
    </div>
  );
}
