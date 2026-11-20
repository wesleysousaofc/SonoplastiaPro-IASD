import { api } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ConfirmCloseDialog(): JSX.Element {
  const open = useApp((s) => s.confirmClose)
  const active = useApp((s) => s.downloads.filter((d) => d.status === 'downloading' || d.status === 'processing').length)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && appStore.set({ confirmClose: false })}>
      <DialogContent className="w-[min(92vw,430px)]">
        <DialogTitle className="text-lg font-bold">Fechar o programa?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Há {active} download{active === 1 ? '' : 's'} em andamento. Se fechar agora, eles ficam pausados e você pode continuar depois.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" size="lg" onClick={() => appStore.set({ confirmClose: false })}>Continuar aqui</Button>
          <Button variant="destructive" size="lg" onClick={() => api.win.forceClose()}>Fechar mesmo assim</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
