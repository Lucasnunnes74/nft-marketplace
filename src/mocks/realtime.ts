import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { socketEvents, type NftUpdatedEvent, type OrderUpdatedEvent } from '@/api/contracts'

/**
 * Servidor Socket.IO simulado, na camada de rede via MSW.
 *
 * O cliente real (`socket.io-client`) conecta normalmente; este handler
 * intercepta a conexão WebSocket e fala o protocolo Socket.IO por meio de
 * `@mswjs/socket.io-binding`. Limitações no ambiente de mocks:
 *  - sem rooms/namespaces: eventos são enviados a todas as conexões e o
 *    cliente filtra `order.updated` pelo `userId` da sessão;
 *  - o ping do Engine.IO é emitido manualmente a cada 20s.
 */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.nft.local'

const link = ws.link(`${SOCKET_URL}/*`)

type Conn = ReturnType<typeof toSocketIo>
const connections = new Set<Conn>()

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    connections.add(io)
    // Engine.IO v4: o servidor envia ping ("2"); o cliente responde pong.
    const ping = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        /* conexão já encerrada */
      }
    }, 20_000)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(io)
    })
  }),
]

export function emitNftUpdated(payload: NftUpdatedEvent) {
  for (const io of connections) io.client.emit(socketEvents.nftUpdated, payload)
}

export function emitOrderUpdated(payload: OrderUpdatedEvent) {
  for (const io of connections) io.client.emit(socketEvents.orderUpdated, payload)
}

/** Útil para testes: derruba todas as conexões para exercitar a reconexão do cliente. */
export function dropConnections() {
  for (const io of connections) io.rawClient.close(1012, 'mock restart')
  connections.clear()
}

export function connectionCount() {
  return connections.size
}
