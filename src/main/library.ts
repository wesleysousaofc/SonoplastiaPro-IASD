import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, statSync, unlinkSync } from 'node:fs'
import { execFile } from 'node:child_process'
import type { DownloadJob, LibraryItem } from '../shared/types'
import { isAudioMode } from '../shared/types'
import { dataDir, ffmpegPath, thumbsDir } from './paths'
import { JsonStore } from './store'

const AUDIO_EXT = /\.(mp3|m4a|wav|flac|ogg|aac|opus)$/i

export class Library {
  private store = new JsonStore<{ items: LibraryItem[] }>(join(dataDir(), 'library.json'), { items: [] })
  constructor(private emit: (items: LibraryItem[]) => void) {}

  list(): LibraryItem[] {
    return this.store.data.items.map((i) => {
      const ok = existsSync(i.path)
      return { ...i, missing: !ok, size: ok ? statSync(i.path).size : undefined }
    })
  }
  has(path: string): boolean {
    return this.store.data.items.some((i) => i.path === path)
  }
  private changed(): void {
    this.store.save()
    this.emit(this.list())
  }

  add(path: string, job: DownloadJob): void {
    if (!existsSync(path)) return
    this.store.data.items = this.store.data.items.filter((i) => i.path !== path)
    this.store.data.items.unshift({ path, title: job.title, downloadedAt: Date.now(), mode: job.mode, remoteThumb: job.thumbnail })
    this.store.data.items = this.store.data.items.slice(0, 500)
    this.changed()
    if (!isAudioMode(job.mode)) this.makeThumb(path)
  }
  remove(path: string): void {
    this.store.data.items = this.store.data.items.filter((i) => i.path !== path)
    this.changed()
  }
  relocate(oldPath: string, newPath: string): void {
    const it = this.store.data.items.find((i) => i.path === oldPath)
    if (!it) return
    it.path = newPath
    it.thumb = undefined
    this.changed()
    if (!AUDIO_EXT.test(newPath)) this.makeThumb(newPath)
  }

  /** Extrai 1 quadro com o FFmpeg (leve) para a miniatura da biblioteca. */
  makeThumb(path: string): void {
    const ff = ffmpegPath()
    if (!ff || AUDIO_EXT.test(path)) return
    const out = join(thumbsDir(), createHash('md5').update(path).digest('hex') + '.jpg')
    if (existsSync(out)) {
      this.setThumb(path, out)
      return
    }
    execFile(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '3', '-i', path, '-frames:v', '1', '-vf', 'scale=480:-1', '-q:v', '5', out], { windowsHide: true, timeout: 30000 }, () => {
      if (existsSync(out)) this.setThumb(path, out)
    })
  }
  private setThumb(path: string, thumb: string): void {
    const it = this.store.data.items.find((i) => i.path === path)
    if (it && it.thumb !== thumb) {
      it.thumb = thumb
      this.changed()
    }
  }
  clearThumbs(): void {
    for (const it of this.store.data.items) {
      if (it.thumb) {
        try {
          unlinkSync(it.thumb)
        } catch {
          /* ok */
        }
        it.thumb = undefined
      }
    }
    this.changed()
  }
  flush(): void {
    this.store.flush()
  }
}
