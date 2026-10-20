# NFT Marketplace — contexto do projeto

Implementação do **Desafio Frontend — Marketplace de NFTs** (`junglegaming/frontend-challenge`),
seguindo o layout no Figma. O desafio avalia fidelidade visual, qualidade das interações,
integração com APIs, estado assíncrono, tempo real, acessibilidade e performance.

## Stack obrigatória (não trocar)
React · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO (client) ·
Tailwind CSS · shadcn/ui · MSW (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse.
Complementares escolhidos: Vite, zod (contratos), react-hook-form, Vitest.

## Comandos
- `npm run dev` — dev server (porta 5173) com mocks ativos
- `npm run typecheck` · `npm run lint` · `npm test` (Vitest: unit + integração da API simulada)
- `npm run build && npm run preview` — build de demonstração (mocks ativos via `VITE_ENABLE_MOCKS=true`)
- `npm run test:e2e` — Playwright (E2E + regressão visual); `npm run test:e2e:update` atualiza baselines
- `npm run lighthouse` — Lighthouse CI, perfis mobile e desktop (`lighthouserc.mobile.json`, `lighthouserc.desktop.json`); relatórios em `docs/lighthouse/`

## Arquitetura (resumo; detalhes em `docs/ARCHITECTURE.md`)
- `src/api/contracts.ts`: **fonte única** de schemas zod (REST + eventos Socket.IO). Valores em ETH
  são **strings decimais**; cálculos usam `src/lib/eth.ts` (bigint em wei). Nunca usar `number` para ETH.
- `src/api/client.ts`: único cliente Axios; erros normalizados em `ApiError` (`src/api/errors.ts`).
- `src/hooks/use-api.ts`: todas as queries/mutations (TanStack Query). Chaves em `src/api/keys.ts`.
- `src/realtime/socket.ts`: cliente Socket.IO real; `nft.updated` / `order.updated`, versionamento,
  deduplicação e reconciliação com REST ao reconectar.
- `src/mocks/*`: camada MSW (REST + WebSocket). **Componentes, hooks e cliente Axios não contêm
  respostas fictícias** — todo dado simulado vive aqui. `window.__mock` controla cenários.
- Estado de URL: filtros/busca/ordenação/página do catálogo ficam na URL (`src/search-schemas.ts`).
- Rotas privadas: `beforeLoad` em `src/router.tsx` redireciona ao login e volta ao ponto de origem.

## Regras para qualquer mudança
1. Toda tela precisa de estados de **loading, vazio, erro (com retry) e sucesso**.
2. Acessibilidade: labels ligados por id (`Field`), foco visível, `aria-live` para status, sem cor como único sinal.
3. Nada de segredos reais, cartões ou chaves: tudo é simulação; credenciais de demo são fictícias.
4. Mutations sem retry automático; pedido usa `Idempotency-Key` (ver `usePlaceOrder`).
5. Ao trocar de sessão: limpar cache do usuário, desconectar/reconectar o socket, soltar listeners.
6. Rode `npm run typecheck && npm run lint && npm test` antes de dar uma tarefa por concluída.

## Figma
Original: https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge (somente leitura).
Cópia editável usada pelo conector: https://www.figma.com/design/S2I6VD3ADJrpPZc3Gwxhn4 (página `0:1`,
telas desktop `2:2`, `10:244`, `11:1278`, `11:2862`, `11:4385`, `9:115`, `9:1022`, `9:1238`, `9:1670`; mobile `14:5226`…`16:1228`).
**Status:** UI implementada a partir do Figma (marca KURIO, paleta marrom/âmbar, Roboto Mono).
Tokens em `src/index.css` (`:root`, nomes do Figma nos comentários). Assets exportados em `public/figma/`
(artes em WebP 900px e `-sm` 420px; ícones SVG usados via `FigmaIcon`, que aplica `currentColor` por máscara).
Desktop e mobile são layouts distintos: `useIsDesktop()` (≥768px) escolhe header/rodapé vs tab bar.

## Agentes (`.claude/agents`)
`frontend-architect` · `api-mocks-engineer` · `e2e-qa` · `a11y-performance-auditor` ·
`design-fidelity-reviewer` · `requirements-reviewer`. Comandos: `/verify`, `/requirements-check`.
