// Parâmetros da "Mesa de Som" (efêmeros: nunca são gravados em disco; valem só enquanto o vídeo toca).

export interface MixParams {
  noise: boolean // Limpar ruído/chiado: passa-altas 80 Hz + passa-baixas 12 kHz
  bass: number // dB (-12..+12) — low-shelf 100 Hz
  mid: number // dB (-12..+12) — peaking 1500 Hz, Q = 1
  treble: number // dB (-12..+12) — high-shelf 5000 Hz
  compressor: boolean // Nivelador / compressor
  boost: number // ganho extra: 1.0 (100 %) a 2.5 (250 %)
}

export const DEFAULT_MIX: MixParams = { noise: false, bass: 0, mid: 0, treble: 0, compressor: false, boost: 1 }
export const EQ_RANGE = { min: -12, max: 12 }
export const BOOST_RANGE = { min: 1, max: 2.5 }

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/** Valida o que chega por IPC: nenhum valor fora da faixa chega ao motor de áudio. */
export function sanitizeMix(p: unknown): MixParams {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
  return {
    noise: o.noise === true,
    bass: num(o.bass, EQ_RANGE.min, EQ_RANGE.max, 0),
    mid: num(o.mid, EQ_RANGE.min, EQ_RANGE.max, 0),
    treble: num(o.treble, EQ_RANGE.min, EQ_RANGE.max, 0),
    compressor: o.compressor === true,
    boost: num(o.boost, BOOST_RANGE.min, BOOST_RANGE.max, 1)
  }
}

export const sameMix = (a: MixParams, b: MixParams): boolean =>
  a.noise === b.noise && a.compressor === b.compressor && a.bass === b.bass && a.mid === b.mid && a.treble === b.treble && Math.abs(a.boost - b.boost) < 0.001

export interface MixPreset {
  id: string
  label: string
  emoji: string
  hint: string
  params: MixParams
}

/** Presets de 1 clique para o operador usar ao vivo. */
export const MIX_PRESETS: MixPreset[] = [
  { id: 'normal', label: 'Normal', emoji: '🔄', hint: 'Tudo zerado', params: { ...DEFAULT_MIX } },
  { id: 'voz', label: 'Tirar Abafado', emoji: '🗣️', hint: 'Voz mais clara: grave −4, médio +5, agudo +4, nivelador e limpeza ligados', params: { noise: true, bass: -4, mid: 5, treble: 4, compressor: true, boost: 1 } },
  { id: 'baixo', label: 'Som Muito Baixo', emoji: '🔊', hint: 'Boost 180 % + nivelador', params: { noise: false, bass: 0, mid: 0, treble: 0, compressor: true, boost: 1.8 } },
  { id: 'musica', label: 'Música / Louvor', emoji: '🎵', hint: 'Grave +3, agudo +3', params: { noise: false, bass: 3, mid: 0, treble: 3, compressor: false, boost: 1 } }
]
