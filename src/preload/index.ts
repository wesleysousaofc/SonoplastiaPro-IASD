import { contextBridge, ipcRenderer } from 'electron'
import type { Api, EventName } from '../shared/types'

const inv = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: Api = {
  init: () => inv('init'),
  settings: { patch: (p) => inv('settings:patch', p) },
  feed: { refresh: () => inv('feed:refresh') },
  search: { run: (q) => inv('search:run', q), suggest: (q) => inv('search:suggest', q) },
  qualities: { get: (url, mode) => inv('qualities:get', url, mode) },
  preview: { resolve: (url, id, duration) => inv('preview:resolve', url, id, duration), cancel: (id) => inv('preview:cancel', id) },
  downloads: {
    add: (spec, startNow) => inv('downloads:add', spec, startNow),
    pause: (id) => inv('downloads:pause', id),
    resume: (id) => inv('downloads:resume', id),
    cancel: (id) => inv('downloads:cancel', id),
    remove: (id) => inv('downloads:remove', id),
    retry: (id) => inv('downloads:retry', id),
    startAll: () => inv('downloads:startAll'),
    clearFinished: () => inv('downloads:clearFinished'),
    showFile: (id) => inv('downloads:showFile', id)
  },
  library: { remove: (p) => inv('library:remove', p), relocate: (p) => inv('library:relocate', p), showFile: (p) => inv('library:showFile', p) },
  player: { displays: () => inv('player:displays'), open: (o) => inv('player:open', o) },
  audio: { set: (p) => ipcRenderer.send('audio:set', p), status: (s) => ipcRenderer.send('audio:status', s) },
  system: { hardware: () => inv('system:hardware'), live: () => inv('system:live'), diskFree: (d) => inv('system:diskFree', d) },
  voice: { listen: () => inv('voice:listen'), openSettings: (k) => inv('voice:openSettings', k) },
  localsend: { send: (f) => inv('localsend:send', f), startReceive: (d) => inv('localsend:startReceive', d), stopReceive: () => inv('localsend:stopReceive') },
  dialog: { pickFolder: (i) => inv('dialog:pickFolder', i), pickFiles: () => inv('dialog:pickFiles'), pickFile: () => inv('dialog:pickFile') },
  update: { check: (m) => inv('update:check', m), download: () => inv('update:download'), install: () => inv('update:install') },
  ytdlp: { update: () => inv('ytdlp:update') },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
    close: () => ipcRenderer.send('win:close'),
    forceClose: () => ipcRenderer.send('win:forceClose')
  },
  app: {
    openExternal: (u) => inv('app:openExternal', u),
    clipboardRead: () => inv('app:clipboardRead'),
    clearCache: () => inv('app:clearCache'),
    changelog: () => inv('app:changelog'),
    openLogs: () => inv('app:openLogs')
  },
  on: (channel: EventName, cb) => {
    const handler = (_e: unknown, payload: unknown): void => (cb as (p: unknown) => void)(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
