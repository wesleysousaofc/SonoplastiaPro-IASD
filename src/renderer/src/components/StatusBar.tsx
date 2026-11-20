import { useEffect, useState } from 'react'
import { ArrowDownToLine, Cpu, MemoryStick } from 'lucide-react'
import type { LiveStats } from '@shared/types'
import { api } from '@/lib/actions'
import { useApp } from '@/lib/store'
import { clockTime, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'

const tone = (p: number): string => (p >= 85 ? 'text-destructive' : p >= 65 ? 'text-warning' : 'text-success')

export function StatusBar(): JSX.Element {
  const light = useApp((s) => s.settings.lightMode)
  const downloads = useApp((s) => s.downloads)
  const [live, setLive] = useState<LiveStats | null>(null)
  const [clock, setClock] = useState(clockTime())

  useEffect(() => {
    let stop = false
    const tick = (): void => {
      api.system.live().then((l) => !stop && setLive(l)).catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, light ? 8000 : 3000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [light])
  useEffect(() => {
    const id = window.setInterval(() => setClock(clockTime()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const running = downloads.filter((d) => d.status === 'downloading')
  const speed = running.reduce((s, d) => s + (d.speed ?? 0), 0)
  return (
    <footer className="spa-statusbar flex h-9 shrink-0 items-center gap-5 border-t px-5 text-xs text-muted-foreground">
      {live && (
        <>
          <span className="flex items-center gap-1.5" title="Uso do processador"><Cpu className="size-3.5" /> CPU <b className={cn('font-semibold', tone(live.cpu))}>{live.cpu}%</b></span>
          <span className="flex items-center gap-1.5" title={`${live.ramUsedGB} de ${live.ramTotalGB} GB`}><MemoryStick className="size-3.5" /> RAM <b className={cn('font-semibold', tone(live.ramPct))}>{live.ramPct}%</b></span>
        </>
      )}
      <span className="flex flex-1 items-center justify-center gap-1.5">
        {running.length > 0 && (
          <>
            <ArrowDownToLine className="size-3.5 text-primary" /> {running.length} baixando · {formatSpeed(speed)}
          </>
        )}
      </span>
      <span className="tabular-nums">{clock}</span>
    </footer>
  )
}
