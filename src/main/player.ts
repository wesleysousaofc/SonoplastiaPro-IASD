import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { DisplayInfo, PlayOptions } from '../shared/types'
import { ctx, send } from './context'
import { appIcon } from './paths'

let playerWin: BrowserWindow | null = null

/** Envia uma mensagem só para a janela do telão (ex.: valores da mesa de som). */
export function sendToPlayer(channel: string, payload: unknown): void {
  if (playerWin && !playerWin.isDestroyed()) playerWin.webContents.send(channel, payload)
}
/** A mensagem veio mesmo da janela do telão? (impede que outra janela envie comandos falsos) */
export function isPlayerSender(wc: Electron.WebContents): boolean {
  return !!playerWin && !playerWin.isDestroyed() && playerWin.webContents === wc
}

export function listDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay().id
  return [...screen.getAllDisplays()]
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    .map((d, i) => ({
      index: i,
      name: i > 0 && d.size.width >= 1280 ? `TELA ${i + 1} (possível telão)` : `TELA ${i + 1}`,
      width: d.size.width,
      height: d.size.height,
      primary: d.id === primary
    }))
}

export const mediaUrl = (p: string): string => `spa://local/?p=${encodeURIComponent(p)}`

/** Toca o arquivo numa janela própria (tela cheia) no monitor/telão escolhido, sem depender de player externo. */
export function openPlayer(o: PlayOptions): void {
  const displays = [...screen.getAllDisplays()].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const d = displays[o.displayIndex] ?? screen.getPrimaryDisplay()
  if (playerWin && !playerWin.isDestroyed()) playerWin.close()
  const win = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: o.fullscreen ? d.bounds.width : Math.round(d.bounds.width * 0.8),
    height: o.fullscreen ? d.bounds.height : Math.round(d.bounds.height * 0.8),
    backgroundColor: '#000000',
    icon: appIcon(),
    title: o.title,
    autoHideMenuBar: true,
    show: false,
    frame: !o.fullscreen,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      devTools: !app.isPackaged
    }
  })
  playerWin = win
  send('player:state', { active: true, title: o.title }) // a mesa de som aparece e volta ao padrão
  win.setMenu(null)
  const hash = `/player?src=${encodeURIComponent(mediaUrl(o.path))}&title=${encodeURIComponent(o.title)}&audio=${/\.(mp3|m4a|wav|flac|ogg|aac|opus)$/i.test(o.path) ? 1 : 0}`
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  win.once('ready-to-show', () => {
    win.show()
    if (o.fullscreen) win.setFullScreen(true)
    win.focus()
  })
  win.on('closed', () => {
    if (playerWin === win) {
      playerWin = null
      send('player:state', { active: false }) // vídeo acabou / telão fechado: a mesa some e reseta
    }
    if (ctx.win && !ctx.win.isDestroyed()) ctx.win.focus()
  })
}

export function closePlayer(): void {
  if (playerWin && !playerWin.isDestroyed()) playerWin.close()
}
