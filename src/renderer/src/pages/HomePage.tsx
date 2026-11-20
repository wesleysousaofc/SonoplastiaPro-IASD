import { RefreshCw, SearchX, WifiOff, X } from 'lucide-react'
import { api, clearSearch } from '@/lib/actions'
import { appStore, useApp } from '@/lib/store'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VideoGrid, VideoSkeleton } from '@/components/VideoCard'

export function HomePage(): JSX.Element {
  const feed = useApp((s) => s.feed)
  const channel = useApp((s) => s.homeChannel)
  const results = useApp((s) => s.searchResults)
  const searching = useApp((s) => s.searching)
  const searchError = useApp((s) => s.searchError)
  const query = useApp((s) => s.query)

  const inSearch = results !== null || searching || !!searchError
  const items = channel ? feed.items.filter((v) => v.channelId === channel) : feed.items

  return (
    <div className="px-6 pb-10 pt-2">
      {inSearch ? (
        <div className="mb-5 flex items-center gap-3">
          <h1 className="text-xl font-bold">{searching ? `Buscando “${query}”…` : `Resultados para “${query}”`}</h1>
          {!searching && results && <span className="text-sm text-muted-foreground">{results.length} vídeos</span>}
          <Button size="sm" variant="secondary" className="ml-auto" onClick={clearSearch}><X /> Voltar aos canais</Button>
        </div>
      ) : (
        <div className="sticky top-0 z-10 -mx-6 mb-5 flex flex-wrap items-center gap-2 bg-background/70 px-6 py-3 backdrop-blur-md">
          <Chip active={channel === null} onClick={() => appStore.set({ homeChannel: null })}>📺 Todos</Chip>
          {feed.channels.map((c) => (
            <Chip key={c.id} active={channel === c.id} onClick={() => appStore.set({ homeChannel: c.id })}>{c.emoji} {c.short}</Chip>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{feed.refreshing ? 'Atualizando…' : feed.updatedAt ? `Atualizado ${timeAgo(feed.updatedAt)}` : ''}</span>
          <Button size="sm" variant="secondary" disabled={feed.refreshing} onClick={() => void api.feed.refresh()}>
            <RefreshCw className={cn(feed.refreshing && 'animate-spin')} /> Atualizar
          </Button>
        </div>
      )}

      {!inSearch && feed.errors.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning">
          <WifiOff className="size-4 shrink-0" /> Não foi possível atualizar: {feed.errors.join(', ')}. Mantive a lista anterior; tento de novo automaticamente.
        </div>
      )}

      {inSearch ? (
        searching ? <VideoSkeleton /> : searchError ? <Empty icon={<WifiOff />} title="A busca falhou" text={searchError} /> : results && results.length ? <VideoGrid items={results} /> : <Empty icon={<SearchX />} title="Nenhum vídeo encontrado" text="Tente outras palavras." />
      ) : items.length ? (
        <VideoGrid items={items} />
      ) : feed.refreshing ? (
        <VideoSkeleton />
      ) : (
        <Empty icon={<WifiOff />} title="Ainda sem vídeos" text="Confira a conexão e toque em Atualizar." />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button onClick={onClick} className={cn('h-9 rounded-full px-4 text-sm font-semibold transition-colors', active ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70')}>
      {children}
    </button>
  )
}

export function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text?: string }): JSX.Element {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-7">{icon}</div>
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
    </div>
  )
}
