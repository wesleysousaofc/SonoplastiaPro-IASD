import os from 'node:os'
import { execFile } from 'node:child_process'
import { statfsSync } from 'node:fs'
import type { HardwareInfo, LiveStats } from '../shared/types'

export function detectWeak(): boolean {
  try {
    const cores = os.cpus().length || 4
    const ramGB = os.totalmem() / 1024 ** 3
    return cores <= 2 || ramGB <= 4.5
  } catch {
    return false
  }
}

const snapshot = (): { idle: number; total: number } => {
  let idle = 0
  let total = 0
  for (const c of os.cpus()) {
    const t = c.times
    idle += t.idle
    total += t.user + t.nice + t.sys + t.idle + t.irq
  }
  return { idle, total }
}
let prev = snapshot()

export function liveStats(): LiveStats {
  const cur = snapshot()
  const dTotal = cur.total - prev.total
  const dIdle = cur.idle - prev.idle
  prev = cur
  const cpu = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0
  const total = os.totalmem()
  const used = total - os.freemem()
  return {
    cpu: Math.max(0, Math.min(100, cpu)),
    ramPct: Math.round((used / total) * 100),
    ramUsedGB: +(used / 1024 ** 3).toFixed(1),
    ramTotalGB: +(total / 1024 ** 3).toFixed(1)
  }
}

export function diskFreeBytes(dir: string): number | null {
  // sobe até achar uma pasta existente (a de destino pode ainda não existir)
  let p = dir
  for (let i = 0; i < 6; i++) {
    try {
      const s = statfsSync(p)
      return Number(s.bavail) * Number(s.bsize)
    } catch {
      const parent = p.replace(/[\\/][^\\/]*$/, '')
      if (!parent || parent === p) break
      p = parent
    }
  }
  return null
}

const PS = `
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$cpu=(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)
$gpus=(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }) -join ' | '
$disk=(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { '{0} {1} GB livres de {2} GB' -f $_.DeviceID,[math]::Round($_.FreeSpace/1GB,0),[math]::Round($_.Size/1GB,0) }) -join ' · '
$osn=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').ProductName
Write-Output ('CPU='+$cpu)
Write-Output ('GPU='+$gpus)
Write-Output ('DISK='+$disk)
Write-Output ('OS='+$osn)
`

export function hardwareInfo(): Promise<HardwareInfo> {
  const info: HardwareInfo = {
    device: os.hostname(),
    cpu: os.cpus()[0]?.model?.trim() ?? '—',
    ram: `${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`,
    gpu: '—',
    disk: '—',
    os: `${os.type()} ${os.release()}`
  }
  if (process.platform !== 'win32') return Promise.resolve(info)
  const enc = Buffer.from(PS, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true, timeout: 20000, encoding: 'utf8' }, (_e, out) => {
      for (const raw of String(out ?? '').split(/\r?\n/)) {
        const line = raw.trim()
        if (line.startsWith('CPU=') && line.length > 4) info.cpu = line.slice(4)
        else if (line.startsWith('GPU=') && line.length > 4) info.gpu = line.slice(4)
        else if (line.startsWith('DISK=') && line.length > 5) info.disk = line.slice(5)
        else if (line.startsWith('OS=') && line.length > 3) info.os = `${line.slice(3)} · ${os.release()}`
      }
      resolve(info)
    })
  })
}
