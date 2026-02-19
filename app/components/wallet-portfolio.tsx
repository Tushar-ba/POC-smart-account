"use client";

import { useCallback, useEffect, useState } from "react";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import {
  getEthBalance,
  getEnrichedTokenBalances,
  getNftsForOwner,
  type EnrichedToken,
  type NftItem,
} from "@/lib/alchemy-api";

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <h3
      style={{
        fontSize: "16px",
        fontWeight: "600",
        marginBottom: "12px",
        color: "#333",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {title}
      {count !== undefined && (
        <span
          style={{
            background: "#e0e7ff",
            color: "#4338ca",
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "10px",
            fontWeight: "500",
          }}
        >
          {count}
        </span>
      )}
    </h3>
  );
}

function NftCard({ nft }: { nft: NftItem }) {
  const imgUrl =
    nft.image.thumbnailUrl ||
    nft.image.cachedUrl ||
    nft.image.pngUrl ||
    nft.image.originalUrl;

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        overflow: "hidden",
        width: "160px",
        flexShrink: 0,
      }}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={nft.name || `Token #${nft.tokenId}`}
          style={{
            width: "160px",
            height: "160px",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "160px",
            height: "160px",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "12px",
            textAlign: "center",
            padding: "8px",
          }}
        >
          {nft.contract.tokenType === "ERC1155" ? "ERC-1155" : "NFT"}
          <br />#{nft.tokenId}
        </div>
      )}
      <div style={{ padding: "8px" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#111",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nft.name || `#${nft.tokenId}`}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "#888",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nft.contract.name || shortenAddress(nft.contract.address)}
        </p>
        {nft.tokenType === "ERC1155" && Number(nft.balance) > 1 && (
          <p style={{ fontSize: "11px", color: "#6366f1", fontWeight: "500" }}>
            x{nft.balance}
          </p>
        )}
      </div>
    </div>
  );
}

function TokenRow({ token }: { token: EnrichedToken }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: "#f9fafb",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {token.logo ? (
          <img
            src={token.logo}
            alt={token.symbol}
            style={{ width: "28px", height: "28px", borderRadius: "50%" }}
          />
        ) : (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#ddd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "600",
              color: "#666",
            }}
          >
            {token.symbol.charAt(0)}
          </div>
        )}
        <div>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#111" }}>
            {token.symbol}
          </p>
          <p style={{ fontSize: "11px", color: "#888" }}>{token.name}</p>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#111",
            fontFamily: "monospace",
          }}
        >
          {token.balance}
        </p>
      </div>
    </div>
  );
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WalletPortfolio() {
  const { isConnected, smartAccountAddress, signerAddress, connectionType } =
    useUnifiedWallet();

  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [signerEthBalance, setSignerEthBalance] = useState<string | null>(null);
  const [tokens, setTokens] = useState<EnrichedToken[]>([]);
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [nftCount, setNftCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "nfts" | "tokens">(
    "overview"
  );

  const fetchPortfolio = useCallback(async () => {
    if (!smartAccountAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const promises: Promise<any>[] = [
        getEthBalance(smartAccountAddress),
        getEnrichedTokenBalances(smartAccountAddress),
        getNftsForOwner(smartAccountAddress),
      ];

      // Also fetch signer balance if different from smart account
      if (signerAddress && signerAddress !== smartAccountAddress) {
        promises.push(getEthBalance(signerAddress));
      }

      const results = await Promise.allSettled(promises);

      // ETH balance (smart account)
      if (results[0].status === "fulfilled") {
        setEthBalance(results[0].value);
      }

      // Tokens
      if (results[1].status === "fulfilled") {
        setTokens(results[1].value);
      }

      // NFTs
      if (results[2].status === "fulfilled") {
        const nftData = results[2].value;
        setNfts(nftData.ownedNfts ?? []);
        setNftCount(nftData.totalCount ?? 0);
      }

      // Signer ETH balance
      if (results.length > 3 && results[3].status === "fulfilled") {
        setSignerEthBalance(results[3].value);
      }

      // Check for any errors
      const errors = results.filter((r) => r.status === "rejected");
      if (errors.length > 0 && errors.length === results.length) {
        setError("Failed to fetch portfolio data");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  }, [smartAccountAddress, signerAddress]);

  useEffect(() => {
    if (isConnected && smartAccountAddress) {
      fetchPortfolio();
    }
  }, [isConnected, smartAccountAddress, fetchPortfolio]);

  if (!isConnected) return null;

  const tabStyle = (tab: string) => ({
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: activeTab === tab ? "600" : "400",
    color: activeTab === tab ? "#4338ca" : "#666",
    background: activeTab === tab ? "#e0e7ff" : "transparent",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer" as const,
  });

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>
          Wallet Portfolio
        </h2>
        <button
          onClick={fetchPortfolio}
          disabled={loading}
          style={{
            padding: "6px 14px",
            fontSize: "13px",
            color: "#4338ca",
            background: "#e0e7ff",
            border: "1px solid #c7d2fe",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "16px",
          background: "#f3f4f6",
          padding: "4px",
          borderRadius: "8px",
        }}
      >
        <button style={tabStyle("overview")} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button style={tabStyle("nfts")} onClick={() => setActiveTab("nfts")}>
          NFTs ({nftCount})
        </button>
        <button style={tabStyle("tokens")} onClick={() => setActiveTab("tokens")}>
          Tokens ({tokens.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fef2f2",
            borderRadius: "8px",
            border: "1px solid #fecaca",
            marginBottom: "12px",
          }}
        >
          <p style={{ fontSize: "13px", color: "#dc2626" }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && !ethBalance && (
        <div
          style={{
            textAlign: "center",
            padding: "32px",
            color: "#888",
            fontSize: "14px",
          }}
        >
          Fetching portfolio data from Alchemy...
        </div>
      )}

      {/* ─── Overview Tab ────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ETH Balances */}
          <div>
            <SectionHeader title="ETH Balance" />
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "16px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "10px",
                  color: "white",
                }}
              >
                <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "4px" }}>
                  Smart Account
                </p>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {ethBalance ?? "—"} ETH
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    opacity: 0.7,
                    marginTop: "4px",
                    wordBreak: "break-all",
                  }}
                >
                  {smartAccountAddress
                    ? shortenAddress(smartAccountAddress)
                    : "Loading..."}
                </p>
              </div>

              {signerAddress && signerAddress !== smartAccountAddress && (
                <div
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    padding: "16px",
                    background: "#f3f4f6",
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      marginBottom: "4px",
                    }}
                  >
                    {connectionType === "eoa" ? "EOA (MetaMask)" : "Signer"}
                  </p>
                  <p
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                      color: "#111",
                    }}
                  >
                    {signerEthBalance ?? "—"} ETH
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      marginTop: "4px",
                      wordBreak: "break-all",
                    }}
                  >
                    {shortenAddress(signerAddress)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "14px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "24px", fontWeight: "bold", color: "#166534" }}>
                {nftCount}
              </p>
              <p style={{ fontSize: "12px", color: "#22c55e" }}>NFTs Owned</p>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "14px",
                background: "#eff6ff",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "24px", fontWeight: "bold", color: "#1e40af" }}>
                {tokens.length}
              </p>
              <p style={{ fontSize: "12px", color: "#3b82f6" }}>ERC-20 Tokens</p>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "14px",
                background: "#faf5ff",
                borderRadius: "8px",
                border: "1px solid #e9d5ff",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "24px", fontWeight: "bold", color: "#7e22ce" }}>
                {connectionType === "eoa" ? "EIP-7702" : "ERC-4337"}
              </p>
              <p style={{ fontSize: "12px", color: "#a855f7" }}>Account Type</p>
            </div>
          </div>

          {/* NFT Preview (first 4) */}
          {nfts.length > 0 && (
            <div>
              <SectionHeader title="Recent NFTs" count={nftCount} />
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  paddingBottom: "8px",
                }}
              >
                {nfts.slice(0, 4).map((nft, i) => (
                  <NftCard key={`${nft.contract.address}-${nft.tokenId}-${i}`} nft={nft} />
                ))}
              </div>
              {nftCount > 4 && (
                <button
                  onClick={() => setActiveTab("nfts")}
                  style={{
                    marginTop: "8px",
                    fontSize: "13px",
                    color: "#4338ca",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  View all {nftCount} NFTs →
                </button>
              )}
            </div>
          )}

          {/* Tokens Preview */}
          {tokens.length > 0 && (
            <div>
              <SectionHeader title="Token Balances" count={tokens.length} />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {tokens.slice(0, 3).map((token) => (
                  <TokenRow key={token.contractAddress} token={token} />
                ))}
              </div>
              {tokens.length > 3 && (
                <button
                  onClick={() => setActiveTab("tokens")}
                  style={{
                    marginTop: "8px",
                    fontSize: "13px",
                    color: "#4338ca",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  View all {tokens.length} tokens →
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && nfts.length === 0 && tokens.length === 0 && ethBalance !== null && (
            <div
              style={{
                textAlign: "center",
                padding: "24px",
                color: "#888",
                fontSize: "14px",
                background: "#f9fafb",
                borderRadius: "8px",
              }}
            >
              No tokens or NFTs found. Mint some using the form below!
            </div>
          )}

          {/* API Info */}
          <div
            style={{
              padding: "12px",
              background: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #bae6fd",
            }}
          >
            <p style={{ fontSize: "12px", color: "#0369a1" }}>
              <strong>Powered by Alchemy APIs</strong> — ETH balance via{" "}
              <code style={{ fontSize: "11px" }}>eth_getBalance</code>, tokens via{" "}
              <code style={{ fontSize: "11px" }}>alchemy_getTokenBalances</code>, NFTs via{" "}
              <code style={{ fontSize: "11px" }}>getNFTsForOwner (v3)</code>
            </p>
          </div>
        </div>
      )}

      {/* ─── NFTs Tab ────────────────────────────────────────────── */}
      {activeTab === "nfts" && (
        <div>
          <SectionHeader title="All NFTs" count={nftCount} />
          {nfts.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {nfts.map((nft, i) => (
                <NftCard key={`${nft.contract.address}-${nft.tokenId}-${i}`} nft={nft} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: "#888",
                fontSize: "14px",
                background: "#f9fafb",
                borderRadius: "8px",
              }}
            >
              {loading ? "Loading NFTs..." : "No NFTs found for this address."}
            </div>
          )}
        </div>
      )}

      {/* ─── Tokens Tab ──────────────────────────────────────────── */}
      {activeTab === "tokens" && (
        <div>
          <SectionHeader title="ERC-20 Tokens" count={tokens.length} />

          {/* Native ETH */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #bae6fd",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#627eea",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "white",
                }}
              >
                Ξ
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#111" }}>
                  ETH
                </p>
                <p style={{ fontSize: "11px", color: "#888" }}>
                  Native Ether (Base Sepolia)
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#111",
                fontFamily: "monospace",
              }}
            >
              {ethBalance ?? "0"} ETH
            </p>
          </div>

          {tokens.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {tokens.map((token) => (
                <TokenRow key={token.contractAddress} token={token} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "24px",
                color: "#888",
                fontSize: "14px",
                background: "#f9fafb",
                borderRadius: "8px",
              }}
            >
              {loading
                ? "Loading tokens..."
                : "No ERC-20 tokens found for this address."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
