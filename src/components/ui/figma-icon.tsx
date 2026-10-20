import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Ícone exportado do Figma (public/figma). Por padrão usa o SVG como máscara,
 * então a cor vem de `currentColor` (estados ativo/hover sem duplicar arquivos).
 * `original` mantém as cores do arquivo (logos multicoloridos, ilustrações).
 */
export function FigmaIcon({
  name,
  width,
  height = width,
  original,
  className,
  style,
}: {
  name: string
  width: number
  height?: number
  original?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const src = `/figma/${name}.svg`
  if (original) {
    return <img src={src} alt="" aria-hidden width={width} height={height} className={cn('shrink-0', className)} style={style} />
  }
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        width,
        height,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        ...style,
      }}
    />
  )
}
