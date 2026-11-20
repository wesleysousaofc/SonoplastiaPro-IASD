import { Cast, FileSearch, FolderOpen, Film, Music, Trash2 } from 'lucide-react'
import type { LibraryItem } from '@shared/types'
import { isAudioMode } from '@shared/types'
import { api } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { formatBytes, timeAgo } from '@/lib/format'
import { mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Empty } from './HomePage'

export function LibraryPage(): JSX.Element {
  const items = useApp((s) => s.library)
  return (
    <div className="px-6 pb-10 pt-2">
      <h1 className="mb-1 text-xl font-bold">Biblioteca</h1>
      <p className="mb-5 text-sm text-muted-foreground">Tudo o que você baixou. Toque em “Telão” para reproduzir direto na tela escolhida.</p>
      {items.length === 0 ? (
        <Empty icon={<Film />} title="Sua biblioteca está vazia" text="Os arquivos baixados aparecem aqui." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(285px,1fr))] gap-x-5 gap-y-8">{items.map((i) => <Card key={i.path} item={i} />)}</div>
      )}
    </div>
  )
}

function Card({ item: i }: { item: LibraryItem }): JSX.Element {
  const audio = i.mode ? isAudioMode(i.mode) : /\.(mp3|m4a|wav|flac|ogg|aac|opus)$/i.test(i.path)
  const thumb = i.thumb ? mediaUrl(i.thumb) : i.remoteThumb
  return (
    <article className="spa-video-card">
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl bg-muted ring-1 ring-white/5">
        {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : audio ? <Music className="size-10 text-muted-foreground" /> : <Film className="size-10 text-muted-foreground" />}
        {i.missing && <span className="absolute inset-0 grid place-items-center bg-black/70 text-sm font-semibold text-white">Arquivo não encontrado</span>}
      </div>
      <div className="px-1 pt-3">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug" title={i.title}>{i.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{[i.mode, formatBytes(i.size), timeAgo(i.downloadedAt)].filter((x) => x && x !== '—').join(' · ')}</p>
        <div className="mt-3 flex items-center gap-2">
          {i.missing ? (
            <Button size="sm" onClick={() => void api.library.relocate(i.path)}><FileSearch /> Localizar…</Button>
          ) : (
            <Button size="sm" onClick={() => appStore.set({ playTarget: i })}><Cast /> Telão</Button>
          )}
          <Button size="icon-sm" variant="secondary" title="Mostrar na pasta" onClick={() => void api.library.showFile(i.path)}><FolderOpen /></Button>
          <Button size="icon-sm" variant="secondary" title="Remover da biblioteca (não apaga o arquivo)" onClick={() => void api.library.remove(i.path)}><Trash2 /></Button>
        </div>
      </div>
    </article>
  )
}
