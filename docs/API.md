# Contratos REST e eventos

Base: `/api` (interceptado por MSW). Autenticação: `Authorization: Bearer <token>`. Visitante: `X-Guest-Id`.
Erros: `{ "error": { "code", "message", "fields?", "details?" } }`.

| Status | Códigos |
| --- | --- |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED` |
| 403 | `FORBIDDEN` (ex.: conexão de carteira recusada) |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`, `PRICE_CHANGED`, `IDEMPOTENCY_CONFLICT`, `EMPTY_CART`, `WALLET_DISCONNECTED` |
| 422 | `VALIDATION_ERROR` (com `fields`) |
| 5xx | `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` |

## Recursos

| Recurso | Operações |
| --- | --- |
| Sessão e conta | `POST /session/signup` · `POST /session/login` · `GET /session` · `POST /session/logout` |
| Perfil | `PATCH /profile` (nome, e-mail, avatar) · `PUT /profile/password` |
| NFTs | `GET /nfts?q&category&minPrice&maxPrice&availableOnly&sort&page&pageSize` · `GET /nfts/:id` |
| Favoritos | `GET /favorites` · `POST /favorites {nftId}` · `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:nftId` · `DELETE /cart/items/:nftId` |
| Cotação | `POST /quote {couponCode?, network?}` → itens, subtotal, desconto, taxa de rede, total, cupom, `hasIssues` |
| Pedidos | `POST /orders` (+ `Idempotency-Key`) · `GET /orders/:id` |
| Carteiras | `GET /wallets` · `POST /wallets` · `PATCH /wallets/:id` · `POST /wallets/:id/connect` · `POST /wallets/:id/disconnect` |

Schemas completos: `src/api/contracts.ts`.

## Idempotência (`POST /orders`)

- Mesma chave + mesmo conteúdo → devolve o **mesmo pedido** (200).
- Mesma chave + conteúdo diferente → 409 `IDEMPOTENCY_CONFLICT`.
- O servidor revalida preço/estoque no momento da compra: total diferente do `expectedTotal` → 409 `PRICE_CHANGED`
  (com a nova cotação em `details.quote`); item sem estoque → 409 `OUT_OF_STOCK`.
- Pedido nasce `pending` e é liquidado (≈2,5 s) para `confirmed` (hash simulado) ou `rejected` (estoque devolvido, carrinho preservado).
  Só os itens/quantidades comprados saem do carrinho, e só na confirmação.

## Socket.IO

Servidor simulado em `wss://realtime.nft.local` (configurável por `VITE_SOCKET_URL`).

| Evento | Payload | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | `{ id, price, available, version, updatedAt }` | atualiza preço/estoque no catálogo, detalhe e carrinho |
| `order.updated` | `{ orderId, userId, status, version, updatedAt, txHash?, failureReason? }` | atualiza o estado do pedido e mostra confirmação/recusa |

Eventos duplicados ou com versão antiga são descartados; após reconexão o cliente reconcilia com a REST.

### Limitações do ambiente de mocks

`@mswjs/socket.io-binding` não implementa rooms/namespaces nem broadcast: o servidor simulado envia os eventos a todas
as conexões e o cliente filtra `order.updated` pelo `userId` da sessão. O ping do Engine.IO é emitido manualmente a cada 20 s.
Persistência do "banco" simulado em `localStorage` (sobrevive a refresh); `window.__mock.reset()` restaura o estado conhecido.

## Fixtures e cenários

Catálogo determinístico (30 NFTs, 2 esgotados, 1 com 2 unidades), 2 usuários, carteiras principal/secundária.
Cenários: sucesso, resultado vazio, latência variável, falhas (rede/4xx/5xx), sessão expirada, conflito de cadastro/validação,
cupom inválido/expirado, preço/estoque alterado durante a compra, timeout do pedido com recuperação idempotente,
pagamento confirmado/recusado, carteira recusa/desconecta.
