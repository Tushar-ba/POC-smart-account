import { parseAbi } from "viem";

// MusicalToken contract address on Base Sepolia - update after deployment
export const MUSICAL_TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_MUSICAL_TOKEN_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

// ABI for MusicalToken contract - mintAndList and related functions
export const MUSICAL_TOKEN_ABI = parseAbi([
  // Core functions
  "function mintAndList(address _tokenOwner, uint256 _amount, string _tokenURI, uint256 _price, uint256 _airdropAmount, address[] _recipients, uint256[] _percentages) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function uri(uint256 _tokenId) view returns (string)",
  "function nextTokenId() view returns (uint256)",
  "function owner() view returns (address)",

  // Royalty info
  "function getRoyaltyInfo(uint256 _tokenId) view returns (address[] recipients, uint256[] percentages)",
  "function tokenRoyaltyManager(uint256 tokenId) view returns (address)",

  // Royalty management
  "function updateRoyaltyRecipients(uint256 _tokenId, address[] _recipients, uint256[] _percentages) external",
  "function transferRoyaltyManagement(uint256 _tokenId, address _newManager) external",

  // Marketplace
  "function marketplace() view returns (address)",
  "function setMarketplaceContractAddress(address _marketplace) external",
] as const);

// IMusicalMarketplace - for marketplace interactions
export const MARKETPLACE_ABI = parseAbi([
  "function listNFT(address _tokenOwner, uint256 _tokenId, uint256 _price, uint256 _amount) external",
  "function registerAirdrop(address _tokenOwner, uint256 _tokenId, uint256 _amount) external",
] as const);
