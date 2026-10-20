# NFT Marketplace

Implementação do **Desafio Frontend — Marketplace de NFTs**: descoberta, compra e conta do colecionador,
com versões desktop e mobile, API simulada (MSW), tempo real (Socket.IO) e tudo dentro da stack exigida.

> Ambiente de demonstração: dados, pagamentos, carteiras e transações são **simulados**.

## Rodando

```bash
npm install
npm run dev            # http://localhost:5173 (mocks ativos)
```

Credenciais fictícias: `demo@nft.test` / `Demo@1234` (ou `ana@nft.test`). Cupons: `WELCOME10`, `NFT15`
(válidos) e `EXPIRED20` (expirado).

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | TypeScript (app + testes) |
| `npm run lint` | oxlint |
| `npm test` | Vitest: unitários, integração da API simulada, tempo real e UI (jsdom) |
| `npm run build && npm run preview` | build de demonstração (mocks ativos), porta 4173 |
| `npm run test:e2e` | Playwright (E2E + regressão visual, desktop e mobile) — requer `npx playwright install chromium`; relatório HTML em `playwright-report/` |
| `npm run test:e2e:update` | gera/atualiza as baselines visuais |
| `npm run lighthouse` | build + Lighthouse (mobile e desktop, início e detalhe, 3 medições, mediana); relatórios HTML/JSON e `SUMMARY.md` em `docs/lighthouse/` |

Em máquinas lentas, rode o E2E com `npx playwright test --workers=1`: vários workers sobrecarregam o servidor de
desenvolvimento e geram timeouts de carregamento que não são falhas funcionais.

## Variáveis de ambiente

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` (`.env`) | Liga o MSW (REST + Socket.IO simulados) e o painel de simulação. Precisa ficar `true` no build publicado. |
| `VITE_SOCKET_URL` | `wss://realtime.nft.local` | Endereço do Socket.IO; o MSW intercepta esse endereço. |

Não há segredos: tudo é simulação e roda a partir de um checkout limpo, sem serviços externos.

## Deploy

Aplicação estática (Vite). Na Vercel: importar o repositório, comando `npm run build`, saída `dist`, variável
`VITE_ENABLE_MOCKS=true`. O [`vercel.json`](vercel.json) reescreve as rotas para `index.html` (refresh e acesso direto
funcionam). Os mocks rodam no navegador (service worker), então cada visitante tem o próprio estado, guardado em
`localStorage`.

## Stack

React · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO · Tailwind CSS · shadcn/ui ·
MSW · Playwright · Lighthouse. Complementares: Vite, zod, react-hook-form, Vitest + Testing Library.

## Painel de simulação

Botão **Simulação** (canto inferior esquerdo) permite reproduzir cada cenário sem editar código: latência
lenta/variável (respostas fora de ordem), queda de rede/HTTP 500/503, pagamento recusado, carteira que recusa
ou desconecta, preço que muda ou item que esgota **durante** a compra, timeout do pedido, expiração de sessão,
queda do socket e emissão manual de `nft.updated`. Também exposto em `window.__mock` (usado pelos testes E2E).

**Escolher e resetar cenários.** O cenário ativo fica em `localStorage`, então sobrevive a refresh. No painel, use
**Resetar dados** para restaurar o banco simulado, a sessão e o cenário ao estado inicial; no console, `window.__mock.reset()`
faz o mesmo e `window.__mock.setScenario({ ... })` altera um cenário (ver `src/mocks/scenario.ts`).

**Reproduzir os fluxos de falha** (painel de simulação ou `window.__mock.setScenario`):

| Fluxo | Como reproduzir |
| --- | --- |
| Carregamento lento / respostas fora de ordem | `latency: 'slow'` ou `'variable'`, depois filtre/pagine o catálogo |
| Erro de rede ou HTTP 500/503 com retry | `failure: 'network' \| '500' \| '503'`, recarregue e use "Tentar novamente" |
| Pagamento recusado | `payment: 'refused'`, adicione ao carrinho, conecte a carteira e confirme |
| Carteira recusa/desconecta | `wallet: 'refused' \| 'disconnected'` e "Conectar carteira" no pagamento |
| Preço muda / item esgota durante a compra | `priceChangeOnCheckout` ou `soldOutOnCheckout`, confirme a compra |
| Timeout após criar o pedido (idempotência) | `orderTimeout: true`, confirme a compra: o mesmo pedido é recuperado, sem duplicar |
| Sessão expirada | `window.__mock.expireSessions()` e navegue ou volte ao checkout |
| Queda do socket | `window.__mock.dropSocket()` e observe "Reconectando…" e a reconciliação com a API |
| Cupom inválido ou expirado | no carrinho, use um código qualquer ou `EXPIRED20` |
| Conflito de cadastro | cadastre-se com `demo@nft.test` |

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — camadas, cache/retries, otimismo, tempo real, sessão
- [`docs/API.md`](docs/API.md) — contratos REST, erros, idempotência, eventos Socket.IO e limitações do mock
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — checklist rastreável do desafio e pendências
- [`docs/AUDIT.md`](docs/AUDIT.md) — resultados de Playwright e Lighthouse, versões e ambiente (relatórios em `docs/lighthouse/`)
- [`CLAUDE.md`](CLAUDE.md) e [`.claude/`](.claude) — contexto e agentes de IA do projeto

## Agentes de IA (Claude Code)

Subagentes em `.claude/agents` para continuar o desenvolvimento com o Claude Code: `frontend-architect`,
`api-mocks-engineer`, `e2e-qa`, `a11y-performance-auditor`, `design-fidelity-reviewer` e
`requirements-reviewer`; comandos `/verify` e `/requirements-check`.
