# SonoplastiaPro - IASD — Guia passo a passo (versão 1.0.2)

Siga na ordem. Não pule etapas.

---

## PARTE 1 — Colocar esta versão no seu computador

1. **Feche** o programa e o terminal do VS Code (se estiverem abertos).
2. Extraia o arquivo `SonoplastiaPro-IASD.zip` **POR CIMA da sua pasta atual** do projeto (a mesma onde estão `src`, `package.json`…), escolhendo **"Substituir os arquivos"**.
   - O zip NÃO traz `node_modules`, `out` nem `ffmpeg.exe`/`yt-dlp.exe`; por isso eles continuam na sua pasta. Não apague.
3. Abra a pasta no **VS Code**. Abra o terminal (`Ctrl + '`) e rode **uma vez**:
   ```
   npm install
   ```
   ⚠ **Obrigatório nesta versão:** ela usa **1 pacote novo** (`@radix-ui/react-slider`, os sliders da Mesa de Som). Sem este comando o programa não abre. O `package-lock.json` será atualizado sozinho; **suba-o junto** no próximo `git commit`.
4. **Seus temas .css** (importante): os temas que você criou ficavam em
   `%APPDATA%\SonoplastiaPro - IASD\themes`.
   Para abrir essa pasta: aperte `Win + R`, cole `%APPDATA%\SonoplastiaPro - IASD\themes` e Enter.
   **Copie os seus arquivos `.css`** de lá (ignore `tema-oceano.css`, `tema-roxo-neon.css` e `custom.css`, que eram de exemplo)
   para dentro da pasta do projeto: `src\renderer\src\themes\`.
   Pronto: eles viram parte do programa e aparecem em *Configurações → Aparência → Tema*.
   - O nome na lista é o nome do arquivo (`meu-tema.css` → "Meu Tema"). Para escolher outro nome, ponha na 1ª linha do .css: `/* nome: Meu Tema Lindo */`
   - Seu .css deve ser CSS puro (variáveis como `--primary: ...;`). Não use `@apply` nem `@import`.
   - O programa **não cria mais nenhuma pasta de temas** no computador.

## PARTE 2 — Testar (modo desenvolvimento)

Rode `2-ABRIR-DEV.bat` (ou `npm run dev`). Confira:

- [ ] Rodapé mostra data e hora **com segundos**.
- [ ] Em *Configurações → Tema* aparecem **IASD Escuro, IASD Claro e os seus temas**; ao fechar e abrir de novo, **nenhum tema de exemplo reaparece**.
- [ ] Aba **Início → Informativo Mundial das Missões**: só vídeos públicos e já publicados. (Na primeira abertura demora um pouco mais, pois cada vídeo é conferido uma vez; depois fica rápido.)
- [ ] Passe o mouse em um vídeo: aparece um círculo girando e, em alguns segundos, um **clipe de 10 s em loop**. Na 2ª vez em que passar no mesmo vídeo, abre na hora.
- [ ] Clique em **Baixar** num vídeo 4K: em *Qualidade* aparece **2160p 4K** (se o vídeo tiver).
- [ ] **LocalSend → Receber → Iniciar**: abre a **janela preta do LocalSend**. Clique várias vezes seguidas: abre **só uma** janela e **só um** aviso. Em **Enviar**, escolha arquivos e clique Enviar: abre a janela do LocalSend.
- [ ] **Mesa de Som** (veja a PARTE 2-B abaixo).
- [ ] **Biblioteca → Telão → Reproduzir**: no player, `→` avança 10 s, `←` volta 10 s, **clicar com o mouse não pausa**, **Espaço** pausa/continua, o **ícone do programa** aparece (no canto e na barra de título) e a janela **fecha sozinha quando o vídeo termina**.

Se o 4K não aparecer: *Configurações → Motor de download → Atualizar* e abra o vídeo de novo.

### PARTE 2-B — Mesa de Som (equalizador ao vivo)

Ela só aparece **enquanto um vídeo estiver tocando no telão** (Biblioteca → Telão → Reproduzir). Fica na parte de baixo da janela principal, e o operador mexe nela **sem precisar ir ao telão**.

| Controle | O que faz |
|---|---|
| **Normal** | Zera tudo |
| **Tirar Abafado** | Voz mais clara: Grave −4, Médio +5, Agudo +4, Nivelador e Limpar Ruído ligados |
| **Som Muito Baixo** | Boost 180% + Nivelador |
| **Música / Louvor** | Grave +3, Agudo +3 |
| **Graves / Médios / Agudos** | −12 a +12 dB. **Dois cliques** num slider o zera |
| **Boost** | 100% a 250% de volume extra |
| **Limpar Ruído / Chiado** | Corta ronco grave (abaixo de 80 Hz) e chiado agudo (acima de 12 kHz) |
| **Nivelador / Compressor** | Levanta partes baixas e segura picos |

Nada é salvo: quando o vídeo termina (o telão fecha sozinho), você fecha o telão ou troca de arquivo, a mesa **some e volta ao padrão** (0 dB, Boost 100%, tudo desligado).
O volume do player (setas ↑ ↓) continua funcionando e é independente da mesa.
Se aparecer o aviso amarelo *"A mesa de som não está disponível para este arquivo"*, o vídeo toca normalmente, só sem os ajustes.

## PARTE 3 — Gerar o instalador (.exe) e o portátil

1. Dê dois cliques em `3-GERAR-EXE.bat` (ou `npm run dist`). Demora alguns minutos.
2. A pasta `release` abre sozinha com:
   - `SonoplastiaPro-IASD-Setup-1.0.2.exe` → **instalador** (para instalar nos outros PCs; não precisa instalar mais nada).
   - `SonoplastiaPro-IASD-Portable-1.0.2.exe` → **versão portátil** (roda sem instalar).
3. Os temas já vão **dentro** dos dois.

## PARTE 4 — Subir para o GitHub (só na primeira vez)

### 4.1 Criar o repositório
1. Entre em https://github.com (crie a conta se precisar).
2. Clique em **New repository**. Nome: `SonoplastiaPro-IASD`. Marque **Public** (obrigatório: assim o programa nos outros PCs consegue baixar as atualizações sem senha). **Não** marque "Add a README". Clique **Create repository**.

### 4.2 Dizer ao programa qual é o seu repositório
Abra `electron-builder.yml` e troque `SEU_USUARIO` pelo **seu usuário do GitHub** (o que aparece na URL: `github.com/SEU_USUARIO`). Salve.
```
  owner: SEU_USUARIO      ← troque aqui
  repo: SonoplastiaPro-IASD
```

### 4.3 Enviar os arquivos
Instale o **Git** (https://git-scm.com). No terminal do VS Code, dentro da pasta do projeto:
```
git init
git branch -M main
git add .
git commit -m "SonoplastiaPro - IASD 1.0.2"
git remote add origin https://github.com/SEU_USUARIO/SonoplastiaPro-IASD.git
git push -u origin main
```
(troque `SEU_USUARIO`). Na primeira vez o Git pede login do GitHub; entre pelo navegador.

**Qual arquivo subir? A pasta inteira.** O `git add .` já envia tudo o que precisa e **ignora sozinho** o que não deve ir (pelo `.gitignore`):

| Sobe para o GitHub | NÃO sobe (ignorado automaticamente) |
|---|---|
| `src/` (inclui `src/renderer/src/themes/`), `resources/` (changelog.json e `bin/LocalSend-CLI.exe`) | `node_modules/` |
| `build/` (ícones), `scripts/`, `.github/`, `.vscode/` | `out/` e `release/` |
| `package.json`, **`package-lock.json`**, `electron-builder.yml`, `electron.vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`, `components.json` | `resources/bin/ffmpeg.exe` e `resources/bin/yt-dlp.exe` (são grandes; o `npm run setup` baixa de novo) |
| `.gitignore`, `README.md`, este guia, os `.bat` | |

Confira no GitHub (atualize a página): deve aparecer `src`, `resources`, `package.json`… e **não** `node_modules`.

### 4.4 Criar o token (a "senha" para publicar)
1. GitHub → sua foto → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
2. Nome: `sonoplastia`; validade: à sua escolha; marque a caixa **`repo`**. Clique **Generate** e **copie** o token (`ghp_...`). Ele só aparece uma vez.
3. No terminal do VS Code rode (troque pelo seu token):
   ```
   setx GH_TOKEN "ghp_SEU_TOKEN_AQUI"
   ```
4. **Feche e abra de novo o VS Code** (para o Windows reconhecer).
   🔒 Nunca coloque o token em arquivo do projeto nem suba para o GitHub.

## PARTE 5 — Publicar a versão (release)

Antes de **toda** publicação:
1. Aumente `"version"` no `package.json` (ex.: `1.0.2` → `1.0.3`). **Sempre maior que a anterior.**
2. Em `resources/changelog.json`, acrescente no **topo** um bloco com a **mesma versão** e o que mudou (é o texto da tela "O que há de novo"). Exemplo:
   ```json
   {
     "version": "1.0.3",
     "date": "2026-12-01",
     "title": "Pequenos ajustes",
     "items": ["Corrigi tal coisa.", "Melhorei tal outra."]
   }
   ```
3. Rode `4-PUBLICAR-NO-GITHUB.bat` (ou `npm run release`). Ele gera os instaladores e **envia para o GitHub** na aba **Releases**, já publicado.
4. No GitHub → **Releases**, confira que a release `v1.0.3` tem estes arquivos (**todos precisam estar lá**):
   - `SonoplastiaPro-IASD-Setup-1.0.3.exe`
   - `SonoplastiaPro-IASD-Setup-1.0.3.exe.blockmap`
   - `latest.yml`  ← é este que o programa lê para saber que há versão nova
   - `SonoplastiaPro-IASD-Portable-1.0.3.exe`
   ⚠ Não renomeie nem apague nenhum.
5. Guarde também o código no GitHub:
   ```
   git add .
   git commit -m "Versão 1.0.3"
   git push
   ```

> **Primeira publicação:** use a versão que está agora (1.0.2). Instale o `Setup-1.0.2.exe` no seu PC e em outros.

## PARTE 6 — Como a atualização aparece para as pessoas

1. Você publica a `1.0.3` (Parte 5).
2. Quem tem a 1.0.2 abre o programa → em poucos segundos aparece **"Nova atualização disponível — Deseja atualizar agora? [Não] [Sim, atualizar]"**.
3. **Sim**: baixa (barra de progresso), instala por cima, **apaga a versão antiga** e reabre sozinho.
4. Ao abrir, aparece **"✨ O que há de novo"** com o texto do `changelog.json`.
5. **Não**: o aviso fecha e volta na próxima vez que abrir.
(Na versão **portátil** acontece o mesmo, só que o programa troca o próprio arquivo `.exe`.)

**Teste recomendado:** instale a 1.0.2, publique a 1.0.3 e abra a 1.0.2 instalada.

## Problemas comuns
- **"Nenhuma versão publicada no GitHub ainda"** → ainda não rodou o `4-PUBLICAR`, ou o `owner` no `electron-builder.yml` está errado, ou o repositório é privado.
- **`GH_TOKEN` não definido** → refaça o 4.4 e reabra o VS Code.
- **SmartScreen ("O Windows protegeu o computador")** → normal, pois o programa não tem certificado pago. *Mais informações → Executar assim mesmo*.
- **Vídeo não baixa / pede login** → *Configurações → Motor de download → Atualizar*.
- **Busca por voz** → instale Português (Brasil) com reconhecimento de fala (*Configurações do Windows → Hora e idioma → Fala*) e libere o microfone.
