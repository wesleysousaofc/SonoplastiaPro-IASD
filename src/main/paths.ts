import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, existsSync, copyFileSync } from 'node:fs'

const ensure = (p: string): string => {
  try {
    mkdirSync(p, { recursive: true })
  } catch {
    /* ignora */
  }
  return p
}

export const isPortable = (): boolean => !!process.env.PORTABLE_EXECUTABLE_FILE
export const resourcesDir = (): string => (app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'))
export const binDir = (): string => join(resourcesDir(), 'bin')
export const dataDir = (): string => ensure(app.getPath('userData'))
export const thumbsDir = (): string => ensure(join(dataDir(), 'thumbs'))
export const previewsDir = (): string => ensure(join(dataDir(), 'previews'))
export const logsDir = (): string => ensure(join(dataDir(), 'logs'))
export const userBinDir = (): string => ensure(join(dataDir(), 'bin'))

/** Ícone do programa (usado nas janelas, inclusive no player do telão). */
export function appIcon(): string | undefined {
  const p = app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(app.getAppPath(), 'build', 'icon.ico')
  return existsSync(p) ? p : undefined
}

export function ffmpegPath(): string | null {
  const p = join(binDir(), 'ffmpeg.exe')
  return existsSync(p) ? p : null
}
export function localsendPath(): string | null {
  const p = join(binDir(), 'LocalSend-CLI.exe')
  return existsSync(p) ? p : null
}
/** O yt-dlp usado fica numa pasta gravável do usuário para poder se atualizar sozinho (yt-dlp -U). */
export function ytdlpPath(): string {
  const user = join(userBinDir(), 'yt-dlp.exe')
  const bundled = join(binDir(), 'yt-dlp.exe')
  if (!existsSync(user) && existsSync(bundled)) {
    try {
      copyFileSync(bundled, user)
    } catch {
      return bundled
    }
  }
  return existsSync(user) ? user : bundled
}
