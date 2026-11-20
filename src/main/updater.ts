import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { UpdateState } from '../shared/types'
import { compareVersions, htmlToText } from './parsers'
import { isPortable, resourcesDir } from './paths'
import { patchSettings } from './settings'
import { send } from './context'

/*
 * Fluxo (versão instalada):
 *   abrir o programa → checa o GitHub Releases → "Nova atualização. Atualizar agora? SIM / NÃO"
 *   SIM → baixa → instala em silêncio por cima da versão antiga (a antiga é removida) → reabre sozinho
 *   próxima abertura → o programa mostra "O que há de novo" (texto do changelog.json / notas da release)
 *
 * Versão portable (.exe solto): o electron-updater não consegue se atualizar, então o programa baixa o novo
 * .exe portable da release e troca o arquivo por conta própria.
 */

let state: UpdateState = { phase: 'idle' }
let pending: { version: string; notes: string; assetUrl?: string } | null = null
let manual = false
let started = false

const set = (s: UpdateState): void => {
  state = { ...s, portable: isPortable(), manual }
  send('update:state', state)
}
export const getUpdateState = (): UpdateState => state

function notesToText(n: unknown): string {
  if (!n) return ''
  if (typeof n === 'string') return htmlToText(n)
  if (Array.isArray(n)) return n.map((x) => htmlToText(String((x as { note?: string }).note ?? ''))).join('\n\n')
  return ''
}

/** Lê owner/repo do app-update.yml que o electron-builder grava dentro do instalador. */
function readRepo(): { owner: string; repo: string } | null {
  try {
    const f = join(resourcesDir(), 'app-update.yml')
    if (!existsSync(f)) return null
    const txt = readFileSync(f, 'utf-8')
    const owner = /owner:\s*(\S+)/.exec(txt)?.[1]
    const repo = /repo:\s*(\S+)/.exec(txt)?.[1]
    return owner && repo ? { owner, repo } : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ versão instalada (NSIS) */
function initInstalled(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.on('checking-for-update', () => set({ phase: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    pending = { version: info.version, notes: notesToText(info.releaseNotes) }
    set({ phase: 'available', version: info.version, notes: pending.notes })
  })
  autoUpdater.on('update-not-available', () => set({ phase: 'none' }))
  autoUpdater.on('download-progress', (p) => set({ phase: 'downloading', version: pending?.version, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', () => set({ phase: 'ready', version: pending?.version, percent: 100 }))
  autoUpdater.on('error', (e) => set({ phase: 'error', error: friendly(e) }))
}

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|getaddrinfo/i.test(m)) return 'Sem conexão com a internet para verificar atualizações.'
  if (/404|latest\.yml|Cannot find/i.test(m)) return 'Nenhuma versão publicada no GitHub ainda.'
  return m.split('\n')[0].slice(0, 200)
}

/* ------------------------------------------------------------------ versão portable */
async function checkPortable(): Promise<void> {
  const repo = readRepo()
  if (!repo) {
    set({ phase: manual ? 'error' : 'none', error: 'Repositório do GitHub não configurado.' })
    return
  }
  set({ phase: 'checking' })
  try {
    const r = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`, { headers: { 'User-Agent': 'SonoplastiaPro-IASD', Accept: 'application/vnd.github+json' } })
    if (r.status === 404) return set({ phase: 'none' })
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`)
    const rel = (await r.json()) as { tag_name: string; body?: string; assets?: { name: string; browser_download_url: string }[] }
    const version = rel.tag_name.replace(/^v/i, '')
    const asset = rel.assets?.find((a) => /portable.*\.exe$/i.test(a.name))
    if (compareVersions(version, app.getVersion()) > 0 && asset) {
      pending = { version, notes: htmlToText(rel.body ?? ''), assetUrl: asset.browser_download_url }
      set({ phase: 'available', version, notes: pending.notes })
    } else set({ phase: 'none' })
  } catch (e) {
    set({ phase: 'error', error: friendly(e) })
  }
}

async function downloadPortable(): Promise<void> {
  if (!pending?.assetUrl) return
  try {
    const target = process.env.PORTABLE_EXECUTABLE_FILE as string
    const tmp = join(tmpdir(), `SonoplastiaPro-update-${pending.version}.exe`)
    const res = await fetch(pending.assetUrl, { headers: { 'User-Agent': 'SonoplastiaPro-IASD' } })
    if (!res.ok || !res.body) throw new Error(`Download falhou (${res.status})`)
    const total = Number(res.headers.get('content-length') ?? 0)
    let got = 0
    const body = Readable.fromWeb(res.body as never)
    body.on('data', (c: Buffer) => {
      got += c.length
      if (total) set({ phase: 'downloading', version: pending?.version, percent: Math.round((got / total) * 100) })
    })
    await pipeline(body, createWriteStream(tmp))
    const bat = join(tmpdir(), 'sonoplastiapro-update.bat')
    writeFileSync(
      bat,
      ['@echo off', 'chcp 65001 >nul', ':retry', 'timeout /t 1 /nobreak >nul', `move /y "${tmp}" "${target}" >nul 2>&1`, 'if errorlevel 1 goto retry', `start "" "${target}"`, 'del "%~f0"'].join('\r\n'),
      'utf-8'
    )
    set({ phase: 'ready', version: pending.version, percent: 100 })
    spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    setTimeout(() => app.exit(0), 600)
  } catch (e) {
    set({ phase: 'error', error: friendly(e) })
  }
}

/* ------------------------------------------------------------------ API usada pelo ipc.ts */
export function initUpdater(): void {
  if (started) return
  started = true
  if (app.isPackaged && !isPortable()) initInstalled()
  // checa 5 s depois de abrir e depois a cada 4 h
  setTimeout(() => void checkForUpdates(false), 5000)
  setInterval(() => void checkForUpdates(false), 4 * 3600_000)
}

export async function checkForUpdates(isManual: boolean): Promise<void> {
  manual = isManual
  if (['downloading', 'ready'].includes(state.phase)) return
  if (!app.isPackaged) {
    // em desenvolvimento não há o que atualizar
    set({ phase: isManual ? 'none' : 'idle' })
    return
  }
  if (isPortable()) return checkPortable()
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ phase: 'error', error: friendly(e) })
  }
}

export async function downloadUpdate(): Promise<void> {
  if (!pending) return
  // guarda o texto do "O que há de novo" para mostrar na próxima abertura
  patchSettings({ pendingChangelog: { version: pending.version, notes: pending.notes } })
  set({ phase: 'downloading', version: pending.version, percent: 0 })
  if (isPortable()) return downloadPortable()
  try {
    await autoUpdater.downloadUpdate()
  } catch (e) {
    set({ phase: 'error', error: friendly(e) })
  }
}

export function installUpdate(): void {
  if (isPortable()) return
  // silencioso = true (sem janelas), forceRunAfter = true (abre o programa de novo)
  autoUpdater.quitAndInstall(true, true)
}

export const openReleasesPage = (): Promise<void> => {
  const r = readRepo()
  return shell.openExternal(r ? `https://github.com/${r.owner}/${r.repo}/releases` : 'https://github.com')
}
