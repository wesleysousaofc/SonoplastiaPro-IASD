// Tipos compartilhados entre o processo principal (Electron), o preload e a interface (React).

import type { MixParams } from './mix'

export type Mode = 'MP4' | 'MKV' | 'Original' | 'MP3' | 'M4A' | 'WAV'
export const VIDEO_MODES: Mode[] = ['MP4', 'MKV', 'Original']
export const AUDIO_MODES: Mode[] = ['MP3', 'M4A', 'WAV']
export const isAudioMode = (m: Mode): boolean => AUDIO_MODES.includes(m)

export interface Channel {
  id: string // ID do canal no YouTube (UC...)
  name: string
  short: string
  emoji: string
}

/** Canais acompanhados. Para adicionar outro canal, basta incluir mais um item aqui. */
export const DEFAULT_CHANNELS: Channel[] = [
  { id: 'UCR5me469JF9P-ZkOG3TkPmg', name: 'Provai e Vede | Oficial', short: 'Provai e Vede', emoji: '🙏' },
  { id: 'UCZrVZOwtnvVIdsZnDpVb7jw', name: 'Informativo Mundial Das Missões', short: 'Informativo Mundial', emoji: '🌍' }
]

export interface VideoItem {
  id: string
  title: string
  url: string
  channel: string
  channelId?: string
  thumbnail: string
  duration?: number | null
  published?: string // ISO
  viewCount?: number | null
  isNew?: boolean
}

export interface QualityChoice {
  label: string
  value: number | string | null
  size?: number | null // bytes (estimativa)
}
export interface QualityInfo {
  title: string
  thumbnail: string
  duration: number
  uploader: string
  choices: QualityChoice[]
}

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'paused' | 'later' | 'done' | 'error' | 'canceled'

export interface NewDownloadSpec {
  url: string
  title: string
  thumbnail?: string
  mode: Mode
  quality: string
  qualityValue: number | string | null
  folder: string
  fileName?: string
  playlist: boolean
  sizeEstimate?: number | null
}

export interface DownloadJob extends NewDownloadSpec {
  id: string
  status: DownloadStatus
  percent: number // 0..100
  speed: number | null // bytes/s
  eta: number | null // segundos
  downloaded: number
  total: number | null
  files: string[]
  filePath?: string
  error?: string
  createdAt: number
  finishedAt?: number
}

export interface LibraryItem {
  path: string
  title: string
  downloadedAt: number
  mode?: Mode
  thumb?: string // arquivo local da miniatura
  remoteThumb?: string
  missing?: boolean
  size?: number
}

export interface FeedState {
  items: VideoItem[]
  updatedAt: number
  refreshing: boolean
  errors: string[]
  channels: Channel[]
}

export interface Settings {
  firstRunDone: boolean
  lightMode: boolean
  hoverPreview: boolean
  sounds: boolean
  desktopNotifications: boolean
  theme: string // 'iasd-escuro' | 'iasd-claro' | nome de arquivo .css
  downloadDir: string
  maxConcurrent: number
  refreshMinutes: number
  lastSeenVersion: string
  pendingChangelog?: { version: string; notes: string } | null
  searchHistory: string[]
  lastYtdlpCheck: number
}

export interface Notice {
  kind: 'success' | 'error' | 'info' | 'new'
  title: string
  message: string
  thumb?: string
  key?: string // avisos com a mesma chave se substituem (nunca empilham)
}

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error'
export interface UpdateState {
  phase: UpdatePhase
  version?: string
  notes?: string
  percent?: number
  error?: string
  portable?: boolean
  manual?: boolean // verificação pedida pelo usuário
}

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  items: string[]
}

export interface DisplayInfo {
  index: number
  name: string
  width: number
  height: number
  primary: boolean
}
export interface PlayOptions {
  path: string
  title: string
  displayIndex: number
  fullscreen: boolean
}

export interface HardwareInfo {
  device: string
  cpu: string
  ram: string
  gpu: string
  disk: string
  os: string
}
export interface LiveStats {
  cpu: number
  ramPct: number
  ramUsedGB: number
  ramTotalGB: number
}

export type VoiceStatus = 'ok' | 'norecognizer' | 'nomic' | 'nospeech' | 'nopowershell' | 'error'
export interface VoiceResult {
  status: VoiceStatus
  text: string
}

export interface PlayerState {
  active: boolean // há mídia aberta no telão?
  title?: string
}
export interface AudioStatus {
  ok: boolean // o motor de áudio do telão está pronto?
  error?: string
}

export interface InitData {
  settings: Settings
  feed: FeedState
  downloads: DownloadJob[]
  library: LibraryItem[]
  version: string
  packaged: boolean
  portable: boolean
  localsendReceiving: boolean
  ytdlpVersion: string
  update: UpdateState
}

export interface EventMap {
  'feed:update': FeedState
  'downloads:update': DownloadJob[]
  'library:update': LibraryItem[]
  notify: Notice
  'update:state': UpdateState
  'win:maximized': boolean
  'app:confirm-close': undefined
  'localsend:status': boolean
  'player:state': PlayerState
  'audio:apply': MixParams
  'audio:status': AudioStatus
}
export type EventName = keyof EventMap

export interface Api {
  init(): Promise<InitData>
  settings: { patch(p: Partial<Settings>): Promise<Settings> }
  feed: { refresh(): Promise<void> }
  search: { run(q: string): Promise<VideoItem[]>; suggest(q: string): Promise<string[]> }
  qualities: { get(url: string, mode: Mode): Promise<QualityInfo> }
  preview: { resolve(url: string, id: string, duration?: number): Promise<string | null>; cancel(id: string): Promise<void> }
  downloads: {
    add(spec: NewDownloadSpec, startNow: boolean): Promise<void>
    pause(id: string): Promise<void>
    resume(id: string): Promise<void>
    cancel(id: string): Promise<void>
    remove(id: string): Promise<void>
    retry(id: string): Promise<void>
    startAll(): Promise<void>
    clearFinished(): Promise<void>
    showFile(id: string): Promise<void>
  }
  library: { remove(path: string): Promise<void>; relocate(path: string): Promise<void>; showFile(path: string): Promise<void> }
  player: { displays(): Promise<DisplayInfo[]>; open(o: PlayOptions): Promise<void> }
  /** Mesa de Som: a janela principal envia (set); o telão avisa se o motor está pronto (status). */
  audio: { set(p: MixParams): void; status(s: AudioStatus): void }
  system: { hardware(): Promise<HardwareInfo>; live(): Promise<LiveStats>; diskFree(dir: string): Promise<number | null> }
  voice: { listen(): Promise<VoiceResult>; openSettings(kind: 'speech' | 'mic'): Promise<void> }
  localsend: { send(files: string[]): Promise<string | null>; startReceive(dir: string): Promise<string | null>; stopReceive(): Promise<void> }
  dialog: { pickFolder(initial?: string): Promise<string | null>; pickFiles(): Promise<string[]>; pickFile(): Promise<string | null> }
  update: { check(manual?: boolean): Promise<void>; download(): Promise<void>; install(): Promise<void> }
  ytdlp: { update(): Promise<string> }
  win: { minimize(): void; toggleMaximize(): void; close(): void; forceClose(): void }
  app: {
    openExternal(url: string): Promise<void>
    clipboardRead(): Promise<string>
    clearCache(): Promise<void>
    changelog(): Promise<ChangelogEntry[]>
    openLogs(): Promise<void>
  }
  on<E extends EventName>(channel: E, cb: (payload: EventMap[E]) => void): () => void
}
