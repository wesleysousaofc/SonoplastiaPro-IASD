export function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i >= 2 ? 2 : 0)} ${u[i]}`.replace('.', ',')
}
export const formatSpeed = (bps?: number | null): string => (bps ? `${formatBytes(bps)}/s` : '—')
export function formatEta(s?: number | null): string {
  if (s == null) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`
}
export function formatDuration(sec?: number | null): string {
  if (!sec) return ''
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}
export function formatViews(n?: number | null): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi de visualizações`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')} mil visualizações`
  return `${n} visualizações`
}
export function timeAgo(iso?: string | number | null): string {
  if (!iso) return ''
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (secs < 60) return 'agora mesmo'
  const plural = (n: number, a: string, b: string): string => `há ${n} ${n === 1 ? a : b}`
  const min = Math.floor(secs / 60)
  if (min < 60) return plural(min, 'minuto', 'minutos')
  const h = Math.floor(min / 60)
  if (h < 24) return plural(h, 'hora', 'horas')
  const d = Math.floor(h / 24)
  if (d < 7) return plural(d, 'dia', 'dias')
  if (d < 30) return plural(Math.floor(d / 7), 'semana', 'semanas')
  if (d < 365) return plural(Math.floor(d / 30), 'mês', 'meses')
  return plural(Math.floor(d / 365), 'ano', 'anos')
}
export const clockTime = (d = new Date()): string =>
  d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '  ')
