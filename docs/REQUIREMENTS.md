# Requisitos do desafio: rastreabilidade

Checklist item a item do README do desafio (`junglegaming/frontend-challenge`), com a evidência de cada um.
Resultados medidos de Playwright e Lighthouse, com versões e ambiente, estão em [`AUDIT.md`](AUDIT.md).

Legenda: ✅ implementado e coberto por teste executado · 🟡 implementado, com cobertura parcial ou só manual · ⚠️ limitação ou lacuna conhecida.

## 1–2. Escopo e stack obrigatória

| Tecnologia | Onde é usada de fato | Status |
| --- | --- | --- |
| React + TypeScript | `src/**` (`tsc -b` limpo, app e testes) | ✅ |
| TanStack Router | rotas, parâmetros de busca validados com zod e guardas privadas (`src/router.tsx`, `src/search-schemas.ts`) | ✅ |
| TanStack Query | todas as consultas e mutations (`src/hooks/use-api.ts`, chaves em `src/api/keys.ts`) | ✅ |
| Axios | único cliente HTTP, com interceptors e `ApiError` (`src/api/client.ts`) | ✅ |
| Socket.IO | `socket.io-client` real (`src/realtime/socket.ts`) | ✅ |
| Tailwind + shadcn/ui | `src/components/ui/*`, `components.json`, tokens em `src/index.css` | ✅ |
| MSW (+ `@mswjs/socket.io-binding`) | REST e WebSocket simulados em `src/mocks/*` | ✅ |
| Playwright | E2E e regressão visual em `tests/e2e/*` | ✅ |
| Lighthouse | `lighthouserc.mobile.json`, `lighthouserc.desktop.json`, relatórios em `docs/lighthouse/` | ✅ |

## 3. Telas e fluxos

| Requisito | Evidência | Status |
| --- | --- | --- |
| Início, Detalhes, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil e Carteiras | `src/pages/*`; E2E nos dois viewports | ✅ |
| Desktop e mobile conforme os frames do Figma | `useIsDesktop()` escolhe o layout; baselines de início, detalhe, carrinho, pagamento e login | ✅ |
| Tablet (768–1023 px), sem frame no Figma | layout adaptado, sem rolagem horizontal em 320, 390, 768 e 1440 px (`tests/e2e/responsive.spec.ts`); desvio registrado em `ARCHITECTURE.md` | ⚠️ |
| Perfil, carteiras e confirmação em mobile | `tests/e2e/account.spec.ts` e `checkout.spec.ts` rodam em desktop e mobile | ✅ |
| Fora do escopo (editoriais, suporte, atividade, ofertas, downloads) sem parecer sucesso | itens "Em breve" e texto simples no rodapé | ✅ |

### 3.1 Catálogo e detalhe

| Requisito | Evidência | Status |
| --- | --- | --- |
| Busca, filtros, ordenação e paginação na URL, com refresh e histórico | `catalog.spec.ts` (refresh, voltar do histórico) | ✅ |
| Filtros combináveis; mudar filtro reinicia a paginação | `catalog.spec.ts` | ✅ |
| Preços na URL como string decimal (sem `number`) | `src/search-schemas.ts`, `tests/unit/search.test.ts` | ✅ |
| Resultado vazio e falha com nova tentativa | `catalog.spec.ts` (estado vazio; erro com retry) | ✅ |
| Respostas fora de ordem | `latency: 'variable'` + cancelamento por `AbortSignal`; sem teste dedicado de ordem | 🟡 |
| Detalhe: acesso direto, NFT inexistente, esgotado, limite de quantidade | `catalog.spec.ts`; limite em `tests/integration/api.test.ts` | ✅ |
| Favoritos persistidos por usuário, com falha e recuperação | `catalog.spec.ts` (persistência após refresh; falha 500 reverte e repete) | ✅ |

### 3.2 Carrinho

| Requisito | Evidência | Status |
| --- | --- | --- |
| Adicionar, alterar e remover respeitando disponibilidade | `checkout.spec.ts` | ✅ |
| Persistir após refresh e preservar itens do visitante ao autenticar | `checkout.spec.ts` | ✅ |
| Cupom válido, inválido e expirado | `checkout.spec.ts` | ✅ |
| Subtotal, desconto, taxa de rede e total coerentes com a API | cotação no servidor simulado; `tests/integration/api.test.ts` | ✅ |
| Preço e disponibilidade em tempo real com o carrinho aberto | `realtime.spec.ts` (aviso e total recalculado) | ✅ |
| ETH como string decimal, cálculos em `bigint` | `src/lib/eth.ts`, `tests/unit/eth.test.ts` | ✅ |

### 3.3 Pagamento e confirmação

| Requisito | Evidência | Status |
| --- | --- | --- |
| Validação dos campos e revisão antes do envio | `src/pages/checkout.tsx`; exige carteira conectada (`checkout.spec.ts`) | ✅ |
| Carteiras cadastradas, rede, conexão, recusa e desconexão | `checkout.spec.ts` | ✅ |
| Revalidar preço, disponibilidade, cupom e taxas; mudança exige nova confirmação | `checkout.spec.ts` (preço muda; item esgota) | ✅ |
| Sem pedido duplicado em clique repetido ou reenvio após timeout | `Idempotency-Key` por conteúdo; `checkout.spec.ts` (timeout) e `api.test.ts` (mesma chave, mesmo pedido; conteúdo diferente, conflito) | ✅ |
| Estados pendente, confirmado e recusado, com recuperação após refresh ou reconexão | `checkout.spec.ts` (recarregar pendente; socket cai com pedido pendente) | ✅ |
| Confirmação só quando a simulação confirma | `checkout.spec.ts` | ✅ |
| Falha preserva itens; sucesso remove só o comprado | `checkout.spec.ts` (recusa mantém o carrinho); `api.test.ts` (confirmado remove só o que foi comprado) | ✅ |
| Recibo é snapshot do pedido | `serializeOrder` guarda os itens; sem teste que altere o catálogo depois | 🟡 |

### 3.4 Conta e sessão

| Requisito | Evidência | Status |
| --- | --- | --- |
| Cadastro, login, logout e sessão integrados à API simulada | `account.spec.ts`, `api.test.ts` | ✅ |
| Rotas privadas (checkout, perfil, carteiras, favoritos, pedidos) | `beforeLoad` em `router.tsx`; `account.spec.ts` | ✅ |
| Sessão recuperável após refresh | `account.spec.ts` | ✅ |
| Expiração durante a navegação e no checkout, retomando o contexto | `account.spec.ts`, `checkout.spec.ts` | ✅ |
| Logout e troca de usuário limpam cache e subscriptions | `account.spec.ts` (sem vazar carrinho nem favoritos), `realtime.test.ts` | ✅ |
| Validação de cadastro, perfil, senha e carteiras, incluindo erros da API | `account.spec.ts` | ✅ |
| Alterações permanecem após refresh | `account.spec.ts` | ✅ |
| Credenciais fictícias; senha nunca em texto puro | o banco simulado guarda só SHA-256 com sal (`src/mocks/password.ts`); `tests/unit/password.test.ts` | ✅ |

## 4. Integração e estado

| Requisito | Evidência | Status |
| --- | --- | --- |
| Toda chamada REST passa pelo Axios | `src/api/client.ts` | ✅ |
| Contratos tipados entre transporte, estado e interface | `src/api/contracts.ts` (zod) | ✅ |
| Estados de carregamento, vazio, erro, sucesso e atualização em segundo plano | todas as telas; `a11y.spec.ts` (skeleton e recuperação) | ✅ |
| Invalidação coerente após mutations e eventos | `use-api.ts`, `socket.ts` | ✅ |
| Cancelamento ou descarte de respostas obsoletas | `AbortSignal` nas queries; `nft-versions.ts` corrige respostas REST defasadas | ✅ |
| Isolamento por usuário e por parâmetros | `userId` nas chaves de cache | ✅ |
| Recuperação de falhas sem duplicar operações | mutations sem retry; pedido idempotente | ✅ |
| Rotas inexistentes e acesso direto a qualquer tela | `NotFoundState`; `catalog.spec.ts` | ✅ |
| Atualização otimista com rollback | favoritos e carrinho (`catalog.spec.ts`, `tests/ui/app.test.tsx`) | ✅ |
| Política de cache, retries e sincronização documentada | `ARCHITECTURE.md` | ✅ |

## 5. Contratos REST

Documentados em [`API.md`](API.md) e implementados como schemas zod, que validam toda resposta (`src/api/resources.ts`).

| Recurso | Status |
| --- | --- |
| Sessão e conta (cadastro, login, consulta, logout, expiração) | ✅ |
| NFTs (busca, filtros, ordenação, paginação; detalhe) | ✅ |
| Favoritos (consulta, inclusão, remoção) | ✅ |
| Carrinho (consulta, inclusão, alteração, remoção) | ✅ |
| Cotação (cupom, disponibilidade, descontos, taxas, total) | ✅ |
| Pedidos idempotentes (criação, estado e recibo) | ✅ |
| Perfil (dados, avatar, senha) e carteiras | ✅ |
| Erros: validação, sessão inválida, permissão, inexistente, conflito, falha transitória | ✅ |

## 6. Mocking com MSW

| Requisito | Evidência | Status |
| --- | --- | --- |
| Mocks na camada de rede; nenhuma resposta fictícia em componentes, hooks ou Axios | todo dado simulado em `src/mocks/*` | ✅ |
| Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos | `src/mocks/db.ts` | ✅ |
| Persistência local para refresh; reset restaura um cenário conhecido | `localStorage`; "Resetar dados" / `window.__mock.reset()` | ✅ |
| Latência lenta e variável, timeouts | `src/mocks/scenario.ts`; `a11y.spec.ts` (carregamento lento) | ✅ |
| Falha de conexão e respostas HTTP 4xx/5xx | `catalog.spec.ts`; `api.test.ts` | ✅ |
| Sessão expirada e acesso não autorizado | `account.spec.ts` | ✅ |
| Conflito de cadastro ou validação | `account.spec.ts` | ✅ |
| Cupom inválido ou expirado | `checkout.spec.ts` | ✅ |
| Preço alterado ou edição esgotada durante a compra | `checkout.spec.ts` | ✅ |
| Timeout após criar o pedido, com recuperação por idempotência | `checkout.spec.ts` | ✅ |
| Pagamento confirmado e recusado | `checkout.spec.ts` | ✅ |
| Fixtures variadas e pelo menos dois usuários | `demo@nft.test` e `ana@nft.test` | ✅ |
| Eventos via MSW com `socket.io-client` real (`@mswjs/socket.io-binding`), transporte e limitações documentados | `src/mocks/realtime.ts`; `API.md` | ✅ |
| Mocks ativados por configuração e presentes no build de demonstração | `VITE_ENABLE_MOCKS` | ✅ |

## 7. Tempo real com Socket.IO

| Requisito | Evidência | Status |
| --- | --- | --- |
| `nft.updated` atualiza catálogo, detalhe e carrinho | `realtime.spec.ts`, `realtime.test.ts` | ✅ |
| `order.updated` atualiza o pedido e mostra confirmação ou recusa | `realtime.test.ts`; `checkout.spec.ts` | ✅ |
| Evento com identidade estável, recurso e versão | `src/api/contracts.ts` | ✅ |
| Tolera duplicados e eventos antigos | `realtime.test.ts`, `tests/unit/nft-versions.test.ts`; E2E usa versões crescentes (o descarte do antigo é provado na integração) | 🟡 |
| Reconciliar com a REST após reconexão | `realtime.spec.ts` (derrubar o socket), `realtime.test.ts` | ✅ |
| Eventos de outro usuário ou de sessão anterior não atualizam o cliente | `realtime.test.ts` ("só atualiza o usuário dono do pedido"); `account.spec.ts` (troca de usuário) | ✅ |
| Liberar listeners e subscriptions | `dispose` em `socket.ts`; `realtime.test.ts` | ✅ |
| Cenário obrigatório: preço muda com o NFT no carrinho; checkout impede confirmar cotação desatualizada | `realtime.spec.ts` e `checkout.spec.ts` | ✅ |
| Conexão cai com pedido pendente; ao reconectar ou recarregar, sem nova compra | `checkout.spec.ts` | ✅ |
| Pedidos confirmados e recusados são estados terminais | `realtime.test.ts` (evento antigo não regride um pedido confirmado); `api.test.ts` (confirmado e recusado) | ✅ |

## 8. Interface, responsividade e acessibilidade

| Requisito | Evidência | Status |
| --- | --- | --- |
| Fidelidade visual ao Figma | tokens e assets exportados do Figma; baselines versionadas são da própria implementação, sem comparação automática com o arquivo do Figma | 🟡 |
| Larguras 390, 768 e 1440 px (e 320 px como proxy de zoom) sem overflow horizontal | `responsive.spec.ts` | ✅ |
| Skeletons com shimmer em catálogo, detalhe e carrinho, sem deslocar o layout | `a11y.spec.ts` | ✅ |
| Movimento reduzido | `a11y.spec.ts`; `src/index.css` | ✅ |
| Navegação por teclado e foco visível | `a11y.spec.ts` ("pular para o conteúdo", contorno de foco) | ✅ |
| Foco em diálogos: entra, fica preso, Esc fecha e devolve ao gatilho | `a11y.spec.ts` | ✅ |
| Labels e erros associados aos campos | `a11y.spec.ts`; componente `FormField` | ✅ |
| Feedback acessível para mutations e tempo real | toaster com `aria-live`; avisos de mercado e erros com `role="alert"` (`Alert`) | ✅ |
| Texto alternativo em imagens relevantes; estados que não dependem só de cor | revisão de código; Lighthouse de acessibilidade ≥ 95 | 🟡 |
| Fontes e imagens acessíveis na execução local | fonte em `public/fonts`, artes em `public/figma` | ✅ |

## 9. Testes com Playwright

| # | Fluxo exigido | Spec | Status |
| --- | --- | --- | --- |
| 1 | Busca, filtros, ordenação, paginação e histórico | `catalog.spec.ts` | ✅ |
| 2 | Acesso direto ao detalhe e recurso inexistente | `catalog.spec.ts` | ✅ |
| 3 | Cadastro, login, expiração, logout e troca de usuário | `account.spec.ts` | ✅ |
| 4 | Favoritos, com falha de mutation e recuperação | `catalog.spec.ts` | ✅ |
| 5 | Carrinho: quantidades, remoção, cupom, refresh e login | `checkout.spec.ts` | ✅ |
| 6 | Compra completa até o recibo | `checkout.spec.ts` | ✅ |
| 7 | Falha de pagamento, clique repetido e timeout com o mesmo pedido | `checkout.spec.ts` (clique repetido coberto pela idempotência em `api.test.ts`) | 🟡 |
| 8 | Perfil, avatar, senha e carteiras, com erros de validação | `account.spec.ts` | ✅ |
| 9 | Preço ou disponibilidade via Socket.IO durante o checkout | `realtime.spec.ts`, `checkout.spec.ts` | ✅ |
| 10 | Eventos duplicados ou antigos, desconexão e pedido pendente | `realtime.spec.ts`, `checkout.spec.ts` | ✅ |
| 11 | Teclado, foco em diálogos e validação de formulários | `a11y.spec.ts` | ✅ |
| 12 | Skeletons em carregamento lento, falha e nova tentativa | `a11y.spec.ts`, `catalog.spec.ts` | ✅ |

- Chromium em desktop (1440×900) e mobile (Pixel 7); cada teste parte de um estado isolado (`resetApp`).
- Regressão visual de início, detalhe, carrinho e pagamento (mais login), com baselines em `tests/e2e/visual.spec.ts-snapshots/`.
- Relatório HTML em `playwright-report/`; traces só das falhas (`trace: 'retain-on-failure'`).
- Além do E2E: Vitest com unitários, integração da API simulada, tempo real e UI.

## 10. Performance e Lighthouse

| Requisito | Status |
| --- | --- |
| Início e detalhe, perfis mobile e desktop, build otimizado, 3 medições com mediana | ✅ `lighthouserc.mobile.json` e `lighthouserc.desktop.json` |
| Configuração, relatórios HTML e JSON, versões, ambiente e condições versionados | ✅ `docs/lighthouse/`, [`AUDIT.md`](AUDIT.md) |
| LCP, CLS e TBT registrados | ✅ `docs/lighthouse/SUMMARY.md` |
| Metas: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90 | ver [`AUDIT.md`](AUDIT.md): acessibilidade, boas práticas e SEO atendem; **performance ficou abaixo da meta**, com causas e justificativa registradas |

## 11. Critérios eliminatórios

| Critério | Situação |
| --- | --- |
| Uso efetivo da stack obrigatória | ✅ ver seção 1–2 |
| Fluxos principais não são apenas visuais | ✅ compra, conta e tempo real executam ponta a ponta contra a API simulada |
| Compra confirmada só com resposta da simulação | ✅ `checkout.spec.ts` |
| Sem exposição de dados entre usuários | ✅ `account.spec.ts`, `api.test.ts` (pedido de outro usuário devolve 404) |
| Sem eventos simulados direto na UI | ✅ o cliente `socket.io-client` real recebe os eventos pelo MSW |
| Testes E2E executáveis | ✅ `npm run test:e2e` |

## 12. Entrega

| Requisito | Status |
| --- | --- |
| Código, lockfile, assets, mocks, fixtures, testes e configurações de auditoria | ✅ |
| README: setup, variáveis, credenciais, cenários, comandos, reprodução de falhas | ✅ `README.md` |
| `ARCHITECTURE.md`: contratos, sessão, carrinho, cache, reconciliação, limitações e desvios do Figma | ✅ `ARCHITECTURE.md` e `API.md` |
| Comandos de desenvolvimento, build, preview, tipos, lint, Playwright e Lighthouse | ✅ tabela no `README.md` |
| Roda a partir de um checkout limpo, sem serviços privados | ✅ |
| Rotas com refresh e acesso direto no ambiente publicado | `vercel.json` pronto; ⚠️ a validação na URL pública depende do deploy |
| Repositório e URL pública | ⚠️ pendente: criar o repositório, publicar (Vercel, Netlify ou Cloudflare Pages) com `VITE_ENABLE_MOCKS=true` e enviar os links |
