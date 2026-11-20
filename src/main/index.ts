import { app, BrowserWindow, Menu, protocol, shell } from 'electron'
import { join } from 'node:path'
import { ctx, send } from './context'
import { flushSettings, initSettings } from './settings'
import { createServices, registerIpc, scheduleYtdlpAutoUpdate } from './ipc'
import { registerMediaProtocol } from './protocol'
import { initUpdater } from './updater'
import { appIcon } from './paths'
import { probeJsRuntime } from './ytdlp'
import { closePlayer } from './player'

// esquema próprio para miniaturas e vídeos locais (com suporte a "arrastar a barra" do vídeo)
protocol.registerSchemesAsPrivileged([{ scheme: 'spa', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])

if (!app.requestSingleInstanceLock()) {
  app.quit()
}
app.setAppUserModelId('br.iasd.sonoplastiapro') // notificações do Windows com o nome certo

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false, // barra de título própria (estilo IDM moderno)
    backgroundColor: '#0b101c',
    title: 'SonoplastiaPro - IASD',
    icon: appIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required', // sons de notificação sem erro
      devTools: !app.isPackaged,
      spellcheck: false
    }
  })
  ctx.win = win
  win.once('ready-to-show', () => win.show())
  win.on('maximize', () => send('win:maximized', true))
  win.on('unmaximize', () => send('win:maximized', false))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !url.startsWith('http://localhost')) e.preventDefault()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const settings = initSettings()
  const services = createServices()
  registerMediaProtocol(services.library)
  registerIpc(services)
  const win = createWindow()

  // pergunta antes de fechar se houver download em andamento
  win.on('close', (e) => {
    if (!ctx.forceClose && services.downloads.activeCount() > 0) {
      e.preventDefault()
      send('app:confirm-close')
    }
  })
  win.on('closed', () => {
    closePlayer()
    services.downloads.cancelAll()
    services.downloads.flush()
    services.library.flush()
    flushSettings()
    app.quit()
  })

  win.webContents.once('did-finish-load', () => {
    void probeJsRuntime()
    services.feed.start(settings.lightMode, settings.refreshMinutes)
    initUpdater()
    scheduleYtdlpAutoUpdate()
  })

  // se o usuário pediu para abrir uma 2ª janela, só traz a primeira para frente
  app.on('second-instance', () => {
    if (ctx.win) {
      if (ctx.win.isMinimized()) ctx.win.restore()
      ctx.win.focus()
    }
  })
})

app.on('window-all-closed', () => app.quit())
