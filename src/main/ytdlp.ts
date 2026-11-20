import { spawn, ChildProcess } from 'node:child_process'
import type { Mode, QualityInfo, VideoItem } from '../shared/types'
import { ytdlpPath } from './paths'
import { buildQualityChoices, CHECK_TEMPLATE, classifyVideoCheck, friendlyError, type VideoCheck } from './parsers'

// ELECTRON_RUN_AS_NODE: faz o próprio executável do programa funcionar como "Node" quando o yt-dlp
// precisa resolver os desafios em JavaScript do YouTube (necessário para liberar 4K e formatos altos).
export const UTF8_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ELECTRON_RUN_AS_NODE: '1' }

let jsArgs: string[] | null = null
let jsProbe: Promise<string[]> | null = null
/** Testa uma vez se este yt-dlp aceita --js-runtimes (versões antigas não aceitam; aí segue sem). */
export function probeJsRuntime(): Promise<string[]> {
  jsProbe ??= new Promise<string[]>((resolve) => {
    const args = ['--js-runtimes', `node:${process.execPath}`]
    const c = spawn(ytdlpPath(), [...args, '--version'], { windowsHide: true, env: UTF8_ENV })
    let out = ''
    const t = setTimeout(() => killTree(c), 25000)
    c.stdout.on('data', (d) => (out += d))
    c.on('error', () => { clearTimeout(t); jsArgs = []; resolve([]) })
    c.on('close', (code) => {
      clearTimeout(t)
      jsArgs = code === 0 && /^\d{4}\./.test(out.trim()) ? args : []
      resolve(jsArgs)
    })
  })
  return jsProbe
}
export const jsArgsSync = (): string[] => jsArgs ?? []

export function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill('SIGKILL')
}

interface RunOpts {
  lang?: 'pt' | 'en' | null
  timeoutMs?: number
  allowPartial?: boolean // devolve a saída mesmo com código ≠ 0 (ex.: alguns itens indisponíveis)
  extra?: string[]
}

export async function runYtdlp(args: string[], opts: RunOpts = {}): Promise<string> {
  const js = await probeJsRuntime()
  const lang = opts.lang === undefined ? 'pt' : opts.lang
  const full = [...js, '--no-warnings', '--no-color', '--encoding', 'utf-8', '--socket-timeout', '25', ...(lang ? ['--extractor-args', `youtube:lang=${lang}`] : []), ...(opts.extra ?? []), ...args]
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath(), full, { windowsHide: true, env: UTF8_ENV })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      killTree(child)
      reject(new Error('O YouTube demorou demais para responder. Tente de novo.'))
    }, opts.timeoutMs ?? 90000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(new Error(e.code === 'ENOENT' ? 'yt-dlp.exe não encontrado. Rode "npm run setup" e gere o instalador de novo.' : e.message))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || (opts.allowPartial && out.trim().startsWith('{'))) resolve(out)
      else reject(new Error(friendlyError(err) || `yt-dlp terminou com código ${code}`))
    })
  })
}

export async function runJson<T = any>(args: string[], opts: RunOpts = {}): Promise<T> {
  const out = await runYtdlp(['-J', ...args], opts)
  return JSON.parse(out) as T
}

/* ---------------------------------------------------------------- Qualidades de um link */
export async function getQualities(url: string, mode: Mode): Promise<QualityInfo> {
  const info = await runJson(['--no-playlist', '--skip-download', url], { timeoutMs: 60000 })
  const thumbs: any[] = info.thumbnails ?? []
  const best = thumbs.length ? thumbs.reduce((a, b) => ((b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a)) : null
  return {
    title: info.title ?? 'Vídeo',
    thumbnail: info.thumbnail ?? best?.url ?? '',
    duration: info.duration ?? 0,
    uploader: info.channel ?? info.uploader ?? '',
    choices: buildQualityChoices(info.formats ?? [], mode, info.duration ?? 0)
  }
}

/* ---------------------------------------------------------------- Verificação de um vídeo (público? já publicado?) */
export async function checkVideo(id: string): Promise<VideoCheck> {
  try {
    const out = await runYtdlp(['--no-playlist', '--skip-download', '--print', CHECK_TEMPLATE, `https://www.youtube.com/watch?v=${id}`], { timeoutMs: 45000 })
    return classifyVideoCheck(out, '')
  } catch (e) {
    return classifyVideoCheck('', (e as Error).message)
  }
}

/* ---------------------------------------------------------------- Busca no YouTube */
export async function searchVideos(query: string): Promise<VideoItem[]> {
  const data = await runJson(['--flat-playlist', `ytsearch30:${query}`], { timeoutMs: 60000, allowPartial: true })
  const items: VideoItem[] = []
  for (const e of data.entries ?? []) {
    if (!e?.id || !/^[\w-]{11}$/.test(e.id)) continue // ignora canais e playlists
    const thumbs: any[] = e.thumbnails ?? []
    const t = thumbs.length ? thumbs.reduce((a, b) => ((b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a)) : null
    let published: string | undefined
    if (typeof e.timestamp === 'number') published = new Date(e.timestamp * 1000).toISOString()
    else if (typeof e.upload_date === 'string' && e.upload_date.length === 8) published = `${e.upload_date.slice(0, 4)}-${e.upload_date.slice(4, 6)}-${e.upload_date.slice(6, 8)}T00:00:00.000Z`
    items.push({
      id: e.id,
      title: e.title ?? 'Vídeo sem título',
      url: `https://www.youtube.com/watch?v=${e.id}`,
      channel: e.channel ?? e.uploader ?? '',
      thumbnail: t?.url ?? e.thumbnail ?? `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`,
      duration: e.duration,
      published,
      viewCount: typeof e.view_count === 'number' ? e.view_count : null
    })
  }
  return items
}

/** Sugestões de busca do próprio YouTube (as mesmas da barra de pesquisa do site). */
export async function suggestions(q: string): Promise<string[]> {
  if (!q.trim()) return []
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=pt-BR&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
    clearTimeout(t)
    const json = (await r.json()) as [string, string[]]
    return (json[1] ?? []).slice(0, 8)
  } catch {
    return []
  }
}

/* ---------------------------------------------------------------- Atualização do próprio yt-dlp */
export async function updateYtdlp(): Promise<string> {
  const out = await runYtdlp(['-U'], { lang: null, timeoutMs: 120000 }).catch((e: Error) => {
    throw new Error(`Não foi possível atualizar o motor de download: ${e.message}`)
  })
  const text = out.trim()
  if (/up to date/i.test(text)) return 'O motor de download já está na versão mais recente.'
  if (/updated yt-dlp/i.test(text)) return 'Motor de download atualizado com sucesso. ✅'
  return text.split(/\r?\n/).pop() || 'Verificação concluída.'
}
export async function ytdlpVersion(): Promise<string> {
  try {
    return (await runYtdlp(['--version'], { lang: null, timeoutMs: 15000 })).trim()
  } catch {
    return '—'
  }
}
