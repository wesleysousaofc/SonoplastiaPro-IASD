// Sons gerados por código (Web Audio): não dependem de arquivos, então nunca dão erro de "arquivo não encontrado".
let ctx: AudioContext | null = null
let enabled = true
export const setSoundEnabled = (v: boolean): void => {
  enabled = v
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18): void {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, ctx.currentTime + start)
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start)
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + start)
  o.stop(ctx.currentTime + start + dur + 0.05)
}

export function playSound(kind: 'success' | 'error' | 'info' | 'new'): void {
  if (!enabled) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    if (kind === 'success') {
      tone(880, 0, 0.14)
      tone(1318.5, 0.11, 0.22)
    } else if (kind === 'error') {
      tone(392, 0, 0.16, 'triangle', 0.22)
      tone(293.7, 0.15, 0.3, 'triangle', 0.22)
    } else if (kind === 'new') {
      tone(784, 0, 0.14)
      tone(988, 0.12, 0.14)
      tone(1318.5, 0.24, 0.3)
    } else {
      tone(740, 0, 0.18)
    }
  } catch {
    /* sem áudio disponível: segue sem som */
  }
}
