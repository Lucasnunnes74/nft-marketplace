import type { NftSummary, NftUpdatedEvent } from '@/api/contracts'

/**
 * Último `nft.updated` aplicado por NFT. Serve a dois propósitos:
 * descartar eventos duplicados ou antigos e corrigir respostas REST que saíram do servidor
 * antes do evento e chegaram depois dele (sem isso, o preço "voltaria" ao valor antigo).
 */
const latest = new Map<string, NftUpdatedEvent>()

/** Registra o evento; devolve false se for duplicado ou mais antigo que o último aplicado. */
export function recordNftEvent(evt: NftUpdatedEvent): boolean {
  const seen = latest.get(evt.id)
  if (seen && evt.version <= seen.version) return false
  latest.set(evt.id, evt)
  return true
}

/** Reaplica o evento mais recente sobre um item vindo do REST se ele estiver defasado. */
export function reconcileNft<T extends NftSummary>(item: T): T {
  const evt = latest.get(item.id)
  if (!evt || evt.version <= item.version) return item
  return { ...item, price: evt.price, available: evt.available, version: evt.version }
}

export function reconcileNftList<T extends { items: NftSummary[] }>(list: T): T {
  return { ...list, items: list.items.map(reconcileNft) }
}

export function resetNftVersions() {
  latest.clear()
}
