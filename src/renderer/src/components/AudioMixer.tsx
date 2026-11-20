import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, SlidersVertical, TriangleAlert } from 'lucide-react'
import { BOOST_RANGE, DEFAULT_MIX, EQ_RANGE, MIX_PRESETS, sameMix } from '@shared/mix'
import { applyMix, resetMix, setMix } from '@/lib/actions'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

const db = (v: number): string => `${v > 0 ? '+' : ''}${v} dB`

function Fader(props: {
  label: string
  sub: string
  value: number
  min: number
  max: number
  step: number
  display: string
  bipolar?: boolean
  disabled?: boolean
  onChange: (v: number) => void
  onReset: () => void
}): JSX.Element {
  return (
    <div className="flex w-[68px] flex-col items-center gap-1.5" title="Dê dois cliques para zerar" onDoubleClick={props.onReset}>
      <span className="text-[11px] font-bold tabular-nums">{props.display}</span>
      <div className="relative h-28">
        <Slider orientation="vertical" noRange={props.bipolar} className="h-28" min={props.min} max={props.max} step={props.step} value={[props.value]} disabled={props.disabled} onValueChange={(v: number[]) => props.onChange(v[0])} />
        {props.bipolar && <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 bg-muted-foreground/70" />}
      </div>
      <span className="text-xs font-semibold leading-none">{props.label}</span>
      <span className="text-[10px] leading-none text-muted-foreground">{props.sub}</span>
    </div>
  )
}

/**
 * Mesa de Som em tempo real. Só aparece enquanto há mídia no telão e volta ao padrão sozinha
 * quando o vídeo acaba, o telão fecha ou o arquivo troca. Nada é salvo.
 */
export function AudioMixer(): JSX.Element | null {
  const player = useApp((s) => s.player)
  const mix = useApp((s) => s.mix)
  const [open, setOpen] = useState(true)
  if (!player.active) return null
  const off = player.audioOk === false

  return (
    <div className="spa-mixer glass fixed bottom-12 left-1/2 z-40 w-[min(94vw,700px)] -translate-x-1/2 rounded-3xl p-4 shadow-2xl">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-xl bg-brand text-white"><SlidersVertical className="size-4" /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold">Mesa de Som <span className="font-normal text-muted-foreground">· ao vivo</span></p>
          <p className="truncate text-xs text-muted-foreground">No telão: {player.title}</p>
        </div>
        {open && (
          <Button size="sm" variant="secondary" disabled={off || sameMix(mix, DEFAULT_MIX)} onClick={resetMix}>
            <RotateCcw /> Zerar
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" title={open ? 'Recolher' : 'Abrir mesa'} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </div>

      {open && (
        <>
          {off && (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-warning/15 px-3.5 py-2.5 text-xs text-warning">
              <TriangleAlert className="size-4 shrink-0" /> A mesa de som não está disponível para este arquivo. O vídeo toca normalmente, sem ajustes.
            </p>
          )}

          <div className="mt-3 grid grid-cols-4 gap-2">
            {MIX_PRESETS.map((p) => (
              <Button key={p.id} size="sm" title={p.hint} disabled={off} variant={sameMix(mix, p.params) ? 'default' : 'secondary'} className="h-10 px-2 text-xs" onClick={() => applyMix(p.params)}>
                <span>{p.emoji}</span> {p.label}
              </Button>
            ))}
          </div>

          <div className={cn('mt-4 flex items-end justify-between gap-3', off && 'pointer-events-none opacity-50')}>
            <div className="flex gap-1">
              <Fader label="Graves" sub="100 Hz" bipolar min={EQ_RANGE.min} max={EQ_RANGE.max} step={1} value={mix.bass} display={db(mix.bass)} disabled={off} onChange={(v) => setMix({ bass: v })} onReset={() => setMix({ bass: 0 })} />
              <Fader label="Médios" sub="Voz" bipolar min={EQ_RANGE.min} max={EQ_RANGE.max} step={1} value={mix.mid} display={db(mix.mid)} disabled={off} onChange={(v) => setMix({ mid: v })} onReset={() => setMix({ mid: 0 })} />
              <Fader label="Agudos" sub="Clareza" bipolar min={EQ_RANGE.min} max={EQ_RANGE.max} step={1} value={mix.treble} display={db(mix.treble)} disabled={off} onChange={(v) => setMix({ treble: v })} onReset={() => setMix({ treble: 0 })} />
              <div className="mx-1 w-px self-stretch bg-border" />
              <Fader label="Boost" sub="Volume extra" min={BOOST_RANGE.min * 100} max={BOOST_RANGE.max * 100} step={5} value={Math.round(mix.boost * 100)} display={`${Math.round(mix.boost * 100)}%`} disabled={off} onChange={(v) => setMix({ boost: v / 100 })} onReset={() => setMix({ boost: 1 })} />
            </div>

            <div className="flex min-w-[230px] flex-1 flex-col gap-3 pb-1">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/50 px-3.5 py-2.5">
                <div className="flex-1 leading-tight">
                  <p className="text-[13px] font-semibold">Limpar Ruído / Chiado</p>
                  <p className="text-[11px] text-muted-foreground">Corta ronco grave e chiado agudo</p>
                </div>
                <Switch checked={mix.noise} disabled={off} onCheckedChange={(v) => setMix({ noise: v })} />
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/50 px-3.5 py-2.5">
                <div className="flex-1 leading-tight">
                  <p className="text-[13px] font-semibold">Nivelador / Compressor</p>
                  <p className="text-[11px] text-muted-foreground">Levanta partes baixas, segura picos</p>
                </div>
                <Switch checked={mix.compressor} disabled={off} onCheckedChange={(v) => setMix({ compressor: v })} />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
