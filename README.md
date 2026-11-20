# SonoplastiaPro - IASD

Central de vídeos, downloads e sonoplastia. **Electron + Vite + React + TypeScript + Tailwind CSS + shadcn/ui.**

👉 **Tudo explicado passo a passo em [`GUIA-PASSO-A-PASSO.md`](GUIA-PASSO-A-PASSO.md)** (instalar, testar, gerar o .exe, subir no GitHub e publicar atualizações).

## Atalhos
| Arquivo | Para quê |
|---|---|
| `1-INSTALAR.bat` | Primeira vez: instala as dependências e baixa o yt-dlp e o FFmpeg |
| `2-ABRIR-DEV.bat` | Abre o programa para testar (o que você editar atualiza na hora) |
| `3-GERAR-EXE.bat` | Gera o instalador e o portátil na pasta `release` |
| `4-PUBLICAR-NO-GITHUB.bat` | Publica a versão no GitHub (envia a atualização automática) |

## Mesa de Som (telão)
Equalizador, boost, limpeza de ruído e nivelador **em tempo real**, só enquanto há vídeo no telão (volta ao padrão sozinha). Motor em `src/renderer/src/lib/audioEngine.ts`, painel em `components/AudioMixer.tsx`, ponte IPC em `src/main/ipc.ts` e `src/main/player.ts`.

## Onde mexer
| O quê | Onde |
|---|---|
| Temas `.css` (embutidos no programa) | `src/renderer/src/themes/` |
| Cores / tema padrão | `src/renderer/src/index.css` |
| Canais acompanhados | `src/shared/types.ts` → `DEFAULT_CHANNELS` |
| Novidades da versão ("O que há de novo") | `resources/changelog.json` |
| Versão do programa | `package.json` → `"version"` |
| Usuário do GitHub (atualizações) | `electron-builder.yml` → `owner` |
| Formatos / qualidade (4K) | `src/main/parsers.ts` |
| Presets da Mesa de Som | `src/shared/mix.ts` → `MIX_PRESETS` |
