# Auditoria: testes e Lighthouse

Resultados reais da última execução (2026-10-20). Para reproduzir: `npm run test:e2e` e `npm run lighthouse`.

## Ambiente

| Item | Valor |
| --- | --- |
| SO | Windows 11 Pro (10.0.26200) |
| CPU / RAM | Intel Core i5-10310U, 8 threads, 17 GB |
| Node | 24.18.0 |
| Playwright | 1.64.1, Chromium (Desktop Chrome 1440×900 e Pixel 7) |
| Lighthouse | 12.6.1 via `@lhci/cli` 0.15.1, Chrome headless 155 |
| Perfis do Lighthouse | `mobile` (4× de lentidão de CPU, rede 4G lenta simulada) e `desktop`, throttling simulado |
| Alvo do Lighthouse | build de produção servido por `npm run preview` (mocks ativos, imagens, fontes e funcionalidades completas) |
| Condições | medições com a máquina sem outra carga; o projeto fica numa pasta sincronizada pelo OneDrive |

## Playwright (E2E + regressão visual)

- **104 testes passando, 10 ignorados, 0 falhas** (`npx playwright test --workers=1`, 20 min).
- Os 10 ignorados são intencionais: testes de redimensionamento e de teclado que só rodam no projeto desktop.
- Com mais de um worker, o servidor de desenvolvimento do Vite fica lento nesta máquina e aparecem timeouts de `page.goto` que não são falhas funcionais; por isso a execução de referência usa `--workers=1`.
- Relatório HTML em `playwright-report/`; traces só são gravados nas falhas (`trace: 'retain-on-failure'`).
- Regressão visual: baselines de início, detalhe, carrinho, pagamento e login, em desktop e mobile, em `tests/e2e/visual.spec.ts-snapshots/` (tolerância de 2% de pixels).
- Cobertura dos 12 grupos de fluxo exigidos: ver [`REQUIREMENTS.md`](REQUIREMENTS.md#9-testes-com-playwright).

## Lighthouse

Início (`/`) e detalhe (`/nft/nft-002`), perfis mobile e desktop, **mediana de 3 execuções**. Relatórios HTML e JSON completos em `docs/lighthouse/{mobile,desktop}/` e resumo em `docs/lighthouse/SUMMARY.md`.

| Perfil | URL | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | `/` | **53** | 96 | 100 | 92 | 5,74 s | 0,000 | 881 ms |
| mobile | `/nft/nft-002` | **51** | 100 | 100 | 92 | 5,07 s | 0,000 | 1267 ms |
| desktop | `/` | **83** | 96 | 100 | 92 | 2,04 s | 0,000 | 146 ms |
| desktop | `/nft/nft-002` | 94 | 100 | 100 | 92 | 1,50 s | 0,000 | 83 ms |

Metas do desafio: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90.

- **Atendem às metas:** acessibilidade, boas práticas e SEO em todas as páginas e perfis, e a performance do detalhe em desktop.
- **Abaixo da meta de performance:** início em desktop (83) e as duas páginas em mobile (51 a 53). Não houve simplificação da página para ganhar pontos: imagens, fontes e funcionalidades estão completas.
- **Variação entre execuções:** a mesma página oscila bastante (a home em desktop deu 90, 83 e 80), por isso a mediana é a referência.

### Causas dos resultados abaixo da meta

1. **Mocks no caminho crítico.** O desafio exige que o build publicado mantenha MSW e tempo real funcionando, então o navegador baixa e executa o bundle dos mocks (~140 KiB gzip: MSW, handlers, banco simulado e fixtures) e registra o service worker antes da primeira renderização, porque todas as consultas dependem dele. Em mobile, só o chunk do MSW gasta cerca de 1,7 s de execução de script sob 4× de lentidão de CPU; em desktop, cerca de 0,5 s. Um backend real não teria esse custo.
2. **Execução de JavaScript.** Em mobile, a avaliação de scripts soma ~3,4 s na thread principal (React, roteador, TanStack Query e o MSW), o que explica o TBT de 0,9 a 1,3 s e o LCP de ~5 s.
3. **Descoberta tardia do elemento do LCP.** As imagens só são pedidas depois que o JavaScript executa e os dados chegam dos mocks. No início em mobile, o LCP gasta ~2,2 s esperando o recurso ser descoberto e ~1,9 s de atraso de renderização; em desktop, ~0,9 s e ~0,4 s.
4. **JavaScript não utilizado.** O relatório estima ~74 KiB de código carregado e não usado na tela inicial.

### Melhorias já aplicadas

- Fonte Roboto Mono hospedada localmente, com pré-carga (sem CSS externo bloqueando a renderização).
- `socket.io-client` carregado sob demanda e código do app baixado em paralelo com o MSW.
- Esqueleto do detalhe com a mesma altura da página carregada: o CLS do detalhe em desktop caiu de 0,21 para 0.
- Comparação com a primeira medição desta auditoria (máquina com carga variável): início em desktop passou de ~78 para 83 e detalhe em desktop de 64–73 para 94.

### Oportunidades que ficaram de fora

- Pré-carregar a imagem do hero (LCP em mobile) e gerar uma variante intermediária das artes dos cards.
- Dividir o bundle dos mocks para adiar o que não é necessário na primeira tela.
- Em produção, com API real, os itens 1 e 2 deixariam de existir.
