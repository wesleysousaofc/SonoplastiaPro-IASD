import { spawn, ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { ffmpegPath, logsDir, previewsDir, ytdlpPath } from './paths'
import { jsArgsSync, killTree, UTF8_ENV } from './ytdlp'

/*
 * Prévia ao passar o mouse: em vez de depender de links temporários do YouTube dentro do player (que falham
 * com frequência), o programa baixa um clipe curto (10 s, 360p) com yt-dlp + FFmpeg e toca o arquivo local.
 * Cada clipe é guardado em cache: na 2ª vez em que você passa o mouse, abre na hora.
 */
const CLIP_SECONDS = 10
const MAX_PARALLEL = 2
const KEEP_FILES = 80
const MAX_AGE_MS = 5 * 24 * 3600_000

interface Job {
  promise: Promise<string | null>
  resolve: (v: string | null) => void
  child?: ChildProcess
  canceled: boolean
  run: () => void
}
const jobs = new Map<string, Job>()
const waiting: Job[] = []
let active = 0

const clipPath = (id: string): string => join(previewsDir(), `${id}.mp4`)

function removeFiles(prefix: string): void {
  try {
    for (const f of readdirSync(previewsDir())) if (f.startsWith(prefix)) unlinkSync(join(previewsDir(), f))
  } catch {
    /* ok */
  }
}

export function trimPreviewCache(clearAll = false): void {
  try {
    const dir = previewsDir()
    const files = readdirSync(dir).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    files.sort((a, b) => b.t - a.t)
    files.forEach((x, i) => {
      if (clearAll || i >= KEEP_FILES || Date.now() - x.t > MAX_AGE_MS) unlinkSync(join(dir, x.f))
    })
  } catch {
    /* ok */
  }
}

function pump(): void {
  while (active < MAX_PARALLEL && waiting.length) waiting.shift()!.run()
}

export function getPreview(url: string, id: string, duration = 0): Promise<string | null> {
  if (!/^[\w-]{6,20}$/.test(id)) return Promise.resolve(null)
  const final = clipPath(id)
  try {
    if (existsSync(final) && statSync(final).size > 20_000) return Promise.resolve(final)
  } catch {
    /* segue */
  }
  const existing = jobs.get(id)
  if (existing) return existing.promise
  const ff = ffmpegPath()
  if (!ff) return Promise.resolve(null)

  let resolve!: (v: string | null) => void
  const promise = new Promise<string | null>((r) => (resolve = r))
  const job: Job = { promise, resolve, canceled: false, run: () => undefined }

  job.run = () => {
    active++
    const start = duration > 45 ? Math.floor(Math.min(duration * 0.12, 90)) : 0
    const tmp = `${id}~${Date.now()}`
    const args = [
      ...jsArgsSync(),
      '--no-warnings', '--no-color', '--encoding', 'utf-8', '--quiet', '--no-playlist',
      '--extractor-args', 'youtube:lang=pt',
      '-f', 'bv*[height<=360][vcodec^=avc1]+ba[ext=m4a]/b[height<=360][ext=mp4]/bv*[height<=360]+ba/b[height<=360]/w',
      '--merge-output-format', 'mp4',
      '--download-sections', `*${start}-${start + CLIP_SECONDS}`,
      '--concurrent-fragments', '4',
      '--ffmpeg-location', ff,
      '-o', join(previewsDir(), `${tmp}.%(ext)s`),
      url
    ]
    const child = spawn(ytdlpPath(), args, { windowsHide: true, env: UTF8_ENV })
    job.child = child
    let err = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (d: string) => (err += d))
    child.stdout.resume()
    const timer = setTimeout(() => killTree(child), 80_000)
    const finish = (path: string | null): void => {
      clearTimeout(timer)
      active--
      if (jobs.get(id) === job) jobs.delete(id)
      job.resolve(path)
      pump()
    }
    child.on('error', () => {
      removeFiles(tmp)
      finish(null)
    })
    child.on('close', (code) => {
      const produced = join(previewsDir(), `${tmp}.mp4`)
      if (!job.canceled && code === 0 && existsSync(produced) && statSync(produced).size > 20_000) {
        try {
          renameSync(produced, final)
          removeFiles(tmp)
          trimPreviewCache()
          return finish(final)
        } catch {
          /* cai no erro abaixo */
        }
      }
      removeFiles(tmp)
      if (!job.canceled && err) {
        try {
          appendFileSync(join(logsDir(), 'previews.log'), `${new Date().toISOString()} [${id}] ${err.slice(-400)}\n`)
        } catch {
          /* sem log */
        }
      }
      finish(null)
    })
  }

  jobs.set(id, job)
  waiting.push(job)
  pump()
  return promise
}

/** O mouse saiu do vídeo antes de a prévia ficar pronta: cancela para não gastar o PC à toa. */
export function cancelPreview(id: string): void {
  const job = jobs.get(id)
  if (!job) return
  job.canceled = true
  jobs.delete(id)
  const i = waiting.indexOf(job)
  if (i >= 0) {
    waiting.splice(i, 1)
    job.resolve(null)
  } else if (job.child) killTree(job.child)
}
