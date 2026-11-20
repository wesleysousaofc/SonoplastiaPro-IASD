import { app } from 'electron'
import { join } from 'node:path'
import type { Settings } from '../shared/types'
import { dataDir } from './paths'
import { JsonStore } from './store'
import { detectWeak } from './system'

let store: JsonStore<Settings>

export function initSettings(): Settings {
  const defaults: Settings = {
    firstRunDone: false,
    lightMode: false,
    hoverPreview: true,
    sounds: true,
    desktopNotifications: true,
    theme: 'iasd-escuro',
    downloadDir: join(app.getPath('downloads'), 'SonoplastiaPro - IASD'),
    maxConcurrent: 2,
    refreshMinutes: 15,
    lastSeenVersion: '',
    pendingChangelog: null,
    searchHistory: [],
    lastYtdlpCheck: 0
  }
  store = new JsonStore<Settings>(join(dataDir(), 'settings.json'), defaults)
  if (!store.data.firstRunDone) {
    // Primeira abertura: liga o Modo Leve sozinho em PCs fracos (≤2 núcleos ou ≤4,5 GB de RAM)
    store.data.lightMode = detectWeak()
    if (store.data.lightMode) store.data.maxConcurrent = 1
    store.data.firstRunDone = true
    store.flush()
  }
  return store.data
}
export const getSettings = (): Settings => store.data
export function patchSettings(p: Partial<Settings>): Settings {
  Object.assign(store.data, p)
  store.save()
  return store.data
}
export const flushSettings = (): void => store?.flush()
