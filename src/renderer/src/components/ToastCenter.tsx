import { AlertTriangle, Check, CheckCheck, X } from 'lucide-react'
import { dismissToast } from '@/lib/actions'
import { useApp, type Toast } from '@/lib/store'
import { cn } from '@/lib/utils'

const EMOJI: Record<Toast['kind'], string> = { success: '✅', error: '⚠️', new: '🆕', info: '💬' }

/** Notificações em balão, no estilo de mensagem do WhatsApp (avatar, texto, hora e "tiques"). */
export function ToastCenter(): JSX.Element {
  const toasts = useApp((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-[70] flex w-[370px] flex-col gap-2.5">
      {toasts.map((t) => (
        <div key={t.id} role="status" onClick={() => dismissToast(t.id)} className="spa-toast glass pointer-events-auto group relative flex animate-toast-in cursor-pointer gap-3 rounded-2xl p-3 pr-4 shadow-2xl">
          <div className={cn('relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full text-2xl', t.kind === 'error' ? 'bg-destructive/25' : 'bg-brand/90')}>
            {t.thumb ? <img src={t.thumb} alt="" className="size-full object-cover" /> : EMOJI[t.kind]}
            {t.thumb && <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-card text-[11px]">{EMOJI[t.kind]}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-bold', t.kind === 'error' && 'text-destructive')}>{t.title}</p>
            <p className="line-clamp-3 whitespace-pre-line break-words text-[13px] leading-snug text-muted-foreground">{t.message}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {new Date(t.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {t.kind === 'success' && <CheckCheck className="size-4 text-sky-400" />}
              {t.kind === 'error' && <AlertTriangle className="size-3.5 text-destructive" />}
              {(t.kind === 'info' || t.kind === 'new') && <Check className="size-3.5" />}
            </p>
          </div>
          <button className="absolute right-2 top-2 hidden size-6 place-items-center rounded-full bg-secondary group-hover:grid" aria-label="Fechar"><X className="size-3" /></button>
        </div>
      ))}
    </div>
  )
}
