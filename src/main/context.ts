import { BrowserWindow, Notification } from 'electron'
import type { EventMap, EventName, Notice } from '../shared/types'
import { getSettings } from './settings'

export const ctx: { win: BrowserWindow | null; forceClose: boolean } = { win: null, forceClose: false }

export function send<E extends EventName>(channel: E, payload?: EventMap[E]): void {
  const w = ctx.win
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
}

/** Aviso para o usuário: balão estilo WhatsApp dentro do programa (+ notificação do Windows se a janela estiver em segundo plano). */
const recent = new Map<string, number>()
export function notify(n: Notice): void {
  // mesma mensagem em menos de 3 s = ignora (evita avisos em sequência)
  const k = `${n.kind}|${n.title}|${n.message}`
  const now = Date.now()
  if (now - (recent.get(k) ?? 0) < 3000) return
  recent.set(k, now)
  send('notify', n)
  try {
    const w = ctx.win
    const hidden = !w || w.isDestroyed() || !w.isFocused() || w.isMinimized()
    if (hidden && getSettings().desktopNotifications && Notification.isSupported()) {
      const nt = new Notification({ title: n.title, body: n.message, silent: true })
      nt.on('click', () => {
        if (w && !w.isDestroyed()) {
          if (w.isMinimized()) w.restore()
          w.show()
          w.focus()
        }
      })
      nt.show()
    }
  } catch {
    /* notificação do sistema é opcional */
  }
}
