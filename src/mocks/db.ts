import type { Network, WalletProvider } from '@/api/contracts'
import { fromWei, toWei } from '@/lib/eth'
import { MAX_PER_ORDER, seedNfts, type SeedNft } from './seed'

/**
 * "Banco" em memória da API simulada, persistido em localStorage para que
 * refresh e novas abas mantenham sessão, carrinho, favoritos e pedidos.
 * `resetDb()` restaura o estado conhecido.
 */
export type UserRecord = {
  id: string
  name: string
  username: string
  email: string
  ensName: string | null
  referralCode: string | null
  /** SHA-256 com sal (ver `password.ts`); a senha em si nunca é guardada. */
  passwordHash: string
  avatar: string | null
  createdAt: string
}

export type WalletRecord = {
  id: string
  label: string
  address: string
  network: Network
  provider: WalletProvider
  ens: string | null
  isPrimary: boolean
  createdAt: string
}

export type CartRecord = { version: number; items: { nftId: string; quantity: number }[]; updatedAt: string }

export type OrderRecord = {
  id: string
  userId: string
  idemKey: string
  fingerprint: string
  status: 'pending' | 'confirmed' | 'rejected'
  version: number
  createdAt: string
  updatedAt: string
  settleAt: number
  outcome: 'confirmed' | 'refused'
  items: { nftId: string; tokenId: string; name: string; image: string; unitPrice: string; quantity: number; lineTotal: string }[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  network: Network
  couponCode: string | null
  wallet: { label: string; address: string; provider: WalletProvider }
  collector: Record<string, string> | null
  txHash: string | null
  failureReason: string | null
}

export type NftOverride = { price?: string; available?: number; version: number; updatedAt: string }

export type DbState = {
  users: UserRecord[]
  sessions: Record<string, { userId: string; expiresAt: string }>
  nftOverrides: Record<string, NftOverride>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: Record<string, WalletRecord[]>
  /** Carteira conectada (simulação) por usuário. */
  connections: Record<string, string | null>
  orders: Record<string, OrderRecord>
}

const KEY = 'nft.mockdb.v3'

export function seedState(): DbState {
  const now = new Date().toISOString()
  const demo: UserRecord = {
    id: 'user-demo',
    name: 'Lucas Demo',
    username: 'lucas.demo',
    email: 'demo@nft.test',
    ensName: 'nova.kurio',
    referralCode: null,
    passwordHash: '5dd00569948880237d01ba53ede92eff0b4af29fc80f22883cfc96a9b9d3c1ad', // Demo@1234
    avatar: null,
    createdAt: '2026-01-10T12:00:00.000Z',
  }
  const ana: UserRecord = {
    id: 'user-ana',
    name: 'Ana Colecionadora',
    username: 'ana.coleciona',
    email: 'ana@nft.test',
    ensName: null,
    referralCode: null,
    passwordHash: '9e51add4f02695e2934fdad2332c2ad269b6b9de92f1d6b1049e5977f5456c8c', // Demo@1234
    avatar: null,
    createdAt: '2026-02-02T12:00:00.000Z',
  }
  return {
    users: [demo, ana],
    sessions: {},
    nftOverrides: {},
    favorites: { 'user-demo': ['nft-002'], 'user-ana': [] },
    carts: {},
    wallets: {
      'user-demo': [
        {
          id: 'wal-1',
          label: 'Principal',
          address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
          network: 'ethereum',
          provider: 'metamask',
          ens: null,
          isPrimary: true,
          createdAt: now,
        },
        {
          id: 'wal-2',
          label: 'Reserva',
          address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          network: 'polygon',
          provider: 'coinbase',
          ens: 'nova.kurio.eth',
          isPrimary: false,
          createdAt: now,
        },
      ],
      'user-ana': [
        {
          id: 'wal-3',
          label: 'Carteira da Ana',
          address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          network: 'base',
          provider: 'walletconnect',
          ens: null,
          isPrimary: true,
          createdAt: now,
        },
      ],
    },
    connections: {},
    orders: {},
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DbState
  } catch {
    /* estado corrompido: recomeça do seed */
  }
  return seedState()
}

let state: DbState = load()

export const db = {
  get state() {
    return state
  },
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* noop */
    }
  },
  reset() {
    state = seedState()
    this.save()
  },
}

/* ── helpers de domínio ── */
export type LiveNft = SeedNft & { version: number }

export function liveNft(id: string): LiveNft | undefined {
  const base = seedNfts.find((n) => n.id === id)
  if (!base) return undefined
  const o = state.nftOverrides[id]
  return {
    ...base,
    price: o?.price ?? base.price,
    available: o?.available ?? base.available,
    version: o?.version ?? 0,
  }
}

export function allLiveNfts(): LiveNft[] {
  return seedNfts.map((n) => liveNft(n.id) as LiveNft)
}

/** Aplica uma alteração de preço/estoque e devolve o payload do evento nft.updated. */
export function patchNft(id: string, patch: { price?: string; available?: number }) {
  const current = liveNft(id)
  if (!current) return null
  const prev = state.nftOverrides[id]
  const next: NftOverride = {
    price: patch.price ?? prev?.price,
    available: patch.available ?? prev?.available,
    version: (prev?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  state.nftOverrides[id] = next
  db.save()
  const live = liveNft(id) as LiveNft
  return { id, price: live.price, available: live.available, version: live.version, updatedAt: next.updatedAt }
}

export function maxQuantityFor(available: number) {
  return Math.min(available, MAX_PER_ORDER)
}

export function scalePrice(price: string, bps: number) {
  return fromWei((toWei(price) * BigInt(bps)) / 10_000n)
}

export function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
