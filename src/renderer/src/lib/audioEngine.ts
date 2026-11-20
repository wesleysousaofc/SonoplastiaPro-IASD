import { DEFAULT_MIX, sanitizeMix, type MixParams } from '@shared/mix'

/*
 * MOTOR DA MESA DE SOM (Web Audio API) — roda na janela do telão, ao lado do <video>.
 *
 *  <video> → HPF 80 Hz → LPF 12 kHz → Graves (lowshelf 100 Hz) → Médios (peaking 1500 Hz, Q=1)
 *          → Agudos (highshelf 5 kHz) → Compressor → Ganho (boost 1.0–2.5) → Limitador de segurança → saída
 *
 * Regras que evitam os erros clássicos:
 *  - UM AudioContext por janela (compartilhado) e UM motor por elemento (WeakMap): o React StrictMode roda os
 *    efeitos duas vezes, e createMediaElementSource() só pode ser chamado uma vez por elemento.
 *  - O <video> precisa de crossOrigin="anonymous" e o protocolo spa:// responde com CORS; sem isso o Chromium
 *    devolve SILÊNCIO ao usar createMediaElementSource em mídia de outra origem.
 *  - Filtros desligados não são desconectados (evita "estalos"): ficam em posição neutra e os valores mudam suavemente.
 *  - O limitador final (threshold −1 dB) impede distorção/pico estourado quando o boost é alto.
 */

const SMOOTH = 0.015 // constante de tempo (s) das mudanças: sem estalo e sem atraso perceptível
const COMPRESSOR_MAKEUP = 1.6 // ≈ +4 dB: o nivelador reduz picos e este ganho "levanta" as partes baixas

let sharedCtx: AudioContext | null = null
const engines = new WeakMap<HTMLMediaElement, AudioEngine>()

function getContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AudioContext({ latencyHint: 'interactive' })
  return sharedCtx
}

export class AudioEngine {
  readonly ctx: AudioContext
  private hp: BiquadFilterNode
  private lp: BiquadFilterNode
  private low: BiquadFilterNode
  private mid: BiquadFilterNode
  private high: BiquadFilterNode
  private comp: DynamicsCompressorNode
  private gain: GainNode
  private limiter: DynamicsCompressorNode
  private current: MixParams = { ...DEFAULT_MIX }

  constructor(private el: HTMLMediaElement) {
    const c = (this.ctx = getContext())
    const src = c.createMediaElementSource(el) // lança erro se já foi chamado neste elemento

    this.hp = c.createBiquadFilter()
    this.hp.type = 'highpass'
    this.hp.Q.value = 0
    this.lp = c.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.Q.value = 0
    this.low = c.createBiquadFilter()
    this.low.type = 'lowshelf'
    this.low.frequency.value = 100
    this.mid = c.createBiquadFilter()
    this.mid.type = 'peaking'
    this.mid.frequency.value = 1500
    this.mid.Q.value = 1
    this.high = c.createBiquadFilter()
    this.high.type = 'highshelf'
    this.high.frequency.value = 5000
    this.comp = c.createDynamicsCompressor()
    this.gain = c.createGain()
    this.limiter = c.createDynamicsCompressor()
    this.limiter.threshold.value = -1
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.001
    this.limiter.release.value = 0.1

    src.connect(this.hp)
    this.hp.connect(this.lp)
    this.lp.connect(this.low)
    this.low.connect(this.mid)
    this.mid.connect(this.high)
    this.high.connect(this.comp)
    this.comp.connect(this.gain)
    this.gain.connect(this.limiter)
    this.limiter.connect(c.destination)

    // Depois do createMediaElementSource o som só sai pelo grafo: o contexto TEM que estar rodando.
    el.addEventListener('play', this.wake)
    this.wake()
    this.apply(DEFAULT_MIX, true)
  }

  private wake = (): void => {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private set(param: AudioParam, value: number, instant: boolean): void {
    if (instant) {
      param.value = value
      return
    }
    const t = this.ctx.currentTime
    param.cancelScheduledValues(t)
    param.setTargetAtTime(value, t, SMOOTH)
  }

  /** Aplica os valores da mesa em tempo real. */
  apply(raw: MixParams, instant = false): void {
    const p = sanitizeMix(raw)
    this.current = p
    const nyquist = this.ctx.sampleRate / 2
    // Limpar ruído: corta roncos (<80 Hz) e chiados (>12 kHz). Desligado = filtros fora da faixa audível.
    this.set(this.hp.frequency, p.noise ? 80 : 10, instant)
    this.set(this.lp.frequency, p.noise ? 12000 : nyquist, instant)
    this.set(this.low.gain, p.bass, instant)
    this.set(this.mid.gain, p.mid, instant)
    this.set(this.high.gain, p.treble, instant)
    // Compressor: ligado nivela; desligado fica transparente (razão 1:1, sem redução)
    this.set(this.comp.threshold, p.compressor ? -30 : 0, instant)
    this.set(this.comp.knee, p.compressor ? 20 : 0, instant)
    this.set(this.comp.ratio, p.compressor ? 6 : 1, instant)
    this.set(this.comp.attack, 0.005, instant)
    this.set(this.comp.release, 0.25, instant)
    this.set(this.gain.gain, p.boost * (p.compressor ? COMPRESSOR_MAKEUP : 1), instant)
  }

  reset(): void {
    this.apply(DEFAULT_MIX)
  }
  get params(): MixParams {
    return this.current
  }

  /** Só para o fechamento real da janela (nunca no cleanup de efeito do React). */
  dispose(): void {
    this.el.removeEventListener('play', this.wake)
    if (this.ctx.state !== 'closed') void this.ctx.close()
    sharedCtx = null
  }
}

/** Devolve sempre o MESMO motor para o mesmo elemento (seguro no StrictMode e em re-renderizações). */
export function getAudioEngine(el: HTMLMediaElement): AudioEngine {
  let e = engines.get(el)
  if (!e) {
    e = new AudioEngine(el)
    engines.set(el, e)
  }
  return e
}
