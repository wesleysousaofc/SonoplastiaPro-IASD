import { useState } from 'react'
import { Download, Send, Share2, Trash2 } from 'lucide-react'
import { api, pushToast } from '@/lib/actions'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function LocalSendPage(): JSX.Element {
  const receiving = useApp((s) => s.receiving)
  const baseDir = useApp((s) => s.settings.downloadDir)
  const [tab, setTab] = useState<'receive' | 'send'>('receive')
  const [dir, setDir] = useState(baseDir ? baseDir.replace(/[^\\/]+$/, 'Recebidos') : '')
  const [files, setFiles] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  // trava de 1,5 s: clicar várias vezes não abre várias janelas nem enche a tela de avisos
  const guard = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      window.setTimeout(() => setBusy(false), 1500)
    }
  }

  const toggleReceive = (): Promise<void> =>
    guard(async () => {
      if (receiving) {
        await api.localsend.stopReceive()
        pushToast({ kind: 'info', key: 'localsend', title: 'Recebimento encerrado', message: 'O LocalSend foi fechado.' })
        return
      }
      const err = await api.localsend.startReceive(dir)
      if (err) pushToast({ kind: 'error', key: 'localsend', title: 'Falha ao iniciar o recebimento', message: err })
      else pushToast({ kind: 'info', key: 'localsend', title: 'LocalSend aberto 📡', message: `Recebendo em: ${dir}\nNa janela preta do LocalSend, aceite o arquivo quando ele chegar.` })
    })

  const send = (): Promise<void> =>
    guard(async () => {
      const err = await api.localsend.send(files)
      if (err) return pushToast({ kind: 'error', key: 'localsend', title: 'Falha ao abrir o LocalSend', message: err })
      pushToast({ kind: 'success', key: 'localsend', title: 'LocalSend aberto', message: `${files.length} arquivo(s) prontos. Escolha o dispositivo na janela do LocalSend.` })
      setFiles([])
    })

  return (
    <div className="mx-auto max-w-3xl px-6 pb-10 pt-2">
      <div className="mb-5 flex items-center gap-3.5">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white"><Share2 /></span>
        <div><h1 className="text-xl font-bold">LocalSend</h1><p className="text-sm text-muted-foreground">Compartilhe arquivos na sua rede local</p></div>
      </div>
      <div className="mb-4 inline-flex gap-1 rounded-full bg-secondary p-1">
        {(['receive', 'send'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn('h-9 rounded-full px-6 text-sm font-semibold', tab === k ? 'bg-brand text-white' : 'text-muted-foreground')}>{k === 'receive' ? 'Receber' : 'Enviar'}</button>
        ))}
      </div>

      {tab === 'receive' ? (
        <div className="spa-card glass rounded-3xl p-6">
          <div className="grid place-items-center py-6 text-center">
            <span className="mb-4 grid size-16 place-items-center rounded-full bg-primary/15 text-primary"><Download className="size-7" /></span>
            <p className="text-lg font-bold">Pronto para receber</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Este computador pode receber arquivos de outros aparelhos na mesma rede.</p>
            <p className={cn('mt-3 text-xs font-semibold', receiving ? 'text-success' : 'text-muted-foreground')}>{receiving ? '● Recebendo arquivos' : 'Recebimento desligado'}</p>
          </div>
          <p className="mb-1.5 pl-1 text-xs font-semibold text-muted-foreground">Salvar arquivos recebidos em</p>
          <div className="flex gap-2.5">
            <input className="field" value={dir} onChange={(e) => setDir(e.target.value)} />
            <Button variant="secondary" onClick={async () => { const p = await api.dialog.pickFolder(dir); if (p) setDir(p) }}>Escolher pasta</Button>
            <Button disabled={busy} onClick={() => void toggleReceive()}>{receiving ? 'Parar' : 'Iniciar'}</Button>
          </div>
        </div>
      ) : (
        <div className="spa-card glass rounded-3xl p-6">
          <div className="mb-3 flex items-center">
            <p className="font-bold">Arquivos para enviar</p>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={async () => { const p = await api.dialog.pickFiles(); setFiles((f) => [...new Set([...f, ...p])]) }}>Adicionar arquivos</Button>
          </div>
          <div className="min-h-40 rounded-2xl border bg-input p-2">
            {files.length === 0 ? <p className="py-14 text-center text-sm text-muted-foreground">Nenhum arquivo selecionado.</p> : files.map((f) => <p key={f} className="truncate rounded-lg px-3 py-1.5 text-[13px] hover:bg-accent" title={f}>{f}</p>)}
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <p className="flex-1 text-xs text-muted-foreground">O LocalSend abrirá a seleção de dispositivos disponíveis.</p>
            <Button variant="secondary" onClick={() => setFiles([])}><Trash2 /> Limpar</Button>
            <Button disabled={!files.length || busy} onClick={() => void send()}><Send /> Enviar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
