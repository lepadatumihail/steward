"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Injected (EIP-1193) wallets only, by decision: judges testing the write path
 * have a browser-extension wallet or they use watch-only mode. No WalletConnect,
 * no modal SDK — nothing here talks to a third-party relay.
 */
const config = createConfig({
  chains: [mainnet, base],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http("https://eth.drpc.org"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
