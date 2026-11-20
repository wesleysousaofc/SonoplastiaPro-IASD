import { useEffect, useState } from 'react'
import { Cast } from 'lucide-react'
import type { DisplayInfo } from '@shared/types'
import { api } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

/** Escolha da tela de saída (telão) antes de reproduzir um arquivo da biblioteca. */
export function PlayDialog(): JSX.Element {
  const target = useApp((s) => s.playTarget)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [idx, setIdx] = useState(0)
  const [full, setFull] = useState(true)
  useEffect(() => {
    if (!target) return
    void api.player.displays().then((d) => {
      setDisplays(d)
      setIdx(d.length > 1 ? 1 : 0) // já sugere a TELA 2 (telão) quando existir
    })
  }, [target])
  const close = (): void => appStore.set({ playTarget: null })
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      {target && (
        <DialogContent className="w-[min(92vw,470px)]">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold"><Cast className="size-5 text-primary" /> Reproduzir arquivo</DialogTitle>
          <DialogDescription className="mt-1 line-clamp-2 text-sm text-muted-foreground">{target.title}</DialogDescription>
          <p className="mb-1.5 mt-5 pl-1 text-xs font-semibold text-muted-foreground">Tela de saída</p>
          <Select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
            {displays.map((d) => <option key={d.index} value={d.index}>{d.name} ({d.width}×{d.height}){d.primary ? ' · principal' : ''}</option>)}
          </Select>
          <p className="mt-1.5 pl-1 text-xs text-muted-foreground">Escolha a TELA 2 (ou superior) para enviar ao telão.</p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 pl-1 text-sm">
            <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={full} onChange={(e) => setFull(e.target.checked)} /> Tela cheia
          </label>
          <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">No player: Espaço pausa · ← → voltam/avançam 10 s · ↑ ↓ volume · F tela cheia · Esc fecha.</p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="secondary" size="lg" onClick={close}>Cancelar</Button>
            <Button size="lg" onClick={() => { void api.player.open({ path: target.path, title: target.title, displayIndex: idx, fullscreen: full }); close() }}>▶ Reproduzir agora</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
