import { memo, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Link2, Sparkles, Volume2, VolumeX } from 'lucide-react'
import type { VideoItem } from '@shared/types'
import { api, openDownload, pushToast } from '@/lib/actions'
import { useApp } from '@/lib/store'
import { formatDuration, formatViews, timeAgo } from '@/lib/format'
import { Button } from '@/components/ui/button'

function VideoCardBase({ item }: { item: VideoItem }): JSX.Element {
  const light = useApp((s) => s.settings.lightMode)
  const hoverOn = useApp((s) => s.settings.hoverPreview)
  const [src, setSrc] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(true)
  const [img, setImg] = useState(item.thumbnail)
  const timer = useRef<number>()
  const token = useRef(0)
  const pending = useRef(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => setImg(item.thumbnail), [item.thumbnail])
  useEffect(() => {
    if (video.current) video.current.muted = muted
  }, [muted, src])
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (pending.current) void api.preview.cancel(item.id)
    },
    [item.id]
  )

  // Prévia: depois de 0,5 s com o mouse em cima, o programa prepara um clipe curto e toca em loop.
  const enter = (): void => {
    if (light || !hoverOn) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const t = ++token.current
      pending.current = true
      setLoading(true)
      const url = await api.preview.resolve(item.url, item.id, item.duration ?? 0).catch(() => null)
      if (t !== token.current) return
      pending.current = false
      setLoading(false)
      if (url) setSrc(url)
    }, 500)
  }
  const leave = (): void => {
    window.clearTimeout(timer.current)
    token.current++
    if (pending.current) {
      pending.current = false
      void api.preview.cancel(item.id)
    }
    setSrc(null)
    setPlaying(false)
    setLoading(false)
  }

  const meta = [item.channel, formatViews(item.viewCount), timeAgo(item.published)].filter(Boolean)
  return (
    <article className="spa-video-card group flex flex-col">
      <div
        className="relative aspect-video cursor-pointer overflow-hidden rounded-2xl bg-muted ring-1 ring-white/5 transition-transform duration-200 group-hover:scale-[1.015]"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onClick={() => openDownload({ item })}
      >
        <img src={img} alt="" loading="lazy" draggable={false} className="size-full object-cover" onError={() => setImg(`https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`)} />
        {src && (
          <video
            ref={video}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className={`absolute inset-0 size-full object-cover transition-opacity ${playing ? 'opacity-100' : 'opacity-0'}`}
            onPlaying={() => setPlaying(true)}
            onError={leave}
          />
        )}
        {loading && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25">
            <span className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </span>
        )}
        {item.isNew && (
          <span className="spa-badge-new absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[#22e03a] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-black shadow-[0_0_16px_#22e03a99]">
            <Sparkles className="size-3" /> NOVO
          </span>
        )}
        {playing && (
          <button
            className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-black/65 text-white hover:bg-black/85"
            title={muted ? 'Ligar o som' : 'Silenciar'}
            onClick={(e) => {
              e.stopPropagation()
              setMuted((m) => !m)
            }}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        )}
        {item.duration ? <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white">{formatDuration(item.duration)}</span> : null}
      </div>
      <div className="px-1 pt-3">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug" title={item.title}>{item.title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{meta.join(' · ')}</p>
        {/* botão de download logo abaixo do vídeo */}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => openDownload({ item })}>
            <ArrowDownToLine /> Baixar
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            title="Copiar link"
            onClick={() => {
              void navigator.clipboard.writeText(item.url).then(() => pushToast({ kind: 'info', title: 'Link copiado', message: item.title }))
            }}
          >
            <Link2 />
          </Button>
        </div>
      </div>
    </article>
  )
}
export const VideoCard = memo(VideoCardBase)

export function VideoGrid({ items }: { items: VideoItem[] }): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(285px,1fr))] gap-x-5 gap-y-8">
      {items.map((v) => (
        <VideoCard key={v.id} item={v} />
      ))}
    </div>
  )
}

export function VideoSkeleton({ count = 8 }: { count?: number }): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(285px,1fr))] gap-x-5 gap-y-8">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
          <div className="mt-3 h-4 w-4/5 rounded-full bg-muted" />
          <div className="mt-2 h-3 w-2/5 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}
