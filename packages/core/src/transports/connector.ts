import {
  ChainDisconnectedError,
  type EIP1193Parameters,
  type EIP1193Provider,
  type EIP1193RequestFn,
  ProviderDisconnectedError,
  type TransportConfig,
  type WalletRpcSchema,
  createTransport,
  hexToNumber,
  withRetry,
  withTimeout,
} from 'viem'

import type { Connector, Transport } from '../createConfig.js'

export type ConnectorTransportConfig = {
  /** The key of the transport. */
  key?: TransportConfig['key'] | undefined
  /** The name of the transport. */
  name?: TransportConfig['name'] | undefined
  /** The max number of times to retry. */
  retryCount?: TransportConfig['retryCount'] | undefined
  /** The base delay (in ms) between retries. */
  retryDelay?: TransportConfig['retryDelay'] | undefined
  preferCurrentConnector?: boolean
}

export type ConnectorTransport = Transport

export function unstable_connector(
  connector: Pick<Connector, 'type'>,
  config: ConnectorTransportConfig = {},
): Transport {
  const { type } = connector
  const {
    key = 'connector',
    name = 'Connector',
    retryDelay,
    preferCurrentConnector = true,
  } = config

  return (parameters) => {
    const { chain, connectors, store } = parameters
    const retryCount = config.retryCount ?? parameters.retryCount

    const request: EIP1193RequestFn = async ({ method, params }) => {
      let connector: Connector | undefined

      const storeState = store?.getState()

      if (preferCurrentConnector && storeState?.current) {
        connector = storeState.connections.get(storeState.current)?.connector
      }

      connector =
        connector ?? connectors?.getState().find((c) => c.type === type)
      if (!connector)
        throw new ProviderDisconnectedError(
          new Error(
            `Could not find connector of type "${type}" in \`connectors\` passed to \`createConfig\`.`,
          ),
        )

      const provider = (await connector.getProvider({
        chainId: chain?.id,
      })) as EIP1193Provider | undefined
      if (!provider)
        throw new ProviderDisconnectedError(
          new Error('Provider is disconnected.'),
        )

      // We are applying a retry & timeout strategy here as some injected wallets (e.g. MetaMask) fail to
      // immediately resolve a JSON-RPC request on page load.
      const chainId = hexToNumber(
        await withRetry(() =>
          withTimeout(() => provider.request({ method: 'eth_chainId' }), {
            timeout: 100,
          }),
        ),
      )
      if (chain && chainId !== chain.id)
        throw new ChainDisconnectedError(
          new Error(
            `The current chain of the connector (id: ${chainId}) does not match the target chain for the request (id: ${chain.id} – ${chain.name}).`,
          ),
        )

      if (!params) {
        params = []
      }

      const body = { method, params } as EIP1193Parameters<WalletRpcSchema>
      return provider.request(body)
    }

    return createTransport({
      key,
      name,
      request,
      retryCount,
      retryDelay,
      type: 'connector',
    })
  }
}
