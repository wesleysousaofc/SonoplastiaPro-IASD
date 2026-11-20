import { Sparkles } from 'lucide-react'
import { appStore, useApp } from '@/lib/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** Aparece na primeira abertura depois de uma atualização: mostra o que mudou. */
export function WhatsNewDialog(): JSX.Element {
  const w = useApp((s) => s.whatsNew)
  const close = (): void => appStore.set({ whatsNew: null })
  return (
    <Dialog open={!!w} onOpenChange={(o) => !o && close()}>
      {w && (
        <DialogContent className="w-[min(92vw,520px)]">
          <div className="mb-4 flex items-center gap-3.5">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white"><Sparkles /></span>
            <div>
              <DialogTitle className="text-lg font-bold">✨ O que há de novo</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Versão {w.version}{w.title ? ` · ${w.title}` : ''}</DialogDescription>
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed">
            {w.items ? (
              <ul className="space-y-2">
                {w.items.map((it, i) => <li key={i} className="flex gap-2"><span>✅</span><span>{it}</span></li>)}
              </ul>
            ) : <p className="whitespace-pre-wrap">{w.notes}</p>}
          </div>
          <div className="mt-5 flex justify-end"><Button size="lg" onClick={close}>Entendi</Button></div>
        </DialogContent>
      )}
    </Dialog>
  )
}
