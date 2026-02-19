"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  useSignerStatus,
  useLogout,
  useUser,
  useSigner,
  useAlchemyAccountContext,
  useAuthModal,
} from "@account-kit/react";
import { useAccount, useWalletClient, useDisconnect } from "wagmi";
import { WalletClientSigner } from "@aa-sdk/core";
import {
  createSmartWalletClient,
  type SmartWalletClient,
} from "@account-kit/wallet-client";
import { alchemy, baseSepolia } from "@account-kit/infra";
import { type Hex } from "viem";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionType = "embedded" | "eoa";

interface UnifiedWalletContextValue {
  // Connection status
  isConnected: boolean;
  connectionType: ConnectionType | null;
  isLoading: boolean;

  // Addresses
  smartAccountAddress: string | undefined;
  signerAddress: string | undefined;

  // User info
  loginMethod: string;
  email: string | null;

  // Actions — unified for ALL wallet types via createSmartWalletClient
  signMessage: (message: string) => Promise<Hex>;
  sendGaslessTransaction: (params: {
    target: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  }) => Promise<string>;
  logout: () => void;

  // The single SmartWalletClient (works for both embedded + EOA)
  smartWalletClient: SmartWalletClient | null;

  // Error state
  error: string | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextValue | null>(
  null
);

// ─── Provider ────────────────────────────────────────────────────────────────
//
// Architecture:
//   1. User connects (email/passkey/Google OR MetaMask)
//   2. We get a signer from either path
//   3. We create ONE SmartWalletClient using createSmartWalletClient()
//   4. For EOA → EIP-7702: signer address = smart account (auto-delegates)
//   5. For Embedded → SCA: requestAccount() creates smart contract account
//   6. ALL transactions go through smartWalletClient.sendCalls() with paymaster
//   7. User just signs — gas is sponsored by Alchemy Gas Manager
//

export function UnifiedWalletProvider({ children }: PropsWithChildren) {
  const { config } = useAlchemyAccountContext();
  const wagmiConfig = config._internal.wagmiConfig;

  // --- Embedded wallet ---
  const signerStatus = useSignerStatus();
  const alchemyUser = useUser();
  const alchemySigner = useSigner();
  const { logout: alchemyLogout } = useLogout();

  // --- EOA wallet (wagmi) ---
  const { isConnected: eoaIsConnected, address: eoaAddress } = useAccount({
    config: wagmiConfig,
  });
  const { data: walletClient } = useWalletClient({ config: wagmiConfig });
  const { disconnect: wagmiDisconnect } = useDisconnect({
    config: wagmiConfig,
  });

  // --- Auth modal (close when EOA connects) ---
  const { closeAuthModal, isOpen: isAuthModalOpen } = useAuthModal();

  useEffect(() => {
    if (eoaIsConnected && isAuthModalOpen && !signerStatus.isConnected) {
      closeAuthModal();
    }
  }, [
    eoaIsConnected,
    isAuthModalOpen,
    signerStatus.isConnected,
    closeAuthModal,
  ]);

  // --- Single SmartWalletClient for ALL paths ---
  const [smartWalletClient, setSmartWalletClient] =
    useState<SmartWalletClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<
    string | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const setupRef = useRef<"idle" | "in-progress" | "done">("idle");

  // Determine which signer is available
  const hasEmbeddedSigner = signerStatus.isConnected && !!alchemySigner;
  const hasEoaSigner =
    eoaIsConnected && !!walletClient && !signerStatus.isConnected;

  // Create SmartWalletClient from whichever signer is available
  useEffect(() => {
    if (!hasEmbeddedSigner && !hasEoaSigner) {
      // No signer — reset
      if (!signerStatus.isConnected && !eoaIsConnected) {
        setSmartWalletClient(null);
        setSmartAccountAddress(undefined);
        setupRef.current = "idle";
      }
      return;
    }

    if (setupRef.current !== "idle") return;
    setupRef.current = "in-progress";

    const setup = async () => {
      setLoading(true);
      setWalletError(null);
      try {
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        const policyId = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;
        if (!apiKey || !policyId)
          throw new Error("Missing ALCHEMY_API_KEY or POLICY_ID env vars");

        const transport = alchemy({ apiKey });

        if (hasEoaSigner) {
          // ─── EOA Path (EIP-7702) ─────────────────────────────────
          // The EOA address itself becomes the smart account.
          // sendCalls() auto-detects if EIP-7702 delegation is needed
          // and bundles it with the first transaction. User just signs.
          // The paymaster sponsors ALL gas including the delegation tx.
          const signer = new WalletClientSigner(walletClient!, "external");

          const client = createSmartWalletClient({
            transport,
            chain: baseSepolia,
            signer,
            policyId,
            account: eoaAddress!, // EOA address = smart account address (EIP-7702)
          });

          setSmartWalletClient(client as unknown as SmartWalletClient);
          setSmartAccountAddress(eoaAddress!);
          console.log("SmartWalletClient created (EOA/EIP-7702):", eoaAddress);
        } else {
          // ─── Embedded Path (SCA) ─────────────────────────────────
          // Alchemy signer → requestAccount() creates a Smart Contract Account.
          // The signer manages keys, the SCA holds assets.
          const signer = alchemySigner as any; // AlchemySigner implements SmartAccountSigner

          const clientWithoutAccount = createSmartWalletClient({
            transport,
            chain: baseSepolia,
            signer,
            policyId,
          });

          const account = await clientWithoutAccount.requestAccount();
          console.log("SmartWalletClient created (Embedded/SCA):", account.address);

          const clientWithAccount = createSmartWalletClient({
            transport,
            chain: baseSepolia,
            signer,
            policyId,
            account: account.address,
          });

          setSmartWalletClient(clientWithAccount as unknown as SmartWalletClient);
          setSmartAccountAddress(account.address);
        }

        setupRef.current = "done";
      } catch (err: any) {
        console.error("Failed to create SmartWalletClient:", err);
        setWalletError(err.message || "Failed to create smart account");
        setupRef.current = "idle"; // allow retry
      } finally {
        setLoading(false);
      }
    };

    setup();
  }, [hasEmbeddedSigner, hasEoaSigner, alchemySigner, walletClient, eoaAddress]);

  // --- Connection type ---
  const connectionType: ConnectionType | null = useMemo(() => {
    if (signerStatus.isConnected) return "embedded";
    if (eoaIsConnected) return "eoa";
    return null;
  }, [signerStatus.isConnected, eoaIsConnected]);

  const isConnected = connectionType !== null;

  // --- Signer address ---
  const signerAddress = useMemo(() => {
    if (connectionType === "embedded") {
      return (
        (alchemySigner as any)?.inner?.address ??
        (alchemySigner as any)?.address ??
        undefined
      );
    }
    if (connectionType === "eoa") return eoaAddress;
    return undefined;
  }, [connectionType, alchemySigner, eoaAddress]);

  // --- User info ---
  const loginMethod = useMemo(() => {
    if (connectionType === "embedded") {
      if (alchemyUser?.email) return "Email";
      return "Passkey / Social";
    }
    if (connectionType === "eoa") return "External Wallet (MetaMask)";
    return "Not connected";
  }, [connectionType, alchemyUser]);

  const email = alchemyUser?.email ?? null;

  // --- Actions (unified — same code for both paths) ---

  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!smartWalletClient) throw new Error("Wallet not ready");
      return smartWalletClient.signMessage({ message });
    },
    [smartWalletClient]
  );

  const sendGaslessTransaction = useCallback(
    async (params: {
      target: `0x${string}`;
      data: `0x${string}`;
      value?: bigint;
    }): Promise<string> => {
      if (!smartWalletClient) throw new Error("Wallet not ready");

      const policyId = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID!;

      // sendCalls works the same for both paths:
      // - EOA: Alchemy auto-detects if EIP-7702 delegation is needed
      // - Embedded: sends through the SCA
      // - Paymaster sponsors all gas in both cases
      const result = await smartWalletClient.sendCalls({
        from: smartAccountAddress as `0x${string}`,
        calls: [
          {
            to: params.target,
            data: params.data,
            value: params.value
              ? (`0x${params.value.toString(16)}` as Hex)
              : ("0x0" as Hex),
          },
        ],
        capabilities: {
          paymasterService: { policyId },
        },
      });

      // Wait for on-chain confirmation
      const status = await smartWalletClient.waitForCallsStatus({
        id: result.id,
        timeout: 60_000,
      });

      const receipt = (status as any)?.receipts?.[0];
      return receipt?.transactionHash ?? result.id;
    },
    [smartWalletClient]
  );

  const logout = useCallback(() => {
    if (connectionType === "embedded") {
      alchemyLogout();
    }
    if (connectionType === "eoa") {
      wagmiDisconnect();
    }
    setSmartWalletClient(null);
    setSmartAccountAddress(undefined);
    setupRef.current = "idle";
  }, [connectionType, alchemyLogout, wagmiDisconnect]);

  const value: UnifiedWalletContextValue = useMemo(
    () => ({
      isConnected,
      connectionType,
      isLoading: loading,
      smartAccountAddress,
      signerAddress,
      loginMethod,
      email,
      signMessage,
      sendGaslessTransaction,
      logout,
      smartWalletClient,
      error: walletError,
    }),
    [
      isConnected,
      connectionType,
      loading,
      smartAccountAddress,
      signerAddress,
      loginMethod,
      email,
      signMessage,
      sendGaslessTransaction,
      logout,
      smartWalletClient,
      walletError,
    ]
  );

  return (
    <UnifiedWalletContext.Provider value={value}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUnifiedWallet() {
  const ctx = useContext(UnifiedWalletContext);
  if (!ctx) {
    throw new Error(
      "useUnifiedWallet must be used inside UnifiedWalletProvider"
    );
  }
  return ctx;
}
