"use client";

import { useState } from "react";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import { hashMessage } from "viem";

export default function SignMessage() {
  const { signMessage: walletSignMessage, isConnected, connectionType } = useUnifiedWallet();
  const [message, setMessage] = useState("Hello from Alchemy Smart Wallet!");
  const [signature, setSignature] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [messageHash, setMessageHash] = useState<string>("");

  const handleSignMessage = async () => {
    if (!isConnected) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError("");
    setSignature("");
    setMessageHash("");

    try {
      const sig = await walletSignMessage(message);
      setSignature(sig);
      setMessageHash(hashMessage(message));
    } catch (err: any) {
      console.error("Sign message error:", err);
      setError(err.message || "Failed to sign message");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: "white",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    }}>
      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
        Sign Message
      </h2>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
        Sign an arbitrary message using your smart account ({connectionType === "eoa" ? "via Smart Wallet Client" : "EIP-1271 smart contract signature"}).
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "13px", color: "#555", fontWeight: "500" }}>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            marginTop: "4px",
            fontSize: "14px",
            fontFamily: "monospace",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      <button
        onClick={handleSignMessage}
        disabled={isLoading || !message}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "15px",
          fontWeight: "600",
          color: "white",
          background: isLoading ? "#a5b4fc" : "#6366f1",
          border: "none",
          borderRadius: "8px",
          cursor: isLoading ? "not-allowed" : "pointer",
        }}
      >
        {isLoading ? "Signing..." : "Sign Message"}
      </button>

      {error && (
        <div style={{
          marginTop: "12px",
          padding: "10px",
          background: "#fef2f2",
          borderRadius: "8px",
          border: "1px solid #fecaca",
        }}>
          <p style={{ fontSize: "13px", color: "#dc2626", wordBreak: "break-all" }}>
            Error: {error}
          </p>
        </div>
      )}

      {signature && (
        <div style={{
          marginTop: "16px",
          padding: "16px",
          background: "#f0fdf4",
          borderRadius: "8px",
          border: "1px solid #bbf7d0",
        }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#166534", marginBottom: "8px" }}>
            ✅ Message Signed Successfully
          </p>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#888" }}>Message Hash:</span>
            <p style={{ fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all", color: "#333" }}>
              {messageHash}
            </p>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "#888" }}>Signature:</span>
            <p style={{ fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all", color: "#333" }}>
              {signature}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
