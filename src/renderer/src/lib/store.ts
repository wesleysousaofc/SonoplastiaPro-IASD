import { useSyncExternalStore } from 'react'
import { DEFAULT_MIX, type MixParams } from '@shared/mix'
import type { ChangelogEntry, DownloadJob, FeedState, LibraryItem, Notice, Settings, UpdateState, VideoItem } from '@shared/types'

export type Page = 'home' | 'downloads' | 'library' | 'localsend' | 'settings'

export interface Toast extends Notice {
  id: number
  at: number
  key: string
}

export interface AppState {
  ready: boolean
  settings: Settings
  feed: FeedState
  downloads: DownloadJob[]
  library: LibraryItem[]
  version: string
  packaged: boolean
  portable: boolean
  ytdlpVersion: string
  receiving: boolean
  page: Page
  homeChannel: string | null
  query: string
  searchResults: VideoItem[] | null
  searching: boolean
  searchError: string | null
  toasts: Toast[]
  update: UpdateState
  updateDismissed: string | null
  whatsNew: { version: string; title?: string; items?: string[]; notes?: string } | null
  changelog: ChangelogEntry[]
  downloadDialog: { item?: VideoItem; url?: string } | null
  playTarget: LibraryItem | null
  confirmClose: boolean
  maximized: boolean
  /** Telão: há mídia tocando? (a Mesa de Som só aparece enquanto active = true) */
  player: { active: boolean; title: string; audioOk: boolean | null }
  /** Valores atuais da Mesa de Som. Só em memória: volta ao padrão sempre que o telão abre ou fecha. */
  mix: MixParams
}

const emptySettings: Settings = {
  firstRunDone: true, lightMode: false, hoverPreview: true, sounds: true, desktopNotifications: true, theme: 'iasd-escuro',
  downloadDir: '', maxConcurrent: 2, refreshMinutes: 15, lastSeenVersion: '', pendingChangelog: null, searchHistory: [], lastYtdlpCheck: 0
}

let state: AppState = {
  ready: false,
  settings: emptySettings,
  feed: { items: [], updatedAt: 0, refreshing: false, errors: [], channels: [] },
  downloads: [],
  library: [],
  version: '',
  packaged: false,
  portable: false,
  ytdlpVersion: '',
  receiving: false,
  page: 'home',
  homeChannel: null,
  query: '',
  searchResults: null,
  searching: false,
  searchError: null,
  toasts: [],
  update: { phase: 'idle' },
  updateDismissed: null,
  whatsNew: null,
  changelog: [],
  downloadDialog: null,
  playTarget: null,
  confirmClose: false,
  maximized: false,
  player: { active: false, title: '', audioOk: null },
  mix: { ...DEFAULT_MIX }
}
const subs = new Set<() => void>()
const subscribe = (f: () => void): (() => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export const appStore = {
  get: (): AppState => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    subs.forEach((f) => f())
  }
}

/** Hook: use um seletor que devolva um valor estável (um campo do estado). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}
