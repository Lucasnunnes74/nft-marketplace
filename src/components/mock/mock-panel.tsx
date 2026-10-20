import { FlaskConical } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import '@/mocks/control'
import { scenarioStore, type Scenario } from '@/mocks/scenario'

/**
 * Painel de simulação (somente com mocks ativos): alterna latência, falhas,
 * resultado de pagamento e dispara eventos em tempo real para demonstrar
 * cada cenário exigido sem editar código.
 */
export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const scenario = useSyncExternalStore(scenarioStore.subscribe, scenarioStore.get, scenarioStore.get)
  const [nftId, setNftId] = useState('nft-001')
  const control = window.__mock
  if (!control) return null

  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) => control.setScenario({ [key]: value })

  return (
    <div className="fixed bottom-4 left-4 z-[55]">
      {open ? (
        <section
          aria-label="Painel de simulação"
          className="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-lg border bg-card p-4 text-sm shadow-xl"
          data-testid="mock-panel"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Simulação</h2>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="mock-latency">Latência</Label>
              <Select id="mock-latency" value={scenario.latency} onChange={(e) => set('latency', e.target.value as Scenario['latency'])}>
                <option value="fast">Rápida</option>
                <option value="slow">Lenta</option>
                <option value="variable">Variável (fora de ordem)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mock-failure">Falha de rede</Label>
              <Select id="mock-failure" value={scenario.failure} onChange={(e) => set('failure', e.target.value as Scenario['failure'])}>
                <option value="none">Nenhuma</option>
                <option value="network">Sem conexão</option>
                <option value="500">HTTP 500</option>
                <option value="503">HTTP 503</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mock-payment">Pagamento</Label>
              <Select id="mock-payment" value={scenario.payment} onChange={(e) => set('payment', e.target.value as Scenario['payment'])}>
                <option value="confirmed">Confirmado</option>
                <option value="refused">Recusado</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mock-wallet">Carteira</Label>
              <Select id="mock-wallet" value={scenario.wallet} onChange={(e) => set('wallet', e.target.value as Scenario['wallet'])}>
                <option value="ok">Conecta</option>
                <option value="refused">Recusa conexão</option>
                <option value="disconnected">Desconecta na compra</option>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs text-muted-foreground">Na próxima compra</legend>
            {(
              [
                ['priceChangeOnCheckout', 'Preço muda durante a compra'],
                ['soldOutOnCheckout', 'Item esgota durante a compra'],
                ['orderTimeout', 'Resposta do pedido expira (timeout)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={scenario[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={scenario.ticker} onChange={(e) => set('ticker', e.target.checked)} />
              Mercado ativo (eventos periódicos)
            </label>
          </fieldset>

          <div className="space-y-1.5 border-t pt-3">
            <Label htmlFor="mock-nft">Emitir nft.updated</Label>
            <div className="flex gap-2">
              <input
                id="mock-nft"
                value={nftId}
                onChange={(e) => setNftId(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-2"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => control.updateNft(nftId, { price: '0.2222', available: 1 })}
              >
                Disparar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => control.expireSessions()}>
              Expirar sessão
            </Button>
            <Button size="sm" variant="outline" onClick={() => control.dropSocket()}>
              Derrubar socket
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                control.reset()
                window.location.assign('/')
              }}
            >
              Resetar dados
            </Button>
          </div>
        </section>
      ) : (
        <Button variant="secondary" size="sm" className="shadow-lg" onClick={() => setOpen(true)} aria-label="Abrir painel de simulação">
          <FlaskConical /> Simulação
        </Button>
      )}
    </div>
  )
}
