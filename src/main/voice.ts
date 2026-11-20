import { execFile } from 'node:child_process'
import { shell } from 'electron'
import type { VoiceResult } from '../shared/types'

// Reconhecimento de fala do próprio Windows (System.Speech): funciona offline e não depende de chaves do Google.
const SCRIPT = `
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$all=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$pick=$all | Where-Object {$_.Culture.Name -like 'pt*'} | Select-Object -First 1
if(-not $pick){$pick=$all | Select-Object -First 1}
if(-not $pick){Write-Output 'ERR:norecognizer'; exit}
$e=New-Object System.Speech.Recognition.SpeechRecognitionEngine($pick)
$e.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
try{$e.SetInputToDefaultAudioDevice()}catch{Write-Output 'ERR:nomic'; exit}
$r=$e.Recognize([TimeSpan]::FromSeconds(8))
if($r -and $r.Text){Write-Output ('OK:'+$r.Text)}else{Write-Output 'ERR:nospeech'}
`

let busy = false

export function listen(): Promise<VoiceResult> {
  if (process.platform !== 'win32') return Promise.resolve({ status: 'error', text: 'A busca por voz funciona apenas no Windows.' })
  if (busy) return Promise.resolve({ status: 'error', text: 'Já estou ouvindo…' })
  busy = true
  const enc = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true, timeout: 40000, encoding: 'utf8' }, (err, stdout, stderr) => {
      busy = false
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return resolve({ status: 'nopowershell', text: '' })
      const last = String(stdout ?? '').trim().split(/\r?\n/).pop()?.trim() ?? ''
      if (last.startsWith('OK:')) return resolve({ status: 'ok', text: last.slice(3).trim() })
      if (last.startsWith('ERR:')) {
        const code = last.slice(4).trim().toLowerCase()
        const status = (['norecognizer', 'nomic', 'nospeech'] as const).find((s) => s === code)
        return resolve({ status: status ?? 'error', text: '' })
      }
      resolve({ status: 'error', text: String(stderr ?? '').slice(-200) })
    })
  })
}

export function openVoiceSettings(kind: 'speech' | 'mic'): Promise<void> {
  return shell.openExternal(kind === 'speech' ? 'ms-settings:speech' : 'ms-settings:privacy-microphone')
}
