// Resume as auditorias do Lighthouse: mediana por URL e perfil das 4 categorias e de LCP, CLS e TBT.
// Lê os relatórios JSON em docs/lighthouse/{mobile,desktop} e grava docs/lighthouse/SUMMARY.md.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = 'docs/lighthouse'
const profiles = ['mobile', 'desktop']
const categories = [
  ['performance', 'Performance', 90],
  ['accessibility', 'Acessibilidade', 95],
  ['best-practices', 'Boas práticas', 95],
  ['seo', 'SEO', 90],
]

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

let environment = ''
const rows = []
for (const profile of profiles) {
  const dir = join(root, profile)
  const reports = readdirSync(dir)
    .filter((f) => f.endsWith('.report.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  if (reports[0] && !environment) {
    environment = `Lighthouse ${reports[0].lighthouseVersion}, ${reports[0].environment.hostUserAgent}`
  }
  const byUrl = new Map()
  for (const r of reports) {
    const path = new URL(r.finalUrl).pathname
    byUrl.set(path, [...(byUrl.get(path) ?? []), r])
  }
  for (const [path, runs] of byUrl) {
    const score = (id) => Math.round(median(runs.map((r) => r.categories[id].score * 100)))
    const audit = (id) => median(runs.map((r) => r.audits[id].numericValue))
    rows.push({
      profile,
      path,
      runs: runs.length,
      scores: Object.fromEntries(categories.map(([id]) => [id, score(id)])),
      lcp: audit('largest-contentful-paint') / 1000,
      cls: audit('cumulative-layout-shift'),
      tbt: audit('total-blocking-time'),
    })
  }
}

const mark = (value, goal) => (value >= goal ? `${value}` : `**${value}** ⚠️`)
const lines = [
  '# Lighthouse: medianas',
  '',
  `Gerado por \`scripts/lighthouse-summary.mjs\`. ${environment}.`,
  'Mediana de 3 execuções por URL e perfil. Metas: ' + categories.map(([, name, goal]) => `${name} ≥ ${goal}`).join(', ') + '.',
  '',
  '| Perfil | URL | ' + categories.map(([, name]) => name).join(' | ') + ' | LCP | CLS | TBT |',
  '| --- | --- | ' + categories.map(() => '---:').join(' | ') + ' | ---: | ---: | ---: |',
  ...rows.map(
    (r) =>
      `| ${r.profile} | \`${r.path}\` | ` +
      categories.map(([id, , goal]) => mark(r.scores[id], goal)).join(' | ') +
      ` | ${r.lcp.toFixed(2)} s | ${r.cls.toFixed(3)} | ${Math.round(r.tbt)} ms |`,
  ),
  '',
]
writeFileSync(join(root, 'SUMMARY.md'), lines.join('\n'))
console.log(lines.join('\n'))
