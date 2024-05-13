import { del, get, set } from 'idb-keyval'
import { http, createConfig, fallback, unstable_connector } from 'wagmi'
import { celo, mainnet, optimism, ronin, saigon, sepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

// biome-ignore lint/correctness/noUnusedVariables: <explanation>
const indexedDBStorage = {
  async getItem(name: string) {
    return get(name)
  },
  async setItem(name: string, value: string) {
    await set(name, value)
  },
  async removeItem(name: string) {
    await del(name)
  },
}

export const config = createConfig({
  chains: [mainnet, sepolia, optimism, celo, saigon, ronin],
  connectors: [
    walletConnect({
      projectId: import.meta.env.VITE_WC_PROJECT_ID,
    }),
    coinbaseWallet({ appName: 'Vite React Playground', darkMode: true }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
    [celo.id]: http(),
    [ronin.id]: unstable_connector(injected, { retryDelay: 1000 }),
    // [saigon.id]: unstable_connector(injected, { retryDelay: 1000 }),
    [saigon.id]: fallback([unstable_connector(injected)]),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
