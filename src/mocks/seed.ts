import type { Category, Chain } from '@/api/contracts'

/** Catálogo determinístico: mesma semente → mesmos NFTs em qualquer execução. */
export type SeedNft = {
  id: string
  tokenId: string
  name: string
  collection: string
  creator: string
  category: Category
  chain: Chain
  price: string
  previousPrice: string | null
  available: number
  edition: number
  featured: boolean
  summary: string
  description: string
  attributes: { trait: string; value: string }[]
  image: string
  images: string[]
  createdAt: string
  rating: number
  reviewCount: number
  contractAddress: string
  royaltyBps: number
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** As quatro artes do layout (Figma), em WebP: versão de cartão e versão ampliada. */
const artworks = {
  emerald: 'nft-emerald-ape',
  sage: 'nft-sage-nomad',
  neon: 'nft-neon-vessel',
  golden: 'nft-golden-beat',
} as const
type Artwork = keyof typeof artworks
const small = (a: Artwork) => `/figma/${artworks[a]}-sm.webp`
const large = (a: Artwork) => `/figma/${artworks[a]}.webp`

type Entry = {
  name: string
  art: Artwork
  price: string
  previousPrice?: string
  category: Category
  chain: Chain
  edition: number
  featured?: boolean
  traits: [string, string, string]
}

/** Os nove primeiros reproduzem a grade da página inicial do layout, na ordem "Listados recentemente". */
const entries: Entry[] = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19', category: 'art', chain: 'ethereum', edition: 50, traits: ['Óculos', 'Esmeralda', 'Raro'] },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69', category: 'art', chain: 'ethereum', edition: 10, featured: true, traits: ['Chapéu', 'Moletom', 'Épico'] },
  { name: 'Neon Vessel #552', art: 'neon', price: '1.99', previousPrice: '2.29', category: 'collectibles', chain: 'polygon', edition: 50, featured: true, traits: ['Blazer', 'Gola alta', 'Raro'] },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29', category: 'art', chain: 'ethereum', edition: 10, traits: ['Chapéu', 'Lilás', 'Lendário'] },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39', category: 'photography', chain: 'polygon', edition: 1, featured: true, traits: ['Chapéu', 'Violeta', 'Raro'] },
  { name: 'Ivory Baron #088', art: 'neon', price: '1.79', category: 'collectibles', chain: 'ethereum', edition: 10, traits: ['Blazer', 'Marfim', 'Incomum'] },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99', category: 'music', chain: 'ethereum', edition: 50, traits: ['Fones', 'Dourado', 'Raro'] },
  { name: 'Golden Pulse #233', art: 'golden', price: '0.69', category: 'music', chain: 'solana', edition: 100, traits: ['Fones', 'Âmbar', 'Comum'] },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39', category: 'music', chain: 'solana', edition: 100, traits: ['Fones', 'Mel', 'Incomum'] },
  { name: 'Jade Captain #301', art: 'emerald', price: '2.45', category: 'gaming', chain: 'ethereum', edition: 10, traits: ['Óculos', 'Jade', 'Épico'] },
  { name: 'Moss Wanderer #077', art: 'sage', price: '0.84', category: 'gaming', chain: 'polygon', edition: 50, traits: ['Chapéu', 'Musgo', 'Comum'] },
  { name: 'Obsidian Duke #019', art: 'neon', price: '3.20', previousPrice: '3.60', category: 'art', chain: 'ethereum', edition: 1, featured: true, traits: ['Blazer', 'Obsidiana', 'Lendário'] },
  { name: 'Amber Rhythm #412', art: 'golden', price: '0.58', category: 'music', chain: 'polygon', edition: 100, traits: ['Fones', 'Âmbar', 'Comum'] },
  { name: 'Verdant Ape #145', art: 'emerald', price: '1.05', category: '3d', chain: 'solana', edition: 50, traits: ['Óculos', 'Verde', 'Incomum'] },
  { name: 'Lilac Drifter #266', art: 'sage', price: '0.47', category: 'generative', chain: 'solana', edition: 100, traits: ['Chapéu', 'Lilás', 'Comum'] },
  { name: 'Ivory Regent #531', art: 'neon', price: '4.10', category: 'utility', chain: 'ethereum', edition: 10, traits: ['Blazer', 'Marfim', 'Épico'] },
  { name: 'Honey Tempo #098', art: 'golden', price: '0.21', category: 'subscriptions', chain: 'polygon', edition: 100, traits: ['Fones', 'Mel', 'Comum'] },
  { name: 'Emerald Chief #004', art: 'emerald', price: '12.30', category: 'art', chain: 'ethereum', edition: 1, featured: true, traits: ['Óculos', 'Esmeralda', 'Lendário'] },
  { name: 'Sage Hermit #388', art: 'sage', price: '0.73', category: '3d', chain: 'polygon', edition: 50, traits: ['Chapéu', 'Sálvia', 'Incomum'] },
  { name: 'Ônix Envoy #620', art: 'neon', price: '2.05', category: 'gaming', chain: 'ethereum', edition: 10, traits: ['Blazer', 'Ônix', 'Raro'] },
  { name: 'Golden Loop #714', art: 'golden', price: '0.02', category: 'generative', chain: 'solana', edition: 100, traits: ['Fones', 'Dourado', 'Comum'] },
  { name: 'Forest Ape #256', art: 'emerald', price: '1.48', category: 'photography', chain: 'polygon', edition: 50, traits: ['Óculos', 'Floresta', 'Raro'] },
  { name: 'Mauve Pilgrim #173', art: 'sage', price: '0.95', category: 'utility', chain: 'ethereum', edition: 50, traits: ['Chapéu', 'Malva', 'Incomum'] },
  { name: 'Pearl Minister #049', art: 'neon', price: '2.75', category: 'subscriptions', chain: 'ethereum', edition: 10, traits: ['Blazer', 'Pérola', 'Épico'] },
  { name: 'Golden Chorus #388', art: 'golden', price: '0.33', category: 'music', chain: 'polygon', edition: 100, traits: ['Fones', 'Dourado', 'Comum'] },
  { name: 'Emerald Sage #612', art: 'emerald', price: '1.88', category: 'collectibles', chain: 'solana', edition: 10, traits: ['Óculos', 'Esmeralda', 'Raro'] },
  { name: 'Cloud Nomad #520', art: 'sage', price: '0.62', category: 'gaming', chain: 'ethereum', edition: 50, traits: ['Chapéu', 'Nuvem', 'Comum'] },
  { name: 'Ivory Consul #237', art: 'neon', price: '1.59', category: '3d', chain: 'polygon', edition: 50, traits: ['Blazer', 'Marfim', 'Incomum'] },
  { name: 'Golden Verse #845', art: 'golden', price: '0.12', category: 'generative', chain: 'ethereum', edition: 100, traits: ['Fones', 'Dourado', 'Comum'] },
  { name: 'Emerald Scout #933', art: 'emerald', price: '0.89', category: 'utility', chain: 'polygon', edition: 50, traits: ['Óculos', 'Esmeralda', 'Comum'] },
]

const collectionFor: Record<Artwork, { name: string; creator: string }> = {
  emerald: { name: 'Kurio Apes', creator: 'Nova Sato' },
  sage: { name: 'Kurio Nomads', creator: 'Íris Amaral' },
  neon: { name: 'Kurio Barons', creator: 'Theo Okafor' },
  golden: { name: 'Kurio Beats', creator: 'Maya Lund' },
}

const chainNames: Record<Chain, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

function build(): SeedNft[] {
  const rnd = mulberry32(20261019)
  const newest = Date.UTC(2026, 9, 18)
  return entries.map((e, i) => {
    const id = `nft-${String(i + 1).padStart(3, '0')}`
    const number = e.name.split('#')[1] ?? String(i + 1)
    const tokenId = number.padStart(4, '0')
    const col = collectionFor[e.art]
    const soldOut = i === 10 || i === 17
    const available = soldOut ? 0 : i === 3 ? 2 : Math.max(1, Math.ceil(e.edition * (0.3 + rnd() * 0.6)))
    const editionLabel = e.edition >= 100 ? 'de edição aberta' : `${e.edition === 1 ? '1/1' : `1/${e.edition}`}`
    const chain = chainNames[e.chain]
    const contract = `0x${Math.floor(rnd() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}${tokenId}…${Math.floor(rnd() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}`
    return {
      id,
      tokenId,
      name: e.name,
      collection: col.name,
      creator: col.creator,
      category: e.category,
      chain: e.chain,
      price: e.price,
      previousPrice: e.previousPrice ?? null,
      available,
      edition: e.edition,
      featured: Boolean(e.featured),
      summary: `Um colecionável digital finalizado à mão da coleção ${col.name}, verificado na ${chain}, com arte desbloqueável e acesso para colecionadores.`,
      description: `${e.name} é uma obra digital ${editionLabel} finalizada à mão da coleção ${col.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${chain}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\nA propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${col.creator} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      attributes: [
        { trait: 'Acessório', value: e.traits[0] },
        { trait: 'Tom', value: e.traits[1] },
        { trait: 'Raridade', value: e.traits[2] },
      ],
      image: small(e.art),
      images: [large(e.art), large(e.art), large(e.art), large(e.art)],
      createdAt: new Date(newest - i * 86_400_000 * 3).toISOString(),
      rating: Math.round((4 + rnd()) * 10) / 10,
      reviewCount: i === 0 ? 19 : 3 + Math.floor(rnd() * 40),
      contractAddress: contract,
      royaltyBps: 500,
    }
  })
}

export const seedNfts: SeedNft[] = build()

export const MAX_PER_ORDER = 5
export const SESSION_TTL_MS = 30 * 60 * 1000
export const NETWORK_FEES: Record<string, string> = {
  ethereum: '0.016',
  polygon: '0.0002',
  arbitrum: '0.0005',
  base: '0.0004',
}
export const COUPONS: Record<string, { percentBps: number; expired?: boolean; label: string }> = {
  WELCOME10: { percentBps: 1000, label: '10% de desconto' },
  NFT15: { percentBps: 1500, label: '15% de desconto' },
  EXPIRED20: { percentBps: 2000, expired: true, label: '20% de desconto' },
}
