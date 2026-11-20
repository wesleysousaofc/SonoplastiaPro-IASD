// Lógica pura (sem Electron): interpretação de dados do yt-dlp/RSS, argumentos de download etc.
import type { Mode, QualityChoice, VideoItem } from '../shared/types'
import { isAudioMode } from '../shared/types'

/* ------------------------------------------------------------------ RSS do YouTube */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

export interface RssEntry {
  id: string
  title: string
  published: string
  views?: number
}

export function parseRss(xml: string): RssEntry[] {
  const out: RssEntry[] = []
  const re = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const b = m[1]
    const id = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(b)?.[1]
    const title = /<title>([\s\S]*?)<\/title>/.exec(b)?.[1]
    const published = /<published>([^<]+)<\/published>/.exec(b)?.[1] ?? ''
    const views = /<media:statistics views="(\d+)"/.exec(b)?.[1]
    if (id && title) out.push({ id, title: decodeEntities(title.trim()), published, views: views ? Number(views) : undefined })
  }
  return out
}

/* ------------------------------------------------------------------ Feed dos canais (yt-dlp --flat-playlist) */
const RESTRICTED = new Set(['subscriber_only', 'premium_only', 'needs_auth', 'private'])
const LIVE_STATES = new Set(['is_live', 'is_upcoming', 'upcoming'])
const ymd = (s: string): string => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapChannelEntries(
  entries: any[],
  localizedTitles: Map<string, string>,
  channelName: string,
  channelId: string,
  nowMs: number = Date.now()
): VideoItem[] {
  const items: VideoItem[] = []
  const seen = new Set<string>()
  const todayYmd = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '')
  for (const e of entries) {
    if (!e) continue
    if (LIVE_STATES.has(e.live_status)) continue // lives e estreias agendadas
    if (RESTRICTED.has(e.availability)) continue // só membros / premium / privado
    if (!e.duration) continue
    if (typeof e.release_timestamp === 'number' && e.release_timestamp * 1000 > nowMs) continue
    if (typeof e.release_date === 'string' && e.release_date.length === 8 && e.release_date > todayYmd) continue
    if (typeof e.timestamp === 'number' && e.timestamp * 1000 > nowMs) continue
    const id: string | undefined = e.id
    if (!id || seen.has(id)) continue
    let published = ''
    if (typeof e.timestamp === 'number') published = new Date(e.timestamp * 1000).toISOString()
    else if (typeof e.upload_date === 'string' && e.upload_date.length === 8) published = ymd(e.upload_date)
    else if (typeof e.release_timestamp === 'number') published = new Date(e.release_timestamp * 1000).toISOString()
    else if (typeof e.release_date === 'string' && e.release_date.length === 8) published = ymd(e.release_date)
    seen.add(id)
    items.push({
      id,
      title: localizedTitles.get(id) || e.title || 'Vídeo sem título',
      url: `https://www.youtube.com/watch?v=${id}`,
      channel: channelName,
      channelId,
      thumbnail: `https://i.ytimg.com/vi/${id}/hq720.jpg`,
      duration: e.duration,
      published,
      viewCount: typeof e.view_count === 'number' ? e.view_count : null
    })
  }
  return items
}

/* ------------------------------------------------------------------ Qualidades */
export function preferredAudioFormats(formats: any[]): any[] {
  const audio = formats.filter((f) => f.acodec && f.acodec !== 'none')
  const pt = audio.filter((f) => String(f.language ?? '').toLowerCase().replace('_', '-').startsWith('pt'))
  return pt.length ? pt : audio
}
export function preferredAudioSelector(formatId?: string | number | null): string {
  if (formatId) return `${formatId}[language^=pt]/${formatId}/bestaudio[language^=pt]/bestaudio/best`
  return 'bestaudio[language^=pt]/bestaudio/best'
}
const MAX_H264_HEIGHT = 1080
const rate = (f: any): number => Math.round(f.abr || f.tbr || 0)
export function heightLabel(h: number, mp4: boolean): string {
  const tag = h >= 4320 ? ' 8K' : h >= 2160 ? ' 4K' : h >= 1440 ? ' 2K' : ''
  return tag ? `${h}p${tag}` : mp4 ? `${h}p (MP4)` : `${h}p`
}
const fsize = (f: any): number => f?.filesize || f?.filesize_approx || 0

export function buildQualityChoices(formats: any[], mode: Mode, duration = 0): QualityChoice[] {
  const choices: QualityChoice[] = []
  if (isAudioMode(mode)) {
    const audio = preferredAudioFormats(formats)
    const best = audio.length ? audio.reduce((a, b) => (rate(b) > rate(a) ? b : a)) : null
    if (mode === 'MP3') {
      const source = best ? rate(best) || 320 : 320
      for (const r of [320, 256, 192, 128]) {
        if (r <= source) choices.push({ label: `${r} kb/s MP3`, value: best?.format_id ?? null, size: duration ? (duration * r * 1000) / 8 : null })
      }
      if (!choices.length) choices.push({ label: '128 kb/s MP3', value: best?.format_id ?? null, size: duration ? (duration * 16000) : null })
    } else {
      const seenRates = new Set<number>()
      for (const f of [...audio].sort((a, b) => rate(b) - rate(a))) {
        const r = rate(f)
        if (r && !seenRates.has(r)) {
          seenRates.add(r)
          choices.push({ label: `${r} kb/s de origem`, value: f.format_id, size: fsize(f) || (duration ? (duration * r * 1000) / 8 : null) })
        }
      }
    }
  } else {
    const wantMp4 = mode === 'MP4'
    const allVideo = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
    const isAvc = (f: any): boolean => f.ext === 'mp4' && String(f.vcodec).startsWith('avc1')
    const audioBest = preferredAudioFormats(formats).sort((a, b) => fsize(b) - fsize(a))[0]
    const heights = [...new Set<number>(allVideo.map((f) => f.height as number))].sort((a, b) => b - a)
    for (const h of heights) {
      const sameH = allVideo.filter((f) => f.height === h)
      const hasAvc = sameH.some(isAvc)
      // Até 1080p o MP4 usa H.264 (toca em qualquer aparelho). Acima disso (2K/4K/8K) o YouTube só oferece VP9/AV1:
      // entra na lista mesmo assim e o arquivo final sai em MP4 (ou MKV, se o MP4 não comportar os codecs).
      if (wantMp4 && h <= MAX_H264_HEIGHT && !hasAvc) continue
      const top = (wantMp4 && h <= MAX_H264_HEIGHT ? sameH.filter(isAvc) : sameH).sort((a, b) => fsize(b) - fsize(a))[0]
      const total = fsize(top) + fsize(audioBest)
      choices.push({ label: heightLabel(h, wantMp4), value: h, size: total || null })
    }
  }
  if (!choices.length) choices.push({ label: 'Padrão do formato', value: null, size: null })
  return choices
}

/* ------------------------------------------------------------------ Argumentos do download */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180)
}

export function buildFormatArgs(mode: Mode, qualityLabel: string, qualityValue: number | string | null): string[] {
  const h = typeof qualityValue === 'number' ? qualityValue : null
  const cap = h ? `[height<=${h}]` : ''
  const meta = ['--embed-metadata', '--embed-thumbnail', '--convert-thumbnails', 'jpg']
  if (mode === 'MP3' || mode === 'M4A' || mode === 'WAV') {
    const args = ['-f', preferredAudioSelector(typeof qualityValue === 'string' ? qualityValue : null), '-x', '--audio-format', mode.toLowerCase()]
    if (mode === 'MP3') {
      const kbps = parseInt(qualityLabel, 10)
      args.push('--audio-quality', `${Number.isFinite(kbps) ? kbps : 192}K`)
    }
    if (mode !== 'WAV') args.push(...meta)
    return args
  }
  if (mode === 'MP4' && h && h > MAX_H264_HEIGHT) {
    // 2K / 4K / 8K: melhor vídeo até essa altura (VP9/AV1) + melhor áudio; MP4 se possível, senão MKV
    return ['-f', `bv*[height<=${h}]+ba[language^=pt]/bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, '--merge-output-format', 'mp4/mkv', ...meta]
  }
  if (mode === 'MP4') {
    return ['-f', `bv*[ext=mp4]${cap}+ba[language^=pt][ext=m4a]/bv*[ext=mp4]${cap}+ba[ext=m4a]/b[ext=mp4]${cap}/bv*${cap}+ba/b${cap}/bv*+ba/b`, '--merge-output-format', 'mp4', ...meta]
  }
  if (mode === 'MKV') {
    return ['-f', `bv*${cap}+ba[language^=pt]/bv*${cap}+ba/b${cap}/bv*+ba/b`, '--merge-output-format', 'mkv', ...meta]
  }
  return ['-f', 'bestvideo+ba[language^=pt]/bestvideo+bestaudio/best']
}

export const PROGRESS_TEMPLATE =
  'download:SPA|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s'

export interface ProgressLine {
  status: string
  downloaded: number
  total: number | null
  speed: number | null
  eta: number | null
}
const num = (s: string): number | null => {
  const n = Number(s)
  return s && s !== 'NA' && s !== 'None' && Number.isFinite(n) ? n : null
}
export function parseProgressLine(line: string): ProgressLine | null {
  if (!line.startsWith('SPA|')) return null
  const p = line.trim().split('|')
  if (p.length < 7) return null
  return { status: p[1], downloaded: num(p[2]) ?? 0, total: num(p[3]) ?? num(p[4]), speed: num(p[5]), eta: num(p[6]) }
}

/* ------------------------------------------------------------------ Erros amigáveis */
export function friendlyError(raw: string): string {
  const text = raw.trim()
  const last = text.split(/\r?\n/).filter((l) => /ERROR/i.test(l)).pop() ?? text.split(/\r?\n/).pop() ?? ''
  const msg = last.replace(/^.*?ERROR:\s*/i, '').replace(/\[youtube\]\s*[\w-]+:\s*/i, '').trim()
  if (/confirm you.?re not a bot|sign in/i.test(msg)) return 'O YouTube pediu login para este vídeo. Atualize o motor de download em Configurações e tente de novo.'
  if (/private video|members-only|join this channel|premium/i.test(msg)) return 'Este vídeo é privado ou exclusivo para membros.'
  if (/video unavailable|no longer available|removed|not available/i.test(msg)) return 'Este vídeo não está mais disponível.'
  if (/HTTP Error 429|too many requests/i.test(msg)) return 'O YouTube limitou as requisições. Aguarde alguns minutos e tente de novo.'
  if (/ffmpeg|ffprobe/i.test(msg) && /not found|nicht|não/i.test(msg)) return 'FFmpeg não foi encontrado. Rode "npm run setup" e gere o instalador de novo.'
  if (/unable to download|getaddrinfo|timed out|Connection|network/i.test(msg)) return 'Sem conexão com a internet. Confira a rede e tente de novo.'
  if (/No space left|disk full|ENOSPC/i.test(msg)) return 'Sem espaço livre no disco de destino.'
  if (/Permission denied|Access is denied/i.test(msg)) return 'Sem permissão para salvar nessa pasta. Escolha outra pasta.'
  return msg || 'Falha desconhecida no download.'
}

/* ------------------------------------------------------------------ Verificação de cada vídeo */
export type VideoCheck = 'ok' | 'blocked' | 'unknown'
export const CHECK_TEMPLATE = 'SPACHK|%(availability)s|%(live_status)s|%(release_timestamp)s'
const BLOCKED_ERR = /members|join this channel|premium|subscriber|premiere|will begin|live event|upcoming|scheduled|private|privado|exclusivo para membros|not available|unavailable/i

/** Só aceita vídeo PÚBLICO, já publicado e que não seja live/estreia agendada. */
export function classifyVideoCheck(stdout: string, errorText: string, nowMs: number = Date.now()): VideoCheck {
  const line = stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith('SPACHK|'))
  if (line) {
    const [, availability, live, release] = line.split('|')
    if (availability !== 'public') return 'blocked' // membros, premium, não listado, privado…
    if (live === 'is_live' || live === 'is_upcoming' || live === 'post_live') return 'blocked'
    const rel = Number(release)
    if (Number.isFinite(rel) && rel * 1000 > nowMs) return 'blocked'
    return 'ok'
  }
  return BLOCKED_ERR.test(errorText) ? 'blocked' : 'unknown'
}

/* ------------------------------------------------------------------ Versões e textos */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h\d|div)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
