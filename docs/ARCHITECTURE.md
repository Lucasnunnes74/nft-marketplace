# Arquitetura

## Camadas

```
UI (pages/, components/)         telas, estados loading/vazio/erro/sucesso, a11y
  └─ hooks/use-api.ts            TanStack Query: queries, mutations, otimismo, chaves
       └─ api/resources.ts       funções REST (Axios) + validação zod das respostas
            └─ api/client.ts     único cliente Axios: baseURL, timeout, token, X-Guest-Id, erros normalizados
realtime/socket.ts               Socket.IO client real → atualiza o cache do Query
mocks/ (MSW)                     API REST + servidor Socket.IO simulados (só aqui existem dados fictícios)
```

`src/api/contracts.ts` é a fonte única de tipos: schemas zod para REST e eventos; cliente, mocks e UI usam o
mesmo contrato (transporte ⇄ estado ⇄ interface).

## Estado

- **Servidor** → TanStack Query. **URL** → filtros/busca/ordenação/página do catálogo (`validateSearch` com zod,
  tolerante a valores inválidos). **Sessão** → `auth/session-store` (localStorage + `useSyncExternalStore`).
  **UI efêmera** → estado local e stores mínimas (`stores/`: toasts, avisos de mercado, cupom, status do socket).
- Chaves de cache incluem o `userId` quando o dado depende do usuário (ex.: `isFavorite`): nada é reaproveitado
  entre sessões.

## Política de cache e retries

| Item | Política |
| --- | --- |
| `staleTime` / `gcTime` | 30 s / 5 min |
| Retries (queries) | até 2, com backoff exponencial, **apenas** falhas transitórias (rede, timeout, 5xx); 4xx nunca |
| Retries (mutations) | nenhum automático (evita duplicar operações). Exceção controlada: criar pedido repete em timeout/rede com a **mesma** `Idempotency-Key` |
| Respostas obsoletas | cada query recebe `AbortSignal` (Axios cancela ao mudar filtros) + chave por parâmetros → a resposta de uma busca antiga nunca sobrescreve a atual (testável com latência "variável") |
| Paginação | `keepPreviousData` evita "piscar" ao trocar filtros |
| Foco da janela | refetch ao voltar à aba |

## Atualização otimista (com rollback)

- **Favoritos**: patch imediato em todos os caches (`nfts.*`, `favorites`); em erro restaura snapshots e avisa.
- **Quantidade e remoção no carrinho**: patch no carrinho; em erro restaura o snapshot; `onSettled` revalida
  carrinho e cotação. Valores monetários **não** são otimistas: total/descontos/taxas vêm sempre da cotação do servidor.

## Dinheiro

ETH trafega como **string decimal**; cálculos em `lib/eth.ts` usam `bigint` em wei (18 casas). Exibição com
`formatEth` (nunca arredonda em silêncio; o valor exato fica no `title`).

## Sessão

- Token + expiração persistidos; `SessionEffects` (dentro do roteador) reage a mudanças: cancela/limpa o cache,
  limpa avisos, reavalia guardas de rota e agenda a expiração local.
- Rotas privadas (`/checkout`, `/orders/:id`, `/profile`, `/wallets`): `beforeLoad` → `/login?redirect=<href>`;
  após login volta ao ponto exato (`safeRedirect` bloqueia open redirect).
- 401 em qualquer chamada encerra a sessão (interceptor Axios) e dispara o fluxo acima; o carrinho fica no servidor.
- Carrinho de visitante: id local (`X-Guest-Id`); ao logar/cadastrar o servidor **mescla** no carrinho do usuário.
- Logout/troca de usuário: cache limpo, socket reconectado com a nova sessão, listeners removidos.

## Tempo real (Socket.IO)

- `RealtimeBridge` mantém **uma** conexão por sessão (`connectRealtime` retorna `dispose`, que remove listeners e desconecta).
- `nft.updated`: aplica nos caches de detalhe/lista/destaques/favoritos; **ignora versões menores ou iguais**
  (duplicados/fora de ordem); invalida carrinho e cotação; se o NFT está no carrinho, gera aviso ao usuário.
- `realtime/nft-versions.ts` guarda o último evento por NFT e o **reaplica sobre respostas REST defasadas** (uma
  resposta que saiu do servidor antes do evento e chegou depois não faz o preço "voltar" ao valor antigo).
- `order.updated`: só aplica se `userId` é o da sessão atual e a versão é maior; refaz o pedido (recibo) e o carrinho.
- Reconexão: ao reconectar, as versões vistas são descartadas (o servidor pode ter reiniciado com versões menores) e
  `invalidateQueries({ refetchType: 'active' })` reconcilia o que está na tela com a REST, que passa a ser a referência.
- Rede de segurança: pedido pendente também faz polling (3 s) — o socket acelera, não é a única via.
- No navegador o servidor é simulado na camada de rede (MSW intercepta o WebSocket; `@mswjs/socket.io-binding`).
  O `engine.io-client` captura `globalThis.WebSocket` quando é avaliado, então o módulo do socket só é carregado
  (`import()` em `RealtimeBridge`) depois que o MSW iniciou. O `App` baixa em paralelo com o MSW, e `main.tsx` só
  renderiza depois que os dois estão prontos.

## Pedidos

`usePlaceOrder` guarda a `Idempotency-Key` por *conteúdo* (sessionStorage): duplo clique, timeout ou refresh reenviam
a mesma chave e recebem o mesmo pedido; se o usuário revisa um novo total, o conteúdo muda e uma nova chave é usada.
Mudança de preço (409 `PRICE_CHANGED`) exige marcar "Estou ciente do novo total" antes de confirmar de novo.
O recibo usa o *snapshot* do pedido (alterações posteriores no catálogo não o afetam).

## Acessibilidade e performance

Link "pular para o conteúdo", `Field` liga label/erro/dica por `id`, `role="alert"`/`aria-live` em erros e status,
foco visível, `prefers-reduced-motion`, botões de ícone com nome acessível, estados nunca só por cor.
Diálogos devolvem o foco a quem os abriu (`DialogContent`), pois são controlados por estado e não têm `Trigger`.
Skeletons usam shimmer (`.k-shimmer`), que para com movimento reduzido e preserva as dimensões do conteúdo.
Rotas com code-splitting (`lazyRouteComponent`), MSW e painel de simulação só entram no bundle com `VITE_ENABLE_MOCKS=true`,
o socket é carregado sob demanda, a fonte (Roboto Mono, `@fontsource`) é local e as imagens têm dimensões e `loading="lazy"`.
Resultados medidos e justificativas: [`AUDIT.md`](AUDIT.md).

## Limitações, decisões de UX e desvios do Figma

- **Tablet (768–1023 px).** O Figma só traz desktop e mobile. Nessa faixa o app usa o layout desktop adaptado: o
  catálogo passa a 2 colunas, o detalhe empilha galeria e informações e o rodapé quebra em grade; de 1024 px em
  diante o layout é o do Figma. As larguras 320, 390, 768 e 1440 px são verificadas sem rolagem horizontal em
  `tests/e2e/responsive.spec.ts`.
- **Perfil, carteiras e confirmação no mobile** não têm frame no Figma; seguem o padrão visual das demais telas mobile.
- **Fonte e imagens.** Roboto Mono é servida localmente (sem Google Fonts). As artes dos NFTs são WebP em 420 px e
  900 px exportados do Figma; os ícones são SVG exportados. O skeleton usa shimmer, que não está no Figma.
- **Ações fora do escopo** (páginas editoriais, suporte, atividade, ofertas, downloads) ficam como texto não
  interativo ("Em breve" no menu da conta, texto simples no rodapé) e não simulam sucesso. A newsletter é simulada e diz isso.
- **Transporte do tempo real.** O servidor Socket.IO é simulado no navegador pelo `@mswjs/socket.io-binding`; as
  limitações estão em [`API.md`](API.md). Como o estado vive no navegador, cada visitante tem o próprio banco simulado.
- **Preços na URL do catálogo** são strings decimais (parser de busca próprio em `search-schemas.ts`), nunca `number`.
- **Avatar** limitado a 150 KB e guardado como data URL na API simulada.
- **Performance.** A meta do desafio é 90; o app carrega o bundle de mocks (~140 KiB gzip) antes de renderizar, porque o
  build publicado precisa manter mocks e tempo real. O que ficou abaixo da meta e a causa estão em [`AUDIT.md`](AUDIT.md).
