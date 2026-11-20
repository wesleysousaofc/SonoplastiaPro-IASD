import { useState } from 'react'
import { Download, RefreshCw, Rocket, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

/** Aviso de atualização ao abrir o programa: SIM baixa, instala e reinicia; NÃO fecha o aviso. */
export function UpdateDialog(): JSX.Element {
  const u = useApp((s) => s.update)
  const dismissed = useApp((s) => s.updateDismissed)
  const current = useApp((s) => s.version)
  const [attempt, setAttempt] = useState(false)

  const open = (u.phase === 'available' && dismissed !== u.version) || u.phase === 'downloading' || u.phase === 'ready' || (u.phase === 'error' && attempt)
  const close = (): void => {
    if (u.phase === 'available') appStore.set({ updateDismissed: u.version ?? null })
    else if (u.phase === 'error') setAttempt(false)
  }
  const busy = u.phase === 'downloading' || u.phase === 'ready'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="w-[min(92vw,500px)]" onInteractOutside={(e) => busy && e.preventDefault()} onEscapeKeyDown={(e) => busy && e.preventDefault()}>
        <div className="mb-4 flex items-center gap-3.5">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white">
            {u.phase === 'error' ? <TriangleAlert /> : u.phase === 'ready' ? <Rocket /> : u.phase === 'downloading' ? <Download /> : <RefreshCw />}
          </span>
          <div>
            <DialogTitle className="text-lg font-bold">
              {u.phase === 'available' && '🔄 Nova atualização disponível'}
              {u.phase === 'downloading' && 'Baixando a atualização…'}
              {u.phase === 'ready' && 'Instalando e reiniciando…'}
              {u.phase === 'error' && 'Não foi possível atualizar'}
            </DialogTitle>
            {u.version && <DialogDescription className="text-sm text-muted-foreground">Versão {current} → <b className="text-foreground">{u.version}</b></DialogDescription>}
          </div>
        </div>

        {u.phase === 'available' && (
          <>
            {u.notes && <div className="mb-4 max-h-44 overflow-auto whitespace-pre-wrap rounded-2xl bg-muted/60 p-3.5 text-[13px] leading-relaxed">{u.notes}</div>}
            <p className="text-sm">Deseja atualizar agora? O programa baixa, instala a nova versão no lugar da antiga e reabre sozinho.</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="secondary" size="lg" onClick={close}>Não</Button>
              <Button size="lg" onClick={() => { setAttempt(true); void api.update.download() }}>Sim, atualizar</Button>
            </div>
          </>
        )}
        {u.phase === 'downloading' && (
          <div className="py-2">
            <Progress value={u.percent ?? 0} className="h-3" indeterminate={!u.percent} />
            <p className="mt-2 text-right text-sm tabular-nums text-muted-foreground">{u.percent ?? 0}%</p>
          </div>
        )}
        {u.phase === 'ready' && <p className="text-sm text-muted-foreground">Não feche o programa. Ele reabre automaticamente em instantes.</p>}
        {u.phase === 'error' && (
          <>
            <p className="rounded-2xl bg-destructive/15 p-3.5 text-sm text-destructive">{u.error}</p>
            <div className="mt-5 flex justify-end"><Button variant="secondary" size="lg" onClick={close}>Fechar</Button></div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
