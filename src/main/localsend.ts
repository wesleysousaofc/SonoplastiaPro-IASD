import { spawn, execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { localsendPath } from './paths'
import { send } from './context'

/*
 * O LocalSend-CLI é um programa de console (precisa de uma janela de texto para você escolher o dispositivo / aceitar).
 * Para essa janela abrir de verdade, ele é iniciado por "cmd /c start": o Windows cria uma janela de console
 * própria e entrega o teclado a ela. (Antes o programa era iniciado "desanexado" e ficava sem janela.)
 */
const IMAGE = 'LocalSend-CLI.exe'
const NOT_FOUND = 'O módulo LocalSend-CLI.exe não foi encontrado na pasta resources/bin.'

let receiving = false
let starting = false
let sending = false
let watcher: NodeJS.Timeout | null = null

export const isReceiving = (): boolean => receiving

const quote = (s: string): string => `"${(s.length > 3 ? s.replace(/\\+$/, '') : s).replace(/["%]/g, '')}"`

function launch(args: string[]): string | null {
  const cli = localsendPath()
  if (!cli) return NOT_FOUND
  try {
    const line = `start "LocalSend" /D ${quote(homedir())} ${quote(cli)} ${args.map(quote).join(' ')}`
    const child = spawn('cmd.exe', ['/d', '/c', line], { windowsVerbatimArguments: true, stdio: 'ignore', windowsHide: false })
    child.on('error', () => undefined)
    child.unref()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

function isRunning(): Promise<boolean> {
  return new Promise((res) => {
    execFile('tasklist', ['/FI', `IMAGENAME eq ${IMAGE}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 8000 }, (err, out) => {
      res(!err && String(out).toLowerCase().includes(IMAGE.toLowerCase()))
    })
  })
}

function setReceiving(v: boolean): void {
  if (receiving !== v) {
    receiving = v
    send('localsend:status', v)
  }
  if (v && !watcher) {
    // quando você fechar a janela do LocalSend, o botão volta para "Iniciar"
    watcher = setInterval(async () => {
      if (!(await isRunning())) {
        if (watcher) clearInterval(watcher)
        watcher = null
        setReceiving(false)
      }
    }, 2500)
  }
  if (!v && watcher) {
    clearInterval(watcher)
    watcher = null
  }
}

/** Abre o LocalSend (janela própria) para enviar os arquivos. Devolve mensagem de erro ou null. */
export function sendFiles(files: string[]): string | null {
  if (sending) return null // cliques repetidos não abrem várias janelas
  const valid = files.filter((f) => existsSync(f))
  if (!valid.length) return 'Os arquivos selecionados não foram encontrados.'
  sending = true
  setTimeout(() => (sending = false), 2500)
  return launch(valid.flatMap((f) => ['--file', f]))
}

export async function startReceive(dir: string): Promise<string | null> {
  if (starting) return null // já está iniciando: ignora cliques repetidos
  starting = true
  try {
    if (receiving || (await isRunning())) {
      setReceiving(true) // já aberto: não abre outra janela
      return null
    }
    mkdirSync(dir, { recursive: true })
    const err = launch(['--destination', dir])
    if (err) return err
    setReceiving(true)
    return null
  } catch (e) {
    return (e as Error).message
  } finally {
    setTimeout(() => (starting = false), 1500)
  }
}

export function stopReceive(): void {
  execFile('taskkill', ['/IM', IMAGE, '/F'], { windowsHide: true }, () => undefined)
  setReceiving(false)
}
