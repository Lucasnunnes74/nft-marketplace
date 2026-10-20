import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'
import { Price } from './price'

/**
 * Cartão do catálogo. Desktop: moldura #241612 com a arte (258×300 no layout);
 * mobile: cartão com gradiente, cantos 20px e favorito sobre a arte.
 */
export function NftCard({ nft, size = 'grid' }: { nft: NftSummary; size?: 'grid' | 'related' }) {
  const soldOut = nft.available === 0
  return (
    <article className="group relative flex flex-col gap-2 md:gap-3" data-testid="nft-card">
      <div
        className={cn(
          'relative overflow-hidden rounded-[20px] bg-[linear-gradient(139.5deg,#241612_12%,#2f1d15_106.6%)] px-1 pb-5 pt-3 md:rounded-none md:bg-card md:bg-none',
          size === 'grid' ? 'md:px-1 md:pb-[26px] md:pt-6' : 'md:px-1 md:pb-6 md:pt-5',
        )}
      >
        <img
          src={nft.image}
          alt=""
          loading="lazy"
          decoding="async"
          width={420}
          height={420}
          className={cn(
            'aspect-square w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.02]',
            size === 'grid' ? 'md:rounded-[15px]' : 'md:rounded-[13px]',
          )}
        />
        {soldOut ? (
          <span className="absolute left-0 top-4 flex h-8 items-center bg-primary px-2 text-[13px] font-medium leading-4 text-primary-foreground md:top-6">
            ESGOTADO
          </span>
        ) : null}
        <div className="absolute right-3 top-5 z-10 md:hidden">
          <FavoriteButton nftId={nft.id} name={nft.name} isFavorite={nft.isFavorite} variant="chip" />
        </div>
      </div>
      <div className="flex flex-col pl-2 md:gap-3 md:pl-0">
        <h3 className={cn('truncate text-[15px] leading-normal text-foreground', size === 'grid' ? 'md:text-base md:leading-4' : 'md:leading-normal')}>
          {/* O link cobre o cartão inteiro; o favorito fica acima (z-10). */}
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="outline-none after:absolute after:inset-0 focus-visible:underline">
            {nft.name}
          </Link>
        </h3>
        <p className={cn('flex items-center gap-3 leading-4', size === 'grid' ? 'text-base md:text-lg' : 'text-base')}>
          <Price value={nft.price} className="font-bold text-accent" />
          {nft.previousPrice ? (
            <span className="font-normal text-subtle">
              <span className="sr-only">Preço anterior: </span>
              <Price value={nft.previousPrice} className="font-normal" />
            </span>
          ) : null}
          <span className="sr-only" data-testid="nft-availability">
            {soldOut ? 'Sem estoque' : `${nft.available} de ${nft.edition} disponíveis`}
          </span>
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton({ size = 'grid' }: { size?: 'grid' | 'related' }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className={cn('rounded-[20px] bg-card px-1 pb-5 pt-3 md:rounded-none', size === 'grid' ? 'md:pb-[26px] md:pt-6' : 'md:pb-6 md:pt-5')}>
        <Skeleton className="aspect-square w-full rounded-2xl bg-surface-raised md:rounded-[15px]" />
      </div>
      <Skeleton className="h-4 w-3/4 bg-card" />
      <Skeleton className="h-4 w-1/3 bg-card" />
    </div>
  )
}
