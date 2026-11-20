import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import type { Channel, FeedState, VideoItem } from '../shared/types'
import { dataDir, logsDir } from './paths'
import { mapChannelEntries, parseRss, RssEntry } from './parsers'
import { checkVideo, runJson } from './ytdlp'
import { getSettings } from './settings'

const NEW_HOURS = 48
const PER_CHANNEL = 20

interface Cache {
  items: VideoItem[]
  known: string[]
  updatedAt: number
  verified?: Record<string, { ok: boolean; at: number }>
}

const RECHECK_BLOCKED_MS = 3 * 3600_000 // estreias agendadas são checadas de novo depois de 3 h

const log = (msg: string): void => {
  try {
    appendFileSync(join(logsDir(), 'canais.log'), `${new Date().toISOString()} ${msg}\n`, 'utf-8')
  } catch {
    /* sem log */
  }
}

async function fetchRss(ch: Channel): Promise<RssEntry[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return parseRss(await r.text())
  } finally {
    clearTimeout(t)
  }
}

/** Mesma abordagem do MediaFácil: lista do canal via yt-dlp (traz duração e descarta lives/exclusivos). */
async function fetchChannelYtdlp(ch: Channel): Promise<VideoItem[]> {
  const url = `https://www.youtube.com/channel/${ch.id}/videos`
  const base = ['--flat-playlist', '--playlist-end', '50', '--ignore-errors', '--extractor-args', 'youtubetab:approximate_date=true', url]
  const [loc, stat] = await Promise.all([
    runJson(base, { lang: 'pt', allowPartial: true, timeoutMs: 120000 }),
    runJson(base, { lang: 'en', allowPartial: true, timeoutMs: 120000 })
  ])
  if (!loc?.entries || !stat?.entries) throw new Error('A lista de vídeos do canal não pôde ser carregada.')
  const titles = new Map<string, string>()
  for (const e of loc.entries) if (e?.id && e.title) titles.set(e.id, e.title)
  return mapChannelEntries(stat.entries, titles, ch.name, ch.id)
}

export class FeedService {
  private items: VideoItem[] = []
  private known = new Set<string>()
  private rssSeen = new Set<string>()
  private verified: Record<string, { ok: boolean; at: number }> = {}
  private errors = new Set<string>()
  private refreshing = false
  private updatedAt = 0
  private fullTimer?: NodeJS.Timeout
  private pollTimer?: NodeJS.Timeout
  private cacheFile = join(dataDir(), 'feed-cache.json')

  constructor(
    private channels: () => Channel[],
    private emit: (s: FeedState) => void,
    private onNew: (items: VideoItem[]) => void
  ) {
    try {
      if (existsSync(this.cacheFile)) {
        const c = JSON.parse(readFileSync(this.cacheFile, 'utf-8')) as Cache
        this.items = c.items ?? []
        this.known = new Set(c.known ?? [])
        this.updatedAt = c.updatedAt ?? 0
        this.verified = c.verified ?? {}
      }
    } catch {
      /* cache inválido */
    }
  }

  /** Marca o selo NOVO: último vídeo de cada canal (sem limite de tempo) ou publicado nas últimas 48 h. */
  state(): FeedState {
    const latest = new Map<string, string>()
    for (const ch of this.channels()) {
      const dated = this.items.filter((v) => v.channelId === ch.id && v.published)
      if (dated.length) latest.set(ch.id, dated.reduce((a, b) => (Date.parse(b.published!) > Date.parse(a.published!) ? b : a)).id)
    }
    const now = Date.now()
    const items = this.items
      .map((v) => {
        const age = v.published ? (now - Date.parse(v.published)) / 3600_000 : Infinity
        return { ...v, isNew: latest.get(v.channelId ?? '') === v.id || age <= NEW_HOURS }
      })
      .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
    return { items, updatedAt: this.updatedAt, refreshing: this.refreshing, errors: [...this.errors], channels: this.channels() }
  }

  start(light: boolean, refreshMinutes: number): void {
    this.schedule(light, refreshMinutes)
    void this.refresh()
  }

  schedule(light: boolean, refreshMinutes: number): void {
    clearInterval(this.fullTimer)
    clearInterval(this.pollTimer)
    const full = (light ? Math.max(refreshMinutes * 3, 30) : refreshMinutes) * 60_000
    const poll = (light ? 10 : 3) * 60_000
    this.fullTimer = setInterval(() => void this.refresh(), full)
    this.pollTimer = setInterval(() => void this.poll(), poll)
  }

  stop(): void {
    clearInterval(this.fullTimer)
    clearInterval(this.pollTimer)
  }

  /** Verificação rápida e barata (RSS): se aparecer vídeo novo, atualiza tudo na hora. */
  private async poll(): Promise<void> {
    if (this.refreshing) return
    try {
      let found = false
      for (const ch of this.channels()) {
        const entries = await fetchRss(ch)
        for (const e of entries) {
          if (!this.rssSeen.has(e.id)) {
            if (this.rssSeen.size > 0 && !this.known.has(e.id)) found = true
            this.rssSeen.add(e.id)
          }
        }
      }
      if (found) await this.refresh()
    } catch {
      /* sem internet: tenta na próxima */
    }
  }

  /**
   * Confere cada vídeo individualmente e mantém só os PÚBLICOS e já PUBLICADOS.
   * (A lista do canal nem sempre marca vídeos de membros/premium ou estreias agendadas.)
   * Resultado fica em cache: cada vídeo é conferido uma vez; os bloqueados são reavaliados depois de 3 h.
   */
  private async verify(items: VideoItem[]): Promise<{ items: VideoItem[]; unknown: number }> {
    const now = Date.now()
    const todo = items.filter((v) => {
      const c = this.verified[v.id]
      return !c || (!c.ok && now - c.at > RECHECK_BLOCKED_MS)
    })
    let unknown = 0
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < todo.length) {
        const v = todo[next++]
        const r = await checkVideo(v.id)
        if (r === 'unknown') unknown++
        else this.verified[v.id] = { ok: r === 'ok', at: Date.now() }
      }
    }
    await Promise.all(Array.from({ length: getSettings().lightMode ? 2 : 4 }, worker))
    return { items: items.filter((v) => this.verified[v.id]?.ok), unknown }
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true
    this.emit(this.state())
    const result: VideoItem[] = []
    const errors = new Set<string>()
    for (const ch of this.channels()) {
      let items: VideoItem[] | null = null
      try {
        items = await fetchChannelYtdlp(ch)
      } catch (e) {
        log(`[${ch.name}] yt-dlp falhou: ${(e as Error).message}`)
      }
      let rss: RssEntry[] | null = null
      try {
        rss = await fetchRss(ch)
        for (const r of rss) this.rssSeen.add(r.id)
      } catch (e) {
        log(`[${ch.name}] RSS falhou: ${(e as Error).message}`)
      }
      if (!items && rss) {
        items = rss.map((r) => ({
          id: r.id,
          title: r.title,
          url: `https://www.youtube.com/watch?v=${r.id}`,
          channel: ch.name,
          channelId: ch.id,
          thumbnail: `https://i.ytimg.com/vi/${r.id}/hq720.jpg`,
          published: r.published,
          viewCount: r.views ?? null
        }))
      } else if (items && rss) {
        const precise = new Map(rss.map((r) => [r.id, r]))
        items = items.map((v) => {
          const r = precise.get(v.id)
          return r ? { ...v, published: r.published || v.published, viewCount: v.viewCount ?? r.views ?? null } : v
        })
      }
      if (items) {
        const candidates = items.sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '')).slice(0, PER_CHANNEL + 10)
        const v = await this.verify(candidates)
        // se a conferência falhou (ex.: sem internet), não apaga a lista anterior
        if (v.unknown > 0 && v.items.length === 0) items = null
        else items = v.items
      }
      if (!items) {
        errors.add(ch.name)
        items = this.items.filter((v) => v.channelId === ch.id) // mantém a lista anterior
      }
      result.push(...items.sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '')).slice(0, PER_CHANNEL))
    }
    const fresh = result.filter((v) => !this.known.has(v.id))
    const hadKnown = this.known.size > 0
    for (const v of result) this.known.add(v.id)
    this.items = result
    this.errors = errors
    this.updatedAt = Date.now()
    this.refreshing = false
    try {
      writeFileSync(this.cacheFile, JSON.stringify({ items: result, known: [...this.known].slice(-500), updatedAt: this.updatedAt, verified: Object.fromEntries(Object.entries(this.verified).slice(-800)) } satisfies Cache), 'utf-8')
    } catch {
      /* cache é opcional */
    }
    this.emit(this.state())
    if (hadKnown && fresh.length) this.onNew(fresh)
  }
}
