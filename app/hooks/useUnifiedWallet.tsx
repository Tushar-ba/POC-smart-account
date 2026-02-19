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
  useSmartAccountClient,
  useSignerStatus,
  useLogout,
  useUser,
  useSigner,
  useSendUserOperation,
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
import { hashMessage, type Hex } from "viem";

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

  // Actions
  signMessage: (message: string) => Promise<Hex>;
  sendGaslessTransaction: (params: {
    target: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  }) => Promise<string>; // returns tx hash or call ID
  logout: () => void;

  // For advanced use: the raw clients
  smartAccountClient: any | undefined; // embedded path
  smartWalletClient: SmartWalletClient<`0x${string}`> | null; // EOA path

  // Error state
  error: string | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function UnifiedWalletProvider({ children }: PropsWithChildren) {
  const { config } = useAlchemyAccountContext();
  const wagmiConfig = config._internal.wagmiConfig;

  // --- Embedded wallet path ---
  const signerStatus = useSignerStatus();
  const { client: embeddedClient } = useSmartAccountClient({});
  const alchemyUser = useUser();
  const alchemySigner = useSigner();
  const { logout: alchemyLogout } = useLogout();

  // --- EOA path (wagmi) ---
  const { isConnected: eoaIsConnected, address: eoaAddress } = useAccount({
    config: wagmiConfig,
  });
  const { data: walletClient } = useWalletClient({ config: wagmiConfig });
  const { disconnect: wagmiDisconnect } = useDisconnect({ config: wagmiConfig });

  // --- Auth modal (close when EOA connects) ---
  const { closeAuthModal, isOpen: isAuthModalOpen } = useAuthModal();

  // Auto-close the auth modal when EOA connects
  useEffect(() => {
    if (eoaIsConnected && isAuthModalOpen && !signerStatus.isConnected) {
      // EOA just connected through the auth modal — close it
      closeAuthModal();
    }
  }, [eoaIsConnected, isAuthModalOpen, signerStatus.isConnected, closeAuthModal]);

  // --- Smart Wallet Client for EOA ---
  const [smartWalletClient, setSmartWalletClient] = useState<SmartWalletClient<`0x${string}`> | null>(null);
  const [eoaSmartAccountAddress, setEoaSmartAccountAddress] = useState<string | undefined>();
  const [eoaLoading, setEoaLoading] = useState(false);
  const [eoaError, setEoaError] = useState<string | null>(null);
  const setupRef = useRef(false);

  // Create SmartWalletClient when EOA connects
  useEffect(() => {
    if (!eoaIsConnected || !walletClient || signerStatus.isConnected) {
      // If embedded wallet is connected, or EOA disconnected, reset EOA state
      if (!eoaIsConnected) {
        setSmartWalletClient(null);
        setEoaSmartAccountAddress(undefined);
        setupRef.current = false;
      }
      return;
    }

    // Already set up or in progress
    if (setupRef.current) return;
    setupRef.current = true;

    const setup = async () => {
      setEoaLoading(true);
      setEoaError(null);
      try {
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        const policyId = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;

        if (!apiKey || !policyId) {
          throw new Error("Missing ALCHEMY_API_KEY or POLICY_ID env vars");
        }

        const signer = new WalletClientSigner(walletClient, "external");
        const transport = alchemy({ apiKey });

        // Create initial client without account
        const clientWithoutAccount = createSmartWalletClient({
          transport,
          chain: baseSepolia,
          signer,
          policyId,
        });

        // Request the smart account (creates or retrieves existing)
        const account = await clientWithoutAccount.requestAccount();
        console.log("EOA Smart Account created:", account.address);

        // Create client with account attached
        const clientWithAccount = createSmartWalletClient({
          transport,
          chain: baseSepolia,
          signer,
          policyId,
          account: account.address,
        });

        setSmartWalletClient(clientWithAccount);
        setEoaSmartAccountAddress(account.address);
      } catch (err: any) {
        console.error("Failed to create smart wallet for EOA:", err);
        setEoaError(err.message || "Failed to create smart account");
        setupRef.current = false;
      } finally {
        setEoaLoading(false);
      }
    };

    setup();
  }, [eoaIsConnected, walletClient, signerStatus.isConnected]);

  // --- Determine connection type ---
  const connectionType: ConnectionType | null = useMemo(() => {
    if (signerStatus.isConnected) return "embedded";
    if (eoaIsConnected) return "eoa";
    return null;
  }, [signerStatus.isConnected, eoaIsConnected]);

  const isConnected = connectionType !== null;

  const isLoading = useMemo(() => {
    if (connectionType === "eoa") return eoaLoading;
    return false;
  }, [connectionType, eoaLoading]);

  // --- Addresses ---
  const smartAccountAddress = useMemo(() => {
    if (connectionType === "embedded") {
      return embeddedClient?.account?.address;
    }
    if (connectionType === "eoa") {
      return eoaSmartAccountAddress;
    }
    return undefined;
  }, [connectionType, embeddedClient, eoaSmartAccountAddress]);

  const signerAddress = useMemo(() => {
    if (connectionType === "embedded") {
      return (
        (alchemySigner as any)?.inner?.address ??
        (alchemySigner as any)?.address ??
        undefined
      );
    }
    if (connectionType === "eoa") {
      return eoaAddress;
    }
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

  // --- Actions ---
  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (connectionType === "embedded" && embeddedClient) {
        return embeddedClient.signMessage({ message });
      }
      if (connectionType === "eoa" && smartWalletClient) {
        const signerAddr = eoaAddress;
        if (!signerAddr) throw new Error("No EOA address");
        return smartWalletClient.signMessage({
          message,
          account: signerAddr,
        });
      }
      throw new Error("No wallet connected");
    },
    [connectionType, embeddedClient, smartWalletClient, eoaAddress]
  );

  const sendGaslessTransaction = useCallback(
    async (params: {
      target: `0x${string}`;
      data: `0x${string}`;
      value?: bigint;
    }): Promise<string> => {
      if (connectionType === "eoa" && smartWalletClient) {
        const signerAddr = eoaAddress;
        if (!signerAddr) throw new Error("No EOA address");

        // Use the SmartWalletClient sendCalls method
        // Account is already set on the client, so no 'from' needed
        const result = await smartWalletClient.sendCalls({
          calls: [
            {
              to: params.target,
              data: params.data,
              value: params.value ? `0x${params.value.toString(16)}` as Hex : "0x0" as Hex,
            },
          ],
          capabilities: {
            paymasterService: {
              policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID!,
            },
          },
        });

        // Wait for the calls to be mined
        const status = await smartWalletClient.waitForCallsStatus({
          id: result.id,
          timeout: 60_000,
        });

        // Return the tx hash from receipts if available
        const receipt = (status as any)?.receipts?.[0];
        return receipt?.transactionHash ?? result.id;
      }

      // For embedded wallet, we throw here — caller should use useSendUserOperation directly
      throw new Error("Use useSendUserOperation hook for embedded wallets");
    },
    [connectionType, smartWalletClient, eoaAddress]
  );

  const logout = useCallback(() => {
    if (connectionType === "embedded") {
      alchemyLogout();
    }
    if (connectionType === "eoa") {
      wagmiDisconnect();
      setSmartWalletClient(null);
      setEoaSmartAccountAddress(undefined);
      setupRef.current = false;
    }
  }, [connectionType, alchemyLogout, wagmiDisconnect]);

  const error = eoaError;

  const value: UnifiedWalletContextValue = useMemo(
    () => ({
      isConnected,
      connectionType,
      isLoading,
      smartAccountAddress,
      signerAddress,
      loginMethod,
      email,
      signMessage,
      sendGaslessTransaction,
      logout,
      smartAccountClient: embeddedClient,
      smartWalletClient,
      error,
    }),
    [
      isConnected,
      connectionType,
      isLoading,
      smartAccountAddress,
      signerAddress,
      loginMethod,
      email,
      signMessage,
      sendGaslessTransaction,
      logout,
      embeddedClient,
      smartWalletClient,
      error,
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
    throw new Error("useUnifiedWallet must be used inside UnifiedWalletProvider");
  }
  return ctx;
}
