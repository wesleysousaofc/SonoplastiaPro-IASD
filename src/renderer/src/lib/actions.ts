import type { Notice, Settings, VideoItem } from '@shared/types'
import { DEFAULT_MIX, type MixParams } from '@shared/mix'
import { appStore, type Page } from './store'
import { playSound, setSoundEnabled } from './sound'

export const api = window.api

let toastId = 1
/**
 * Mostra um aviso. Avisos iguais (mesma "key" ou mesmo texto) NÃO se empilham: o novo substitui o anterior,
 * então clicar várias vezes no mesmo botão nunca enche a tela de notificações.
 */
export function pushToast(n: Notice): void {
  const id = toastId++
  const key = n.key ?? `${n.kind}|${n.title}|${n.message}`
  const prev = appStore.get().toasts.find((t) => t.key === key)
  appStore.set((s) => ({ toasts: [...s.toasts.filter((t) => t.key !== key).slice(-2), { ...n, id, at: Date.now(), key }] }))
  if (!prev || Date.now() - prev.at > 2500) playSound(n.kind) // sem som repetido em sequência
  window.setTimeout(() => dismissToast(id), n.kind === 'error' ? 10000 : 6500)
}
export const dismissToast = (id: number): void => appStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))

export const go = (page: Page): void => appStore.set({ page })

/* ---------------- Mesa de Som (efêmera: nada é salvo) ---------------- */
let mixFrame = 0
const sendMixNow = (): void => api.audio.set(appStore.get().mix)
/** Junta vários movimentos de slider no mesmo quadro (≈60/s): tempo real sem inundar o IPC. */
const scheduleMix = (): void => {
  if (mixFrame) return
  mixFrame = requestAnimationFrame(() => {
    mixFrame = 0
    sendMixNow()
  })
}
export function setMix(patch: Partial<MixParams>): void {
  appStore.set((s) => ({ mix: { ...s.mix, ...patch } }))
  scheduleMix()
}
export function applyMix(p: MixParams): void {
  appStore.set({ mix: { ...p } })
  scheduleMix()
}
export const resetMix = (): void => applyMix(DEFAULT_MIX)

export async function patchSettings(p: Partial<Settings>): Promise<void> {
  const next = await api.settings.patch(p)
  setSoundEnabled(next.sounds)
  appStore.set({ settings: next })
}

export function openDownload(target: { item?: VideoItem; url?: string } = {}): void {
  appStore.set({ downloadDialog: target })
}

export async function runSearch(raw: string): Promise<void> {
  const q = raw.trim()
  if (!q) return
  const s = appStore.get().settings
  const history = [q, ...s.searchHistory.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 20)
  void patchSettings({ searchHistory: history })
  appStore.set({ query: q, searching: true, searchError: null, searchResults: [], page: 'home' })
  try {
    const items = await api.search.run(q)
    if (appStore.get().query === q) appStore.set({ searchResults: items, searching: false })
  } catch (e) {
    appStore.set({ searching: false, searchError: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
  }
}
export const clearSearch = (): void => appStore.set({ query: '', searchResults: null, searching: false, searchError: null })

let started = false
export async function initApp(): Promise<void> {
  if (started) return // o React StrictMode chama duas vezes em desenvolvimento
  started = true
  const d = await api.init()
  setSoundEnabled(d.settings.sounds)
  appStore.set({
    ready: true, settings: d.settings, feed: d.feed, downloads: d.downloads, library: d.library, version: d.version,
    packaged: d.packaged, portable: d.portable, ytdlpVersion: d.ytdlpVersion, receiving: d.localsendReceiving,
    update: d.update
  })

  api.on('feed:update', (feed) => appStore.set({ feed }))
  api.on('downloads:update', (downloads) => appStore.set({ downloads }))
  api.on('library:update', (library) => appStore.set({ library }))
  api.on('notify', pushToast)
  api.on('win:maximized', (maximized) => appStore.set({ maximized }))
  // Telão abriu, trocou de arquivo, o vídeo acabou ou a janela fechou: a mesa volta ao padrão (0 dB, 100 %, tudo desligado)
  api.on('player:state', (p) => appStore.set({ player: { active: p.active, title: p.title ?? '', audioOk: null }, mix: { ...DEFAULT_MIX } }))
  // O telão avisa quando o motor de áudio está pronto: reenvia o que o operador já mexeu enquanto a janela carregava
  api.on('audio:status', (st) => {
    appStore.set((s) => ({ player: { ...s.player, audioOk: st.ok } }))
    if (st.ok) sendMixNow()
  })
  api.on('app:confirm-close', () => appStore.set({ confirmClose: true }))
  api.on('localsend:status', (receiving) => appStore.set({ receiving }))
  api.on('update:state', (update) => {
    appStore.set({ update })
    if (update.phase === 'ready' && !update.portable) window.setTimeout(() => void api.update.install(), 1200)
    if (update.phase === 'none' && update.manual) pushToast({ kind: 'success', title: 'Tudo atualizado', message: 'Você já está com a versão mais recente. ✅' })
    if (update.phase === 'error' && update.manual) pushToast({ kind: 'error', title: 'Não foi possível verificar', message: update.error ?? '' })
  })

  // "O que há de novo": aparece na primeira abertura depois de uma atualização
  const { lastSeenVersion, pendingChangelog } = d.settings
  if (lastSeenVersion !== d.version) {
    if (lastSeenVersion) {
      const list = await api.app.changelog()
      appStore.set({ changelog: list })
      const entry = list.find((c) => c.version === d.version)
      if (entry) appStore.set({ whatsNew: { version: d.version, title: entry.title, items: entry.items } })
      else if (pendingChangelog?.version === d.version) appStore.set({ whatsNew: { version: d.version, notes: pendingChangelog.notes } })
      else appStore.set({ whatsNew: { version: d.version, title: 'Programa atualizado', items: ['Melhorias gerais de desempenho e estabilidade.'] } })
    }
    void patchSettings({ lastSeenVersion: d.version, pendingChangelog: null })
  }
}
