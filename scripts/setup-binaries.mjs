// Baixa o yt-dlp.exe e o ffmpeg.exe para resources/bin (vão dentro do instalador, então
// quem instalar o programa NÃO precisa instalar mais nada).
//   node scripts/setup-binaries.mjs            → baixa o que faltar
//   node scripts/setup-binaries.mjs --force    → baixa tudo de novo (atualiza o yt-dlp)
//   node scripts/setup-binaries.mjs --if-missing → usado no "npm install"; nunca falha a instalação
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bin = join(root, 'resources', 'bin')
const force = process.argv.includes('--force')
const soft = process.argv.includes('--if-missing')
mkdirSync(bin, { recursive: true })

const YTDLP = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
const FFMPEG_ZIP = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

async function download(url, dest, label) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`${label}: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let got = 0
  let last = 0
  const body = Readable.fromWeb(res.body)
  body.on('data', (c) => {
    got += c.length
    const pct = total ? Math.floor((got / total) * 100) : 0
    if (pct >= last + 10) {
      last = pct
      process.stdout.write(`   ${label}: ${pct}%\r\n`)
    }
  })
  await pipeline(body, createWriteStream(dest))
}

function findFile(dir, name) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) {
      const r = findFile(p, name)
      if (r) return r
    } else if (f.toLowerCase() === name) return p
  }
  return null
}

async function getYtdlp() {
  const dest = join(bin, 'yt-dlp.exe')
  if (existsSync(dest) && !force) return console.log('✔ yt-dlp.exe já existe')
  console.log('⬇ Baixando yt-dlp.exe …')
  await download(YTDLP, dest, 'yt-dlp')
  console.log('✔ yt-dlp.exe pronto')
}

async function getFfmpeg() {
  const dest = join(bin, 'ffmpeg.exe')
  if (existsSync(dest) && !force) return console.log('✔ ffmpeg.exe já existe')
  // reaproveita um FFmpeg que já exista no PC (ex.: o do MediaFácil em C:\ffmpeg\bin)
  const candidates = [process.env.SONOPLASTIA_FFMPEG, 'C:\\ffmpeg\\bin\\ffmpeg.exe', join(root, 'ffmpeg', 'ffmpeg.exe')].filter(Boolean)
  for (const c of candidates) {
    if (existsSync(c)) {
      copyFileSync(c, dest)
      return console.log(`✔ ffmpeg.exe copiado de ${c}`)
    }
  }
  console.log('⬇ Baixando FFmpeg (≈ 80 MB, só na primeira vez) …')
  const zip = join(tmpdir(), 'ffmpeg-essentials.zip')
  const out = join(tmpdir(), 'ffmpeg-essentials')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  await download(FFMPEG_ZIP, zip, 'ffmpeg')
  console.log('📦 Extraindo …')
  execFileSync('tar', ['-xf', zip, '-C', out], { stdio: 'inherit' }) // tar já vem no Windows 10/11
  const found = findFile(out, 'ffmpeg.exe')
  if (!found) throw new Error('ffmpeg.exe não encontrado dentro do zip baixado.')
  copyFileSync(found, dest)
  rmSync(out, { recursive: true, force: true })
  rmSync(zip, { force: true })
  console.log('✔ ffmpeg.exe pronto')
}

try {
  await getYtdlp()
  await getFfmpeg()
  if (!existsSync(join(bin, 'LocalSend-CLI.exe'))) console.log('⚠ LocalSend-CLI.exe não está em resources/bin (o recurso LocalSend ficará indisponível).')
  console.log('\n✅ Binários prontos em resources/bin')
} catch (e) {
  console.error(`\n✖ Não foi possível baixar os binários: ${e.message}`)
  console.error('  Verifique a internet e rode:  npm run setup')
  if (!soft) process.exit(1)
}
