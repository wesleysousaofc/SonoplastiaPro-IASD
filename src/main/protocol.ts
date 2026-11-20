import { protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { getSettings } from './settings'
import { previewsDir, thumbsDir } from './paths'
import type { Library } from './library'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.aac': 'audio/aac',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'
}

const toWeb = (s: Readable): ReadableStream => Readable.toWeb(s) as unknown as ReadableStream

/**
 * spa://local/?p=<caminho> serve só arquivos conhecidos (miniaturas, prévias, biblioteca, pasta de downloads).
 * Responde com "Range" (206): é isso que permite avançar/voltar no vídeo (setas do player do telão).
 */
export function registerMediaProtocol(library: Library): void {
  const allowed = (p: string): boolean => {
    const abs = resolve(p)
    const roots = [thumbsDir(), previewsDir(), getSettings().downloadDir].map((r) => resolve(r) + sep)
    return library.has(abs) || library.has(p) || roots.some((r) => abs.startsWith(r))
  }

  protocol.handle('spa', (request) => {
    const p = new URL(request.url).searchParams.get('p')
    if (!p || !allowed(p)) return new Response('Acesso negado', { status: 403 })
    let size: number
    try {
      size = statSync(p).size
    } catch {
      return new Response('Arquivo não encontrado', { status: 404 })
    }
    const headers: Record<string, string> = {
      'Content-Type': MIME[extname(p).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      // CORS: sem isso o Web Audio (createMediaElementSource) recebe silêncio de mídia "de outra origem"
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
    }
    const range = request.headers.get('range')
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null
    if (m && size > 0) {
      let start = m[1] ? parseInt(m[1], 10) : NaN
      let end = m[2] ? parseInt(m[2], 10) : NaN
      if (Number.isNaN(start)) {
        // "últimos N bytes"
        start = Math.max(0, size - (Number.isNaN(end) ? 0 : end))
        end = size - 1
      } else if (Number.isNaN(end) || end >= size) end = size - 1
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`
      headers['Content-Length'] = String(end - start + 1)
      return new Response(toWeb(createReadStream(p, { start, end })), { status: 206, headers })
    }
    headers['Content-Length'] = String(size)
    return new Response(toWeb(createReadStream(p)), { status: 200, headers })
  })
}
