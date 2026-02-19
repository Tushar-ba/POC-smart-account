/**
 * Alchemy REST API utilities for fetching wallet balances, tokens, and NFTs.
 * Uses direct HTTP calls to Alchemy's NFT API v3 and Token API.
 */

const API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const BASE_URL = `https://base-sepolia.g.alchemy.com`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NftItem {
  contract: {
    address: string;
    name: string | null;
    symbol: string | null;
    tokenType: string; // "ERC721" | "ERC1155"
  };
  tokenId: string;
  tokenType: string;
  name: string | null;
  description: string | null;
  image: {
    cachedUrl: string | null;
    thumbnailUrl: string | null;
    pngUrl: string | null;
    originalUrl: string | null;
  };
  balance: string;
}

export interface NftResponse {
  ownedNfts: NftItem[];
  totalCount: number;
  pageKey: string | null;
}

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string; // hex string
}

export interface TokenBalancesResponse {
  address: string;
  tokenBalances: TokenBalance[];
}

export interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  logo: string | null;
}

// ─── ETH Balance ─────────────────────────────────────────────────────────────

/**
 * Get native ETH balance for an address using eth_getBalance.
 */
export async function getEthBalance(address: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  // Convert hex wei to ETH string
  const weiHex = data.result as string;
  const wei = BigInt(weiHex);
  const ethValue = Number(wei) / 1e18;
  return ethValue.toFixed(6);
}

// ─── ERC-20 Token Balances ───────────────────────────────────────────────────

/**
 * Get all ERC-20 token balances for an address.
 * Uses alchemy_getTokenBalances with "erc20" filter.
 */
export async function getTokenBalances(
  address: string
): Promise<TokenBalance[]> {
  const res = await fetch(`${BASE_URL}/v2/${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getTokenBalances",
      params: [address, "erc20"],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const balances: TokenBalance[] = data.result?.tokenBalances ?? [];
  // Filter out zero balances
  return balances.filter(
    (b) => b.tokenBalance && b.tokenBalance !== "0x0" && b.tokenBalance !== "0x"
  );
}

/**
 * Get metadata for a token contract (name, symbol, decimals, logo).
 * Uses alchemy_getTokenMetadata.
 */
export async function getTokenMetadata(
  contractAddress: string
): Promise<TokenMetadata> {
  const res = await fetch(`${BASE_URL}/v2/${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getTokenMetadata",
      params: [contractAddress],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// ─── NFTs ────────────────────────────────────────────────────────────────────

/**
 * Get all NFTs owned by an address.
 * Uses Alchemy NFT API v3 getNFTsForOwner.
 */
export async function getNftsForOwner(
  ownerAddress: string,
  options?: {
    contractAddresses?: string[];
    pageKey?: string;
    pageSize?: number;
  }
): Promise<NftResponse> {
  const params = new URLSearchParams({
    owner: ownerAddress,
    withMetadata: "true",
    pageSize: String(options?.pageSize ?? 50),
  });

  if (options?.contractAddresses) {
    options.contractAddresses.forEach((addr) => {
      params.append("contractAddresses[]", addr);
    });
  }
  if (options?.pageKey) {
    params.set("pageKey", options.pageKey);
  }

  const res = await fetch(
    `${BASE_URL}/nft/v3/${API_KEY}/getNFTsForOwner?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`NFT API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

// ─── Enriched Token Data ─────────────────────────────────────────────────────

export interface EnrichedToken {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string; // human-readable
  rawBalance: string; // hex
  logo: string | null;
}

/**
 * Get token balances with metadata (name, symbol, decimals).
 * Fetches balances first, then metadata for each token.
 */
export async function getEnrichedTokenBalances(
  address: string
): Promise<EnrichedToken[]> {
  const balances = await getTokenBalances(address);

  if (balances.length === 0) return [];

  // Fetch metadata for all tokens in parallel
  const enriched = await Promise.all(
    balances.map(async (b) => {
      try {
        const meta = await getTokenMetadata(b.contractAddress);
        const decimals = meta.decimals ?? 18;
        const rawBigInt = BigInt(b.tokenBalance);
        const humanBalance =
          Number(rawBigInt) / Math.pow(10, decimals);

        return {
          contractAddress: b.contractAddress,
          name: meta.name ?? "Unknown Token",
          symbol: meta.symbol ?? "???",
          decimals,
          balance: humanBalance > 0.000001
            ? humanBalance.toFixed(6)
            : humanBalance.toExponential(2),
          rawBalance: b.tokenBalance,
          logo: meta.logo,
        };
      } catch {
        return {
          contractAddress: b.contractAddress,
          name: "Unknown",
          symbol: "???",
          decimals: 18,
          balance: "0",
          rawBalance: b.tokenBalance,
          logo: null,
        };
      }
    })
  );

  return enriched;
}
