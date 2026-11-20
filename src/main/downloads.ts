import { spawn, ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { shell } from 'electron'
import type { DownloadJob, NewDownloadSpec } from '../shared/types'
import { isAudioMode } from '../shared/types'
import { dataDir, ffmpegPath, ytdlpPath } from './paths'
import { buildFormatArgs, friendlyError, parseProgressLine, PROGRESS_TEMPLATE, sanitizeFileName } from './parsers'
import { jsArgsSync, killTree, UTF8_ENV } from './ytdlp'
import { getSettings } from './settings'
import { notify } from './context'

type FileHandler = (path: string, job: DownloadJob) => void

export class DownloadManager {
  private jobs = new Map<string, DownloadJob>()
  private procs = new Map<string, ChildProcess>()
  private streamsDone = new Map<string, number>()
  private stderr = new Map<string, string>()
  private file = join(dataDir(), 'downloads.json')
  private emitTimer: NodeJS.Timeout | null = null
  private saveTimer: NodeJS.Timeout | null = null

  constructor(
    private emit: (jobs: DownloadJob[]) => void,
    private onFile: FileHandler
  ) {
    try {
      if (existsSync(this.file)) {
        const list = JSON.parse(readFileSync(this.file, 'utf-8')) as DownloadJob[]
        for (const j of list) {
          // o que estava rodando quando o programa fechou volta como "pausado"
          if (['downloading', 'processing', 'queued'].includes(j.status)) j.status = 'paused'
          j.speed = null
          j.eta = null
          this.jobs.set(j.id, j)
        }
      }
    } catch {
      /* lista corrompida */
    }
  }

  list(): DownloadJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt)
  }
  activeCount(): number {
    return [...this.jobs.values()].filter((j) => j.status === 'downloading' || j.status === 'processing').length
  }
  totalSpeed(): number {
    return [...this.jobs.values()].reduce((s, j) => s + (j.status === 'downloading' ? j.speed ?? 0 : 0), 0)
  }

  /* -------------------------------------------------------------- persistência / eventos */
  private touch(): void {
    if (!this.emitTimer) {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = null
        this.emit(this.list())
      }, 250)
    }
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null
        try {
          writeFileSync(this.file, JSON.stringify(this.list().slice(0, 200)), 'utf-8')
        } catch {
          /* ok */
        }
      }, 1500)
    }
  }
  flush(): void {
    try {
      writeFileSync(this.file, JSON.stringify(this.list().slice(0, 200)), 'utf-8')
    } catch {
      /* ok */
    }
  }

  /* -------------------------------------------------------------- ações */
  add(spec: NewDownloadSpec, startNow: boolean): void {
    const job: DownloadJob = {
      ...spec,
      id: randomUUID(),
      status: startNow ? 'queued' : 'later',
      percent: 0,
      speed: null,
      eta: null,
      downloaded: 0,
      total: spec.sizeEstimate ?? null,
      files: [],
      createdAt: Date.now()
    }
    this.jobs.set(job.id, job)
    this.touch()
    this.pump()
  }

  resume(id: string): void {
    const j = this.jobs.get(id)
    if (!j || !['paused', 'later', 'error', 'canceled'].includes(j.status)) return
    j.status = 'queued'
    j.error = undefined
    this.touch()
    this.pump()
  }
  retry(id: string): void {
    const j = this.jobs.get(id)
    if (!j) return
    j.percent = 0
    j.files = []
    this.resume(id)
  }
  startAll(): void {
    for (const j of this.jobs.values()) if (j.status === 'paused' || j.status === 'later') j.status = 'queued'
    this.touch()
    this.pump()
  }
  pause(id: string): void {
    const j = this.jobs.get(id)
    if (!j) return
    if (j.status === 'queued') j.status = 'paused'
    else if (j.status === 'downloading' || j.status === 'processing') {
      j.status = 'paused' // marcado antes de matar, para o "close" não tratar como erro
      const p = this.procs.get(id)
      if (p) killTree(p)
    }
    j.speed = null
    j.eta = null
    this.touch()
  }
  cancel(id: string): void {
    const j = this.jobs.get(id)
    if (!j || ['done', 'error', 'canceled'].includes(j.status)) return
    const p = this.procs.get(id)
    j.status = 'canceled'
    j.speed = null
    j.eta = null
    if (p) killTree(p)
    this.touch()
    this.pump()
  }
  remove(id: string): void {
    const p = this.procs.get(id)
    if (p) killTree(p)
    this.jobs.delete(id)
    this.touch()
    this.pump()
  }
  clearFinished(): void {
    for (const [id, j] of this.jobs) if (['done', 'error', 'canceled'].includes(j.status)) this.jobs.delete(id)
    this.touch()
  }
  showFile(id: string): void {
    const j = this.jobs.get(id)
    if (!j) return
    if (j.filePath && existsSync(j.filePath)) shell.showItemInFolder(j.filePath)
    else void shell.openPath(j.folder)
  }
  cancelAll(): void {
    for (const p of this.procs.values()) killTree(p)
  }

  /* -------------------------------------------------------------- fila */
  pump(): void {
    const max = Math.max(1, getSettings().maxConcurrent)
    const waiting = [...this.jobs.values()].filter((j) => j.status === 'queued').sort((a, b) => a.createdAt - b.createdAt)
    let active = this.activeCount()
    for (const j of waiting) {
      if (active >= max) break
      this.start(j)
      active++
    }
  }

  private start(job: DownloadJob): void {
    try {
      mkdirSync(job.folder, { recursive: true })
    } catch (e) {
      this.fail(job, `Não foi possível usar a pasta de destino: ${(e as Error).message}`)
      return
    }
    const light = getSettings().lightMode
    const out = !job.playlist && job.fileName ? join(job.folder, `${sanitizeFileName(job.fileName)}.%(ext)s`) : join(job.folder, '%(title).180B [%(id)s].%(ext)s')
    const args = [
      ...jsArgsSync(),
      '--no-warnings', '--no-color', '--encoding', 'utf-8',
      '--extractor-args', 'youtube:lang=pt',
      '--quiet', '--progress', '--newline', '--no-simulate', '--continue',
      '--windows-filenames', '--retries', '10', '--fragment-retries', '10',
      '--concurrent-fragments', light ? '1' : '4',
      '--progress-template', PROGRESS_TEMPLATE,
      '--print', 'before_dl:SPATITLE|%(title)s',
      '--print', 'after_move:SPAFILE|%(filepath)s',
      '-o', out,
      job.playlist ? '--yes-playlist' : '--no-playlist',
      ...(job.playlist ? ['--ignore-errors'] : []),
      ...buildFormatArgs(job.mode, job.quality, job.qualityValue)
    ]
    const ff = ffmpegPath()
    if (ff) args.push('--ffmpeg-location', ff)
    args.push(job.url)

    job.status = 'downloading'
    job.error = undefined
    job.files = []
    this.streamsDone.set(job.id, 0)
    this.stderr.set(job.id, '')
    const expectedStreams = isAudioMode(job.mode) ? 1 : 2

    const child = spawn(ytdlpPath(), args, { windowsHide: true, env: UTF8_ENV })
    this.procs.set(job.id, child)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    let buf = ''
    child.stdout.on('data', (chunk: string) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (line.startsWith('SPATITLE|')) {
          if (!job.title || job.title === 'Vídeo selecionado') job.title = line.slice(9)
          this.touch()
        } else if (line.startsWith('SPAFILE|')) {
          const p = line.slice(8)
          if (p && !job.files.includes(p)) job.files.push(p)
          job.filePath = p
        } else {
          const pr = parseProgressLine(line)
          if (!pr) continue
          const done = this.streamsDone.get(job.id) ?? 0
          const frac = pr.total ? Math.min(1, pr.downloaded / pr.total) : 0
          job.downloaded = pr.downloaded
          job.total = pr.total ?? job.total
          job.speed = pr.speed
          job.eta = pr.eta
          if (pr.status === 'finished') {
            this.streamsDone.set(job.id, done + 1)
            job.percent = Math.max(job.percent, Math.min(99, ((done + 1) / expectedStreams) * 100))
            if (done + 1 >= expectedStreams) job.status = 'processing'
          } else {
            job.percent = Math.max(job.percent, Math.min(99, ((done + frac) / expectedStreams) * 100))
          }
          this.touch()
        }
      }
    })
    child.stderr.on('data', (d: string) => this.stderr.set(job.id, (this.stderr.get(job.id) ?? '') + d))
    child.on('error', (e: NodeJS.ErrnoException) => {
      this.procs.delete(job.id)
      this.fail(job, e.code === 'ENOENT' ? 'yt-dlp.exe não encontrado. Rode "npm run setup" e gere o instalador de novo.' : e.message)
    })
    child.on('close', (code) => {
      this.procs.delete(job.id)
      const status = job.status as string
      if (status === 'paused' || status === 'canceled' || !this.jobs.has(job.id)) {
        this.pump()
        return
      }
      if (code === 0) {
        job.status = 'done'
        job.percent = 100
        job.speed = null
        job.eta = null
        job.finishedAt = Date.now()
        const existing = job.files.filter((f) => existsSync(f))
        job.files = existing
        if (existing.length) {
          const size = existing.reduce((s, f) => s + (statSafe(f) ?? 0), 0)
          job.total = size || job.total
          for (const f of existing) this.onFile(f, job)
        }
        notify({ kind: 'success', title: 'Download concluído', message: existing.length > 1 ? `${existing.length} arquivos salvos em ${job.folder}` : job.title, thumb: job.thumbnail })
      } else {
        this.fail(job, friendlyError(this.stderr.get(job.id) ?? ''))
      }
      this.touch()
      this.pump()
    })
    this.touch()
  }

  private fail(job: DownloadJob, message: string): void {
    job.status = 'error'
    job.error = message
    job.speed = null
    job.eta = null
    job.finishedAt = Date.now()
    notify({ kind: 'error', title: 'Erro no download', message: `${job.title}\n${message}` })
    this.touch()
    this.pump()
  }
}

function statSafe(p: string): number | null {
  try {
    return statSync(p).size
  } catch {
    return null
  }
}
