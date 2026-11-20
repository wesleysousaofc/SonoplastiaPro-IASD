import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import type { ChangelogEntry, InitData, NewDownloadSpec, PlayOptions, Settings } from '../shared/types'
import { DEFAULT_CHANNELS } from '../shared/types'
import { ctx, notify, send } from './context'
import { getSettings, patchSettings } from './settings'
import { isPortable, logsDir, resourcesDir, ytdlpPath } from './paths'
import { FeedService } from './feed'
import { DownloadManager } from './downloads'
import { Library } from './library'
import { getQualities, runYtdlp, searchVideos, suggestions, updateYtdlp, ytdlpVersion } from './ytdlp'
import { diskFreeBytes, hardwareInfo, liveStats } from './system'
import { listen, openVoiceSettings } from './voice'
import { isReceiving, sendFiles, startReceive, stopReceive } from './localsend'
import { closePlayer, isPlayerSender, listDisplays, mediaUrl, openPlayer, sendToPlayer } from './player'
import { sanitizeMix } from '../shared/mix'
import { cancelPreview, getPreview, trimPreviewCache } from './preview'
import { checkForUpdates, downloadUpdate, getUpdateState, installUpdate } from './updater'

export interface Services {
  feed: FeedService
  downloads: DownloadManager
  library: Library
}

export function createServices(): Services {
  const library = new Library((items) => send('library:update', items))
  const downloads = new DownloadManager(
    (jobs) => send('downloads:update', jobs),
    (file, job) => library.add(file, job)
  )
  const feed = new FeedService(
    () => DEFAULT_CHANNELS,
    (s) => send('feed:update', s),
    (items) => {
      const names = [...new Set(items.map((i) => DEFAULT_CHANNELS.find((c) => c.id === i.channelId)?.short ?? i.channel))].join(' e ')
      notify({
        kind: 'new',
        title: items.length > 1 ? `${items.length} vídeos novos` : 'Vídeo novo publicado',
        message: items.length > 1 ? `Novidades em ${names}` : `${names}: ${items[0].title}`,
        thumb: items[0].thumbnail
      })
    }
  )
  return { feed, downloads, library }
}

function loadChangelog(): ChangelogEntry[] {
  try {
    return JSON.parse(readFileSync(join(resourcesDir(), 'changelog.json'), 'utf-8')) as ChangelogEntry[]
  } catch {
    return []
  }
}

/* ---------------------------------------------------------------- registro dos handlers */
export function registerIpc(s: Services): void {
  const h = (ch: string, fn: (...a: any[]) => unknown): void => {
    ipcMain.handle(ch, async (_e, ...a) => fn(...a))
  }
  h('init', async (): Promise<InitData> => ({
    settings: getSettings(),
    feed: s.feed.state(),
    downloads: s.downloads.list(),
    library: s.library.list(),
    version: app.getVersion(),
    packaged: app.isPackaged,
    portable: isPortable(),
    localsendReceiving: isReceiving(),
    ytdlpVersion: await ytdlpVersion(),
    update: getUpdateState()
  }))

  h('settings:patch', (p: Partial<Settings>) => {
    const before = getSettings()
    const lightChanged = p.lightMode !== undefined && p.lightMode !== before.lightMode
    const next = patchSettings(p)
    if (lightChanged || p.refreshMinutes !== undefined) s.feed.schedule(next.lightMode, next.refreshMinutes)
    if (lightChanged) patchSettings({ maxConcurrent: next.lightMode ? 1 : Math.max(2, next.maxConcurrent) })
    if (p.maxConcurrent !== undefined) s.downloads.pump()
    return getSettings()
  })

  h('feed:refresh', () => s.feed.refresh())
  h('search:run', (q: string) => searchVideos(q))
  h('search:suggest', (q: string) => suggestions(q))
  h('qualities:get', (url: string, mode) => getQualities(url, mode))
  h('preview:resolve', async (url: string, id: string, duration?: number) => {
    const file = await getPreview(url, id, duration ?? 0)
    return file ? mediaUrl(file) : null
  })
  h('preview:cancel', (id: string) => cancelPreview(id))

  h('downloads:add', (spec: NewDownloadSpec, startNow: boolean) => s.downloads.add(spec, startNow))
  h('downloads:pause', (id: string) => s.downloads.pause(id))
  h('downloads:resume', (id: string) => s.downloads.resume(id))
  h('downloads:cancel', (id: string) => s.downloads.cancel(id))
  h('downloads:remove', (id: string) => s.downloads.remove(id))
  h('downloads:retry', (id: string) => s.downloads.retry(id))
  h('downloads:startAll', () => s.downloads.startAll())
  h('downloads:clearFinished', () => s.downloads.clearFinished())
  h('downloads:showFile', (id: string) => s.downloads.showFile(id))

  h('library:remove', (p: string) => s.library.remove(p))
  h('library:showFile', (p: string) => (existsSync(p) ? shell.showItemInFolder(p) : undefined))
  h('library:relocate', async (p: string) => {
    const r = await dialog.showOpenDialog(ctx.win!, { title: 'Localizar o arquivo', properties: ['openFile'] })
    if (!r.canceled && r.filePaths[0]) s.library.relocate(p, r.filePaths[0])
  })

  h('player:displays', () => listDisplays())
  h('player:open', (o: PlayOptions) => openPlayer(o))

  h('system:hardware', () => hardwareInfo())
  h('system:live', () => liveStats())
  h('system:diskFree', (dir: string) => diskFreeBytes(dir))

  h('voice:listen', () => listen())
  h('voice:openSettings', (k: 'speech' | 'mic') => openVoiceSettings(k))

  h('localsend:send', (files: string[]) => sendFiles(files))
  h('localsend:startReceive', (dir: string) => startReceive(dir))
  h('localsend:stopReceive', () => stopReceive())

  h('dialog:pickFolder', async (initial?: string) => {
    const r = await dialog.showOpenDialog(ctx.win!, { properties: ['openDirectory', 'createDirectory'], defaultPath: initial })
    return r.canceled ? null : r.filePaths[0]
  })
  h('dialog:pickFiles', async () => {
    const r = await dialog.showOpenDialog(ctx.win!, { title: 'Selecionar arquivos para enviar', properties: ['openFile', 'multiSelections'] })
    return r.canceled ? [] : r.filePaths
  })
  h('dialog:pickFile', async () => {
    const r = await dialog.showOpenDialog(ctx.win!, { properties: ['openFile'] })
    return r.canceled ? null : r.filePaths[0]
  })

  h('update:check', (manual?: boolean) => checkForUpdates(!!manual))
  h('update:download', () => downloadUpdate())
  h('update:install', () => installUpdate())

  h('ytdlp:update', async () => {
    const msg = await updateYtdlp()
    patchSettings({ lastYtdlpCheck: Date.now() })
    return msg
  })

  h('app:openExternal', (url: string) => (/^https?:\/\//i.test(url) ? shell.openExternal(url) : undefined))
  h('app:clipboardRead', () => clipboard.readText())
  h('app:clearCache', async () => {
    s.library.clearThumbs()
    trimPreviewCache(true)
    await new Promise<void>((r) => execFile(ytdlpPath(), ['--rm-cache-dir'], { windowsHide: true }, () => r()))
  })
  h('app:changelog', () => loadChangelog())
  h('app:openLogs', () => shell.openPath(logsDir()))

  // controles da janela (valem para a janela que fez o pedido: principal ou player)
  const winOf = (e: Electron.IpcMainEvent): BrowserWindow | null => BrowserWindow.fromWebContents(e.sender)
  ipcMain.on('win:minimize', (e) => winOf(e)?.minimize())
  ipcMain.on('win:toggleMaximize', (e) => {
    const w = winOf(e)
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.on('win:close', (e) => {
    const w = winOf(e)
    if (w && w !== ctx.win) closePlayer()
    else w?.close()
  })
  // Mesa de Som: janela principal → (valida) → janela do telão. Sem gravar nada em disco.
  ipcMain.on('audio:set', (e, p) => {
    if (e.sender !== ctx.win?.webContents) return
    sendToPlayer('audio:apply', sanitizeMix(p))
  })
  ipcMain.on('audio:status', (e, s: { ok?: boolean; error?: unknown }) => {
    if (!isPlayerSender(e.sender)) return
    send('audio:status', { ok: s?.ok === true, error: typeof s?.error === 'string' ? s.error.slice(0, 200) : undefined })
  })
  ipcMain.on('win:forceClose', () => {
    ctx.forceClose = true
    ctx.win?.close()
  })
}

/** Atualização automática do motor de download (yt-dlp): o YouTube muda toda hora; o programa se cuida sozinho. */
export function scheduleYtdlpAutoUpdate(): void {
  const run = async (): Promise<void> => {
    if (!app.isPackaged) return
    if (Date.now() - getSettings().lastYtdlpCheck < 24 * 3600_000) return
    try {
      const out = await runYtdlp(['-U'], { lang: null, timeoutMs: 120000 })
      patchSettings({ lastYtdlpCheck: Date.now() })
      if (/updated yt-dlp/i.test(out)) notify({ kind: 'info', title: 'Motor de download atualizado', message: 'O yt-dlp foi atualizado automaticamente. ✅' })
    } catch {
      /* sem internet: tenta na próxima abertura */
    }
  }
  setTimeout(() => void run(), 25_000)
}
