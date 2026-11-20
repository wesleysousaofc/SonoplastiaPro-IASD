import { Mic, MicOff } from 'lucide-react'
import type { VoiceStatus } from '@shared/types'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/actions'

export interface VoiceUi {
  open: boolean
  listening: boolean
  status?: VoiceStatus
  detail?: string
}

const MESSAGES: Record<VoiceStatus, string> = {
  ok: '',
  norecognizer: 'O reconhecimento de voz do Windows não está instalado. Adicione o idioma Português (Brasil) com reconhecimento de fala.',
  nomic: 'Não encontrei um microfone disponível. Confira se ele está conectado e liberado para aplicativos.',
  nospeech: 'Não consegui entender. Toque no microfone e fale de novo, perto do microfone.',
  nopowershell: 'A pesquisa por voz precisa do Windows PowerShell, que não foi encontrado.',
  error: 'Não foi possível usar a pesquisa por voz agora.'
}

export function VoiceOverlay({ ui, onClose, onRetry }: { ui: VoiceUi; onClose: () => void; onRetry: () => void }): JSX.Element {
  return (
    <Dialog open={ui.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(92vw,420px)] text-center">
        <div className="relative mx-auto my-4 grid size-24 place-items-center">
          {ui.listening && (
            <>
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30 [animation-delay:.5s]" />
            </>
          )}
          <span className={`relative grid size-20 place-items-center rounded-full ${ui.listening ? 'bg-brand text-white' : 'bg-destructive/90 text-white'}`}>
            {ui.listening ? <Mic className="size-9" /> : <MicOff className="size-9" />}
          </span>
        </div>
        <DialogTitle className="text-lg font-bold">{ui.listening ? 'Ouvindo… 🎙️' : 'Pesquisa por voz'}</DialogTitle>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          {ui.listening ? 'Fale agora o que você quer pesquisar.' : ui.status === 'error' && ui.detail ? `${MESSAGES.error}\n${ui.detail}` : MESSAGES[ui.status ?? 'error']}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!ui.listening && (ui.status === 'norecognizer' || ui.status === 'nomic') && (
            <Button variant="secondary" size="sm" onClick={() => void api.voice.openSettings(ui.status === 'nomic' ? 'mic' : 'speech')}>
              Abrir configurações do Windows
            </Button>
          )}
          {!ui.listening && <Button size="sm" onClick={onRetry}>Tentar de novo</Button>}
          <Button variant="secondary" size="sm" onClick={onClose}>{ui.listening ? 'Cancelar' : 'Fechar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
