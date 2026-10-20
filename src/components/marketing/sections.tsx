import { Link } from '@tanstack/react-router'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { toast } from '@/stores/toasts'

/** Hero da página inicial (desktop 1200×450 / mobile 366×190 no layout). */
export function Hero() {
  return (
    <section aria-labelledby="hero-title">
      {/* Desktop */}
      <div className="hidden h-[450px] items-center justify-between pl-10 md:flex">
        <div className="flex w-[600px] max-w-[52%] flex-col items-end gap-11">
          <div className="flex w-full flex-col gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-2 text-foreground">
                <p className="text-sm font-medium leading-4 tracking-[1.4px]">Bem-vindo à Kurio</p>
                <h1 id="hero-title" className="text-[43px] font-bold leading-[70px] max-lg:text-[34px] max-lg:leading-[52px]">
                  SEJA DONO DO FUTURO
                  <br />
                  DA ARTE DIGITAL
                </h1>
              </div>
              <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e
                tenha uma parte da cultura da internet.
              </p>
            </div>
            <Link
              to="/"
              hash="catalogo"
              className="flex h-10 w-[140px] items-center justify-center rounded-[6px] bg-primary text-base font-bold leading-5 text-primary-foreground hover:brightness-110"
            >
              EXPLORAR
            </Link>
          </div>
          <img src="/figma/hero-dots.svg" alt="" aria-hidden width={40} height={8} />
        </div>
        <img
          src="/figma/nft-emerald-ape.webp"
          alt="Emerald Ape #042: macaco de óculos redondos e jaqueta verde"
          width={450}
          height={450}
          fetchPriority="high"
          className="aspect-square w-[450px] max-w-[45%] rounded-3xl object-cover"
        />
      </div>

      {/* Mobile */}
      <div className="relative flex h-[190px] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl p-4 md:hidden">
        <img src="/figma/m-hero-mask.svg" alt="" aria-hidden className="absolute inset-0 size-full" />
        <div className="relative flex w-full items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium leading-4 text-foreground">Bem-vindo à Kurio</p>
              <h1 id="hero-title-m" className="w-[190px] text-lg font-bold leading-[29px] text-foreground">
                SEJA DONO DA
                <br />
                CULTURA DIGITAL
              </h1>
              <p className="text-xs leading-[18px] text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
            </div>
            <Link to="/" hash="catalogo" className="flex items-center gap-2 text-xs font-bold leading-[14px] text-accent">
              EXPLORAR
              <FigmaIcon name="m-arrow-right" width={10} height={8} className="-rotate-90" />
            </Link>
          </div>
          <div className="relative size-[138px] shrink-0">
            <img src="/figma/nft-emerald-ape-sm.webp" alt="" width={138} height={138} className="size-[138px] rounded-2xl object-cover" />
            <img
              src="/figma/nft-sage-nomad-sm.webp"
              alt=""
              width={58}
              height={58}
              className="absolute left-[14px] top-[88px] size-[58px] rounded-2xl object-cover"
            />
          </div>
        </div>
        <img src="/figma/m-hero-dots.svg" alt="" aria-hidden width={33} height={7} className="relative" />
      </div>
    </section>
  )
}

const promos = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/figma/nft-emerald-ape-sm.webp',
    imageClass: 'left-[-5px] w-[292px] rounded-[18px]',
    search: { tab: 'new' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/figma/nft-neon-vessel-sm.webp',
    imageClass: 'left-[2px] w-[287px] rounded-[17px]',
    search: { category: 'art' as const },
  },
]

export function Promos() {
  return (
    // O miolo do card é fixo (arte de 292px + texto de 263px): só cabe em duas colunas a partir de 1280px.
    <section id="destaques" aria-label="Destaques" className="grid scroll-mt-6 gap-7 xl:grid-cols-2">
      {promos.map((p) => (
        <article key={p.title[0]} className="relative h-[250px] overflow-hidden rounded-lg bg-card">
          <img
            src={p.image}
            alt=""
            loading="lazy"
            width={292}
            height={250}
            className={`absolute top-0 hidden h-[250px] object-cover sm:block ${p.imageClass}`}
          />
          <img src="/figma/promo-mask.svg" alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full" />
          <div className="absolute inset-y-0 right-[30px] flex w-[min(263px,calc(100%-60px))] flex-col items-end pt-[37px] text-right sm:w-[263px]">
            <h2 className="text-lg font-bold leading-6 text-foreground">
              {p.title[0]}
              <br />
              {p.title[1]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{p.text}</p>
            <Link
              to="/"
              search={p.search}
              hash="catalogo"
              className="absolute top-[164px] flex h-10 w-[140px] items-center justify-center gap-1 rounded-[6px] bg-primary text-sm font-medium leading-5 text-primary-foreground hover:brightness-110"
            >
              Explorar
              <FigmaIcon name="icon-arrow-right" width={13} height={11} className="-rotate-90" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const posts = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/figma/nft-neon-vessel-sm.webp' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/figma/nft-emerald-ape-sm.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/figma/nft-sage-nomad-sm.webp' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/figma/nft-golden-beat-sm.webp' },
]

export function Blog() {
  return (
    <section id="diario" aria-labelledby="diario-title" className="flex scroll-mt-6 flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 id="diario-title" className="text-[28px] font-bold leading-normal text-text-primary">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-normal text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>
      <ul className="grid w-full gap-6 sm:grid-cols-2 lg:flex">
        {posts.map((p) => (
          <li key={p.title} className="flex flex-col overflow-hidden rounded-lg bg-card lg:w-[268px]">
            <img src={p.image} alt="" loading="lazy" width={268} height={195} className="h-[195px] w-full object-cover" />
            <article className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
              <p className="whitespace-pre-wrap text-xs font-medium leading-4 text-muted-foreground">
                {`${p.date}  |  Leitura de ${p.read}`}
              </p>
              <h3 className="text-base font-bold leading-normal text-text-primary">{p.title}</h3>
              <p className="text-xs font-medium leading-4 text-muted-foreground">{p.text}</p>
              <button
                type="button"
                onClick={() =>
                  toast({
                    title: 'Artigo indisponível na demonstração',
                    description: 'O conteúdo editorial está fora do escopo desta simulação.',
                  })
                }
                className="flex w-fit gap-1 text-xs text-accent hover:underline"
              >
                <span className="font-bold leading-[14px]">
                  Ler mais<span className="sr-only">: {p.title}</span>
                </span>
                <span aria-hidden>→</span>
              </button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
