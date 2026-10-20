import { beforeEach, describe, expect, it } from 'vitest'
import type { NftSummary, NftUpdatedEvent } from '@/api/contracts'
import { reconcileNft, reconcileNftList, recordNftEvent, resetNftVersions } from '@/realtime/nft-versions'

const event = (version: number, price: string): NftUpdatedEvent => ({ id: 'nft-1', price, available: 2, version }) as NftUpdatedEvent
const item = (version: number, price: string) => ({ id: 'nft-1', price, available: 9, version }) as NftSummary

describe('versões de nft.updated', () => {
  beforeEach(resetNftVersions)

  it('descarta evento duplicado ou mais antigo', () => {
    expect(recordNftEvent(event(3, '0.5'))).toBe(true)
    expect(recordNftEvent(event(3, '0.5'))).toBe(false)
    expect(recordNftEvent(event(2, '0.9'))).toBe(false)
    expect(recordNftEvent(event(4, '0.6'))).toBe(true)
  })

  it('reaplica o evento mais recente sobre resposta REST defasada', () => {
    recordNftEvent(event(5, '0.7777'))
    expect(reconcileNft(item(4, '1.19'))).toMatchObject({ price: '0.7777', available: 2, version: 5 })
    expect(reconcileNftList({ items: [item(4, '1.19')] }).items[0]).toMatchObject({ price: '0.7777' })
  })

  it('não altera resposta igual ou mais nova que o evento', () => {
    recordNftEvent(event(5, '0.7777'))
    const fresh = item(5, '0.7777')
    expect(reconcileNft(fresh)).toBe(fresh)
    const newer = item(6, '0.8')
    expect(reconcileNft(newer)).toBe(newer)
  })

  it('depois do reset a API passa a ser a referência', () => {
    recordNftEvent(event(9, '0.1'))
    resetNftVersions()
    const fromServer = item(1, '2.0')
    expect(reconcileNft(fromServer)).toBe(fromServer)
  })
})
