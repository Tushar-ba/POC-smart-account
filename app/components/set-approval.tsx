"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData } from "viem";
import { MUSICAL_TOKEN_ABI, MUSICAL_TOKEN_ADDRESS } from "@/lib/constants";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";

export default function SetApproval() {
  const { isConnected, sendGaslessTransaction } = useUnifiedWallet();

  const [operatorAddress, setOperatorAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<string>();

  const handleSetApproval = useCallback(async () => {
    if (!isConnected) {
      setError("Wallet not connected");
      return;
    }

    if (!operatorAddress) {
      setError("Please enter the operator (marketplace) address");
      return;
    }

    if (!MUSICAL_TOKEN_ADDRESS || MUSICAL_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setError("MusicalToken contract address not configured");
      return;
    }

    setIsLoading(true);
    setError(undefined);
    setTxHash(undefined);

    try {
      const data = encodeFunctionData({
        abi: MUSICAL_TOKEN_ABI,
        functionName: "setApprovalForAll",
        args: [operatorAddress as `0x${string}`, true],
      });

      const hash = await sendGaslessTransaction({
        target: MUSICAL_TOKEN_ADDRESS,
        data,
        value: BigInt(0),
      });

      setTxHash(hash);
    } catch (err: any) {
      setError(err.message || "Failed to set approval");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendGaslessTransaction, operatorAddress]);

  const transactionUrl = txHash
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : undefined;

  return (
    <div style={{
      background: "white",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    }}>
      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
        Set Marketplace Approval (Gasless)
      </h2>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
        Approve a marketplace contract to transfer your MusicalTokens — also gasless.
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "13px", color: "#555", fontWeight: "500" }}>
          Operator (Marketplace) Address
        </label>
        <input
          type="text"
          value={operatorAddress}
          onChange={(e) => setOperatorAddress(e.target.value)}
          placeholder="0x..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            marginTop: "4px",
            fontSize: "14px",
            fontFamily: "monospace",
            boxSizing: "border-box",
          }}
        />
      </div>

      <button
        onClick={handleSetApproval}
        disabled={isLoading || !operatorAddress}
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
        {isLoading ? "Sending UserOp..." : "Approve Marketplace (Gasless)"}
      </button>

      {error && (
        <div style={{
          marginTop: "12px",
          padding: "10px",
          background: "#fef2f2",
          borderRadius: "8px",
          border: "1px solid #fecaca",
        }}>
          <p style={{ fontSize: "13px", color: "#dc2626", wordBreak: "break-all" }}>Error: {error}</p>
        </div>
      )}

      {transactionUrl && (
        <div style={{
          marginTop: "12px",
          padding: "12px",
          background: "#f0fdf4",
          borderRadius: "8px",
          border: "1px solid #bbf7d0",
        }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#166534" }}>✅ Approval set gaslessly!</p>
          <a
            href={transactionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: "4px", color: "#6366f1", fontSize: "13px" }}
          >
            View on BaseScan →
          </a>
        </div>
      )}
    </div>
  );
}
