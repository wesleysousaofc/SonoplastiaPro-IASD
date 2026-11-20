import { useState } from 'react'
import { ArrowDownToLine, CircleX, FolderOpen, Pause, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { DownloadJob, DownloadStatus } from '@shared/types'
import { api, openDownload } from '@/lib/actions'
import { useApp } from '@/lib/store'
import { formatBytes, formatEta, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Empty } from './HomePage'

const STATUS: Record<DownloadStatus, { label: string; cls: string }> = {
  queued: { label: 'Na fila', cls: 'bg-muted text-muted-foreground' },
  downloading: { label: 'Baixando', cls: 'bg-primary/20 text-primary' },
  processing: { label: 'Finalizando…', cls: 'bg-warning/20 text-warning' },
  paused: { label: 'Pausado', cls: 'bg-muted text-muted-foreground' },
  later: { label: 'Para depois', cls: 'bg-muted text-muted-foreground' },
  done: { label: 'Concluído', cls: 'bg-success/20 text-success' },
  error: { label: 'Erro', cls: 'bg-destructive/20 text-destructive' },
  canceled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' }
}
type Tab = 'all' | 'active' | 'done' | 'error'
const TABS: { key: Tab; label: string; test: (j: DownloadJob) => boolean }[] = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'active', label: 'Em andamento', test: (j) => ['queued', 'downloading', 'processing', 'paused', 'later'].includes(j.status) },
  { key: 'done', label: 'Concluídos', test: (j) => j.status === 'done' },
  { key: 'error', label: 'Com erro', test: (j) => j.status === 'error' || j.status === 'canceled' }
]

export function DownloadsPage(): JSX.Element {
  const jobs = useApp((s) => s.downloads)
  const [tab, setTab] = useState<Tab>('all')
  const t = TABS.find((x) => x.key === tab)!
  const list = jobs.filter(t.test)
  return (
    <div className="px-6 pb-10 pt-2">
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <h1 className="mr-3 text-xl font-bold">Downloads</h1>
        {TABS.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)} className={cn('h-9 rounded-full px-4 text-sm font-semibold transition-colors', tab === x.key ? 'bg-foreground text-background' : 'bg-secondary hover:bg-secondary/70')}>
            {x.label} <span className="ml-1 opacity-60">{jobs.filter(x.test).length}</span>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => openDownload({ url: '' })}><Plus /> Adicionar URL</Button>
          <Button size="sm" variant="secondary" onClick={() => void api.downloads.startAll()}><Play /> Iniciar fila</Button>
          <Button size="sm" variant="secondary" onClick={() => void api.downloads.clearFinished()}><Trash2 /> Limpar concluídos</Button>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty icon={<ArrowDownToLine />} title="Nenhum download aqui" text="Escolha um vídeo na tela inicial e toque em Baixar, ou use Adicionar URL." />
      ) : (
        <div className="space-y-3">{list.map((j) => <Row key={j.id} job={j} />)}</div>
      )}
    </div>
  )
}

function Row({ job: j }: { job: DownloadJob }): JSX.Element {
  const st = STATUS[j.status]
  const running = j.status === 'downloading' || j.status === 'processing'
  return (
    <div className="spa-card glass flex items-center gap-4 rounded-2xl p-3.5">
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {j.thumbnail ? <img src={j.thumbnail} alt="" className="size-full object-cover" /> : <ArrowDownToLine className="m-auto mt-4 size-6 text-muted-foreground" />}
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{j.mode}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <p className="truncate font-semibold" title={j.title}>{j.title}</p>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold', st.cls)}>{st.label}</span>
        </div>
        {j.status === 'error' ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-destructive">{j.error}</p>
        ) : (
          <>
            <Progress value={j.percent} className="mt-2.5 h-2" indeterminate={running && j.percent === 0} />
            <div className="mt-1.5 flex gap-4 text-xs tabular-nums text-muted-foreground">
              <span>{Math.round(j.percent)}%</span>
              <span>{j.total ? `${formatBytes(j.downloaded || undefined)} de ${formatBytes(j.total)}` : formatBytes(j.total)}</span>
              {j.status === 'downloading' && <><span>{formatSpeed(j.speed)}</span><span>restam {formatEta(j.eta)}</span></>}
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {running && <Button size="icon-sm" variant="secondary" title="Pausar" onClick={() => void api.downloads.pause(j.id)}><Pause /></Button>}
        {(j.status === 'paused' || j.status === 'later' || j.status === 'queued') && <Button size="icon-sm" title="Iniciar / continuar" onClick={() => void api.downloads.resume(j.id)}><Play /></Button>}
        {(j.status === 'error' || j.status === 'canceled') && <Button size="icon-sm" title="Tentar de novo" onClick={() => void api.downloads.retry(j.id)}><RotateCcw /></Button>}
        {j.status === 'done' && <Button size="icon-sm" variant="secondary" title="Mostrar na pasta" onClick={() => void api.downloads.showFile(j.id)}><FolderOpen /></Button>}
        {!['done', 'error', 'canceled'].includes(j.status) && <Button size="icon-sm" variant="secondary" title="Cancelar" onClick={() => void api.downloads.cancel(j.id)}><CircleX /></Button>}
        <Button size="icon-sm" variant="ghost" title="Remover da lista" onClick={() => void api.downloads.remove(j.id)}><X /></Button>
      </div>
    </div>
  )
}
