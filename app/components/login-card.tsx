"use client";

import { useAuthModal } from "@account-kit/react";

export default function LoginCard() {
  const { openAuthModal } = useAuthModal();

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "60vh",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "48px 40px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        textAlign: "center",
        maxWidth: "440px",
        width: "100%",
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: "28px",
        }}>
          &#x1F4B0;
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "8px", color: "#111" }}>
          Connect Your Wallet
        </h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "28px", lineHeight: "1.5" }}>
          Connect with email, passkey, Google, or MetaMask to get a smart account with gasless transactions.
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
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Connect Wallet
        </button>
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "16px", fontSize: "12px", color: "#999" }}>
          <span>Email</span>
          <span>&bull;</span>
          <span>Passkey</span>
          <span>&bull;</span>
          <span>Google</span>
          <span>&bull;</span>
          <span>MetaMask</span>
        </div>
      </div>
    </div>
  );
}
