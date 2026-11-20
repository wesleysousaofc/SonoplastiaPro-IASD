import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { getAudioEngine } from '@/lib/audioEngine'

const fmt = (sec: number): string => {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Player do telão (janela própria, tela cheia).
 *   Espaço = pausar/continuar (o clique do mouse NÃO pausa)   ← → = voltar/avançar 10 s
 *   ↑ ↓ = volume   M = mudo   F = tela cheia   Esc = fechar   (fecha sozinho quando o vídeo termina)
 */
export function PlayerPage(): JSX.Element {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '')
  const src = q.get('src') ?? ''
  const title = q.get('title') ?? ''
  const audio = q.get('audio') === '1'
  const video = useRef<HTMLVideoElement>(null)
  const [ui, setUi] = useState(true)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [paused, setPaused] = useState(false)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const idle = useRef<number>()
  const hintTimer = useRef<number>()

  const flash = (t: string): void => {
    setHint(t)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 900)
  }

  // Mesa de Som: liga o motor ao <video> e recebe os valores da janela principal em tempo real
  useEffect(() => {
    const v = video.current
    if (!v) return
    let off: (() => void) | undefined
    try {
      const engine = getAudioEngine(v) // mesmo motor mesmo se o React montar duas vezes (StrictMode)
      off = window.api.on('audio:apply', (p) => engine.apply(p))
      window.api.audio.status({ ok: true })
    } catch (e) {
      window.api.audio.status({ ok: false, error: (e as Error).message })
    }
    return () => off?.()
  }, [])

  useEffect(() => {
    document.documentElement.style.background = '#000'
    document.body.style.background = '#000'
    const wake = (): void => {
      setUi(true)
      window.clearTimeout(idle.current)
      idle.current = window.setTimeout(() => setUi(false), 2500)
    }
    const seek = (delta: number): void => {
      const v = video.current
      if (!v) return
      const max = Number.isFinite(v.duration) ? v.duration : Infinity
      v.currentTime = Math.max(0, Math.min(max, v.currentTime + delta))
      flash(delta > 0 ? `⏩ +${delta}s` : `⏪ ${delta}s`)
    }
    const onKey = (e: KeyboardEvent): void => {
      const v = video.current
      if (!v) return
      wake()
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault()
          if (!e.repeat) {
            if (v.paused) void v.play()
            else v.pause()
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-10)
          break
        case 'ArrowUp':
          e.preventDefault()
          v.volume = Math.min(1, v.volume + 0.1)
          setVol(v.volume)
          flash(`🔊 ${Math.round(v.volume * 100)}%`)
          break
        case 'ArrowDown':
          e.preventDefault()
          v.volume = Math.max(0, v.volume - 0.1)
          setVol(v.volume)
          flash(`🔉 ${Math.round(v.volume * 100)}%`)
          break
        case 'm':
        case 'M':
          v.muted = !v.muted
          setMuted(v.muted)
          flash(v.muted ? '🔇 Mudo' : '🔊 Som ligado')
          break
        case 'f':
        case 'F':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen()
          break
        case 'Escape':
          window.api.win.close()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousemove', wake)
    wake()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousemove', wake)
      window.clearTimeout(idle.current)
    }
  }, [])

  const pct = dur ? Math.min(100, (time / dur) * 100) : 0

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black" style={{ cursor: ui ? 'default' : 'none' }} onContextMenu={(e) => e.preventDefault()}>
      {/* sem "controls" e sem clique: o mouse não pausa o vídeo */}
      <video
        ref={video}
        crossOrigin="anonymous" // obrigatório para o Web Audio: sem isso o som sai mudo (mídia de outra origem)
        src={src}
        autoPlay
        tabIndex={-1}
        className="pointer-events-none h-full w-full object-contain"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => {
          if (video.current) getAudioEngine(video.current).reset()
          window.api.win.close() // terminou: fecha sozinho (a mesa de som some e reseta)
        }}
        onError={() => setError('Não foi possível reproduzir este arquivo.')}
      />
      {audio && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[10rem]">🎵</div>}

      <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/85 to-transparent px-6 pb-10 pt-4 text-white transition-opacity duration-300 ${ui ? 'opacity-100' : 'opacity-0'}`}>
        <Logo size={38} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">SonoplastiaPro · IASD</p>
          <p className="truncate text-lg font-semibold">{title}</p>
        </div>
      </div>

      {hint && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-black/70 px-8 py-4 text-3xl font-bold text-white">{hint}</div>}
      {paused && !hint && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-black/70 px-8 py-4 text-3xl font-bold text-white">⏸ Pausado</div>}
      {error && <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/80 px-6 py-4 text-white">{error}</p>}

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-6 pb-4 pt-12 text-white transition-opacity duration-300 ${ui ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div
          className="h-2 w-full cursor-pointer overflow-hidden rounded-full bg-white/25"
          onClick={(e) => {
            const v = video.current
            if (!v || !dur) return
            const r = e.currentTarget.getBoundingClientRect()
            v.currentTime = ((e.clientX - r.left) / r.width) * dur
          }}
        >
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm tabular-nums">
          <span>{fmt(time)} / {fmt(dur)}</span>
          <span className="flex items-center gap-1.5 text-white/80">{muted || vol === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />} {muted ? 'Mudo' : `${Math.round(vol * 100)}%`}</span>
          <span className="ml-auto text-xs text-white/60">Espaço pausa · ← → ±10 s · ↑ ↓ volume · M mudo · F tela cheia · Esc fecha</span>
        </div>
      </div>
    </div>
  )
}
