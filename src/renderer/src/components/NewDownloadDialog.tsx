import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, FolderOpen, Pencil, Play, X } from 'lucide-react'
import { AUDIO_MODES, VIDEO_MODES, type Mode, type QualityChoice } from '@shared/types'
import { api, patchSettings, pushToast } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { formatBytes } from '@/lib/format'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

export function NewDownloadDialog(): JSX.Element {
  const target = useApp((s) => s.downloadDialog)
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && appStore.set({ downloadDialog: null })}>
      {target && <Inner item={target.item} initialUrl={target.url} />}
    </Dialog>
  )
}

const Label = ({ children }: { children: React.ReactNode }): JSX.Element => <p className="mb-1.5 pl-1 text-xs font-semibold text-muted-foreground">{children}</p>

function Inner({ item, initialUrl }: { item?: { title: string; url: string; thumbnail: string }; initialUrl?: string }): JSX.Element {
  const baseDir = useApp((s) => s.settings.downloadDir)
  const [url, setUrl] = useState(item?.url ?? initialUrl ?? '')
  const [name, setName] = useState(item?.title ?? '')
  const [thumb, setThumb] = useState(item?.thumbnail ?? '')
  const [category, setCategory] = useState<'video' | 'audio'>('video')
  const [mode, setMode] = useState<Mode>('MP4')
  const [choices, setChoices] = useState<QualityChoice[]>([])
  const [quality, setQuality] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [folder, setFolder] = useState(baseDir)
  const [free, setFree] = useState<number | null>(null)
  const [playlist, setPlaylist] = useState(false)
  const nameTouched = useRef(!!item?.title)

  const valid = /^https?:\/\//i.test(url.trim())
  const isPlaylistUrl = /[?&]list=/.test(url)

  // consulta qualidades/tamanho sempre que o link ou o formato mudar
  useEffect(() => {
    if (!valid) return
    let cancelled = false
    setLoading(true)
    setErr('')
    const t = window.setTimeout(() => {
      api.qualities
        .get(url.trim(), mode)
        .then((info) => {
          if (cancelled) return
          setChoices(info.choices)
          setQuality((q) => (info.choices.some((c) => c.label === q) ? q : info.choices[0]?.label ?? ''))
          if (!nameTouched.current && info.title) setName(info.title)
          if (info.thumbnail) setThumb(info.thumbnail)
        })
        .catch((e: Error) => !cancelled && setErr(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
        .finally(() => !cancelled && setLoading(false))
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [url, mode, valid])

  useEffect(() => {
    let off = false
    api.system.diskFree(folder).then((f) => !off && setFree(f)).catch(() => undefined)
    return () => {
      off = true
    }
  }, [folder])

  const chosen = choices.find((c) => c.label === quality)
  const modes = category === 'video' ? VIDEO_MODES : AUDIO_MODES

  const submit = async (startNow: boolean): Promise<void> => {
    if (!valid) return
    await api.downloads.add(
      {
        url: url.trim(), title: name.trim() || item?.title || 'Vídeo selecionado', thumbnail: thumb || undefined, mode, quality,
        qualityValue: chosen?.value ?? null, folder, fileName: nameTouched.current && name.trim() ? name.trim() : undefined,
        playlist: playlist && isPlaylistUrl, sizeEstimate: chosen?.size ?? null
      },
      startNow
    )
    if (folder !== baseDir) void patchSettings({ downloadDir: folder })
    appStore.set({ downloadDialog: null })
    pushToast({ kind: 'info', title: startNow ? 'Download iniciado ⬇️' : 'Guardado para depois 🕒', message: name || url })
  }

  return (
    <DialogContent>
      <DialogTitle className="sr-only">Nova tarefa de download</DialogTitle>
      <div className="mb-5 flex items-center gap-3.5">
        <div className="relative grid h-14 w-[88px] shrink-0 place-items-center overflow-hidden rounded-xl bg-brand">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <Play className="size-6 fill-white text-white" />}
          <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 text-[10px] font-bold text-white">{mode}</span>
        </div>
        <div className="relative flex-1">
          <Pencil className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field pl-9 font-semibold"
            value={name}
            placeholder="Nome do arquivo (pode usar emojis 😀)"
            onChange={(e) => {
              nameTouched.current = true
              setName(e.target.value)
            }}
          />
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3.5 py-2.5 text-sm font-bold tabular-nums">{loading ? '…' : formatBytes(chosen?.size)}</span>
      </div>

      <Label>URL</Label>
      <input className="field text-[13px]" value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setUrl(e.target.value.trim())} onFocus={async (e) => { if (!url) { const c = await api.app.clipboardRead(); if (/^https?:\/\//i.test(c)) { setUrl(c.trim()); e.target.select() } } }} />
      {err && <p className="mt-2 rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive">{err}</p>}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <Label>Categoria</Label>
          <Select value={category} onChange={(e) => { const c = e.target.value as 'video' | 'audio'; setCategory(c); setMode(c === 'video' ? 'MP4' : 'MP3') }}>
            <option value="video">🎬 Vídeo</option>
            <option value="audio">🎵 Áudio</option>
          </Select>
        </div>
        <div>
          <Label>Formato</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {modes.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <div>
          <Label>Qualidade</Label>
          <Select value={quality} disabled={!choices.length} onChange={(e) => setQuality(e.target.value)}>
            {!choices.length && <option>{loading ? 'Consultando…' : '—'}</option>}
            {choices.map((c) => <option key={c.label}>{c.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Label>Salvar em</Label>
        <div className="flex h-11 items-center gap-2.5 rounded-xl border bg-input pl-3.5 pr-1.5">
          <FolderOpen className="size-[18px] shrink-0 text-primary" />
          <input className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <span className="shrink-0 text-xs text-muted-foreground">Disponível: {formatBytes(free)}</span>
          <Button size="icon-sm" variant="secondary" title="Escolher pasta" onClick={async () => { const p = await api.dialog.pickFolder(folder); if (p) setFolder(p) }}>…</Button>
        </div>
      </div>

      {isPlaylistUrl && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 pl-1 text-sm">
          <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={playlist} onChange={(e) => setPlaylist(e.target.checked)} /> Baixar a playlist inteira
        </label>
      )}

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <Button variant="secondary" size="lg" className="mr-auto" disabled={!valid} onClick={() => void submit(false)}>Baixar depois</Button>
        <Button variant="secondary" size="lg" onClick={() => appStore.set({ downloadDialog: null })}>Cancelar <X className="text-destructive" /></Button>
        <Button size="lg" disabled={!valid} onClick={() => void submit(true)}>Baixar <ArrowDownToLine /></Button>
      </div>
    </DialogContent>
  )
}
