"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, parseEther } from "viem";
import { MUSICAL_TOKEN_ABI, MUSICAL_TOKEN_ADDRESS } from "@/lib/constants";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";

export default function MintAndList() {
  const {
    isConnected,
    smartAccountAddress,
    sendGaslessTransaction,
  } = useUnifiedWallet();

  const [tokenURI, setTokenURI] = useState("ipfs://QmExample/metadata.json");
  const [price, setPrice] = useState("0.001");
  const [amount, setAmount] = useState("1");
  const [airdropAmount, setAirdropAmount] = useState("0");
  const [recipientOverride, setRecipientOverride] = useState("");

  // Royalty recipients: comma-separated addresses
  const [royaltyAddresses, setRoyaltyAddresses] = useState("");
  // Royalty percentages: comma-separated basis points (must sum to 10000)
  const [royaltyPercentages, setRoyaltyPercentages] = useState("");

  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<string>();

  // Build the encoded call data
  const buildCallData = useCallback(() => {
    const ownerAddr = smartAccountAddress;
    if (!ownerAddr) throw new Error("Smart account address not available");

    const tokenOwner = (recipientOverride || ownerAddr) as `0x${string}`;
    const mintAmount = BigInt(amount || "1");
    const airdropAmt = BigInt(airdropAmount || "0");

    let priceWei: bigint;
    try {
      priceWei = parseEther(price || "0");
    } catch {
      throw new Error("Invalid price format. Use decimal ETH value like 0.001");
    }

    if (priceWei === BigInt(0)) {
      throw new Error("Price must be > 0 (contract requires non-zero price)");
    }

    if (airdropAmt > mintAmount) {
      throw new Error("Airdrop amount cannot exceed mint amount");
    }

    let recipients: `0x${string}`[] = [];
    let percentages: bigint[] = [];

    if (royaltyAddresses.trim() && royaltyPercentages.trim()) {
      recipients = royaltyAddresses.split(",").map((a) => a.trim() as `0x${string}`);
      percentages = royaltyPercentages.split(",").map((p) => BigInt(p.trim()));

      if (recipients.length !== percentages.length) {
        throw new Error("Number of royalty addresses must match number of percentages");
      }

      const totalPct = percentages.reduce((sum, p) => sum + p, BigInt(0));
      if (totalPct !== BigInt(10000)) {
        throw new Error(`Royalty percentages must sum to 10000 (100%). Current sum: ${totalPct}`);
      }
    } else if (!royaltyAddresses.trim() && !royaltyPercentages.trim()) {
      recipients = [tokenOwner];
      percentages = [BigInt(10000)];
    } else {
      throw new Error("Provide both royalty addresses and percentages, or leave both empty for default (100% to owner)");
    }

    return encodeFunctionData({
      abi: MUSICAL_TOKEN_ABI,
      functionName: "mintAndList",
      args: [tokenOwner, mintAmount, tokenURI, priceWei, airdropAmt, recipients, percentages],
    });
  }, [smartAccountAddress, recipientOverride, amount, airdropAmount, price, tokenURI, royaltyAddresses, royaltyPercentages]);

  const handleMintAndList = useCallback(async () => {
    if (!isConnected) {
      setError("Wallet not connected");
      return;
    }

    if (!MUSICAL_TOKEN_ADDRESS || MUSICAL_TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setError("MusicalToken contract address not configured. Update NEXT_PUBLIC_MUSICAL_TOKEN_ADDRESS in .env.local");
      return;
    }

    setIsMinting(true);
    setError(undefined);
    setTxHash(undefined);

    try {
      const data = buildCallData();

      // Single path for ALL wallet types — sendGaslessTransaction
      // uses smartWalletClient.sendCalls() with paymaster internally
      const hash = await sendGaslessTransaction({
        target: MUSICAL_TOKEN_ADDRESS,
        data,
        value: BigInt(0),
      });

      setTxHash(hash);
    } catch (err: any) {
      console.error("MintAndList error:", err);
      setError(err.message || "Failed to execute mintAndList");
    } finally {
      setIsMinting(false);
    }
  }, [isConnected, buildCallData, sendGaslessTransaction]);

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
        Gasless mintAndList
      </h2>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
        Mint MusicalToken ERC-1155 NFTs and auto-list on marketplace — <strong>zero gas fees</strong> via gas sponsorship.
      </p>

      <div style={{
        padding: "10px 14px",
        background: "#eff6ff",
        borderRadius: "8px",
        border: "1px solid #bfdbfe",
        marginBottom: "16px",
        fontSize: "12px",
        color: "#1e40af",
      }}>
        Contract: <code style={{ wordBreak: "break-all" }}>{MUSICAL_TOKEN_ADDRESS}</code>
      </div>

      {/* Token URI */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>Token URI (metadata)</label>
        <input
          type="text"
          value={tokenURI}
          onChange={(e) => setTokenURI(e.target.value)}
          placeholder="ipfs://... or https://..."
          style={inputStyle}
        />
      </div>

      {/* Amount + Price row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Mint Amount</label>
          <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Listing Price (ETH)</label>
          <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.001" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Airdrop Amount</label>
          <input type="text" value={airdropAmount} onChange={(e) => setAirdropAmount(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
      </div>

      {/* Token Owner */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>Token Owner (leave empty = your smart account)</label>
        <input
          type="text"
          value={recipientOverride}
          onChange={(e) => setRecipientOverride(e.target.value)}
          placeholder={smartAccountAddress ?? "0x..."}
          style={inputStyle}
        />
      </div>

      {/* Royalty Recipients */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>
          Royalty Recipients (comma-separated addresses) — leave empty for 100% to owner
        </label>
        <input
          type="text"
          value={royaltyAddresses}
          onChange={(e) => setRoyaltyAddresses(e.target.value)}
          placeholder="0xAddr1, 0xAddr2"
          style={inputStyle}
        />
      </div>

      {/* Royalty Percentages */}
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>
          Royalty Percentages (basis points, must sum to 10000)
        </label>
        <input
          type="text"
          value={royaltyPercentages}
          onChange={(e) => setRoyaltyPercentages(e.target.value)}
          placeholder="7000, 3000"
          style={inputStyle}
        />
      </div>

      {/* Mint button */}
      <button
        onClick={handleMintAndList}
        disabled={isMinting || !tokenURI}
        style={{
          width: "100%",
          padding: "14px",
          fontSize: "16px",
          fontWeight: "600",
          color: "white",
          background: isMinting
            ? "#a5b4fc"
            : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          borderRadius: "8px",
          cursor: isMinting ? "not-allowed" : "pointer",
        }}
      >
        {isMinting ? "Sending transaction (gasless)..." : "Mint & List (Gasless)"}
      </button>

      {/* Error display */}
      {error && (
        <div style={{
          marginTop: "12px",
          padding: "12px",
          background: "#fef2f2",
          borderRadius: "8px",
          border: "1px solid #fecaca",
        }}>
          <p style={{ fontSize: "13px", color: "#dc2626", wordBreak: "break-all" }}>
            Error: {error}
          </p>
        </div>
      )}

      {/* Success display */}
      {transactionUrl && (
        <div style={{
          marginTop: "16px",
          padding: "16px",
          background: "#f0fdf4",
          borderRadius: "8px",
          border: "1px solid #bbf7d0",
        }}>
          <p style={{ fontSize: "14px", fontWeight: "600", color: "#166534", marginBottom: "8px" }}>
            ✅ mintAndList executed gaslessly!
          </p>
          <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
            Transaction Hash:
          </p>
          <code style={{ fontSize: "12px", wordBreak: "break-all", color: "#333" }}>
            {txHash}
          </code>
          <br />
          <a
            href={transactionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: "8px",
              color: "#6366f1",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            View on BaseScan →
          </a>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#555",
  fontWeight: "500",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  marginTop: "4px",
  fontSize: "14px",
  fontFamily: "monospace",
  boxSizing: "border-box",
};
