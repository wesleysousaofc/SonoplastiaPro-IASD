import { useEffect, useState } from "react";
import {
  Cpu,
  FolderOpen,
  Palette,
  RefreshCw,
  Wrench,
  Monitor,
} from "lucide-react";
import type { HardwareInfo } from "@shared/types";
import { api, patchSettings, pushToast } from "@/lib/actions";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EMBEDDED_THEMES } from "@/lib/themes";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="spa-card glass mb-5 rounded-3xl p-5">
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-bold [&_svg]:size-[18px] [&_svg]:text-primary">
        {icon} {title}
      </h2>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}
function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const CREDITS: [string, string][] = [
  ["Desenvolvimento, interface e coordenação", "Wesley Sousa"],
  ["Equipe de Sonoplastia", "Davison Carvalho · Luiz Machado"],
  [
    "Igreja Central de Cachoeira do Piriá",
    "Equipe de Multimídia e voluntários que testaram o programa",
  ],
];

export function SettingsPage(): JSX.Element {
  const s = useApp((x) => x.settings);
  const version = useApp((x) => x.version);
  const ytdlp = useApp((x) => x.ytdlpVersion);
  const portable = useApp((x) => x.portable);
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.system.hardware().then(setHw);
  }, []);

  const updateEngine = async (): Promise<void> => {
    setBusy(true);
    try {
      pushToast({
        kind: "info",
        title: "Motor de download",
        message: await api.ytdlp.update(),
      });
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Falha ao atualizar o motor",
        message: (e as Error).message,
      });
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-12 pt-2">
      <h1 className="mb-5 text-xl font-bold">Configurações</h1>

      <Section icon={<Palette />} title="Aparência">
        <Row title="Tema" hint="Escolha um tema que mais lhe agradar.">
          <Select
            className="w-56"
            value={s.theme}
            onChange={(e) => void patchSettings({ theme: e.target.value })}
          >
            <option value="iasd-escuro">IASD Escuro</option>
            <option value="iasd-claro">IASD Claro</option>
            {EMBEDDED_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Row>
      </Section>

      <Section icon={<Cpu />} title="Desempenho e avisos">
        <Row
          title="⚡ Modo Leve"
          hint="Para PCs fracos: sem prévia em vídeo, sem blur/animações, 1 download por vez e menos consultas."
        >
          <Switch
            checked={s.lightMode}
            onCheckedChange={(v) => void patchSettings({ lightMode: v })}
          />
        </Row>
        <Row
          title="Prévia ao passar o mouse"
          hint="Toca um trecho do vídeo na miniatura (desligado no Modo Leve)."
        >
          <Switch
            checked={s.hoverPreview}
            onCheckedChange={(v) => void patchSettings({ hoverPreview: v })}
          />
        </Row>
        <Row title="Downloads ao mesmo tempo">
          <Select
            className="w-28"
            value={s.maxConcurrent}
            onChange={(e) =>
              void patchSettings({ maxConcurrent: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Row>
        <Row title="🔔 Sons de notificação">
          <Switch
            checked={s.sounds}
            onCheckedChange={(v) => void patchSettings({ sounds: v })}
          />
        </Row>
        <Row
          title="Notificações do Windows"
          hint="Avisa mesmo com o programa minimizado."
        >
          <Switch
            checked={s.desktopNotifications}
            onCheckedChange={(v) =>
              void patchSettings({ desktopNotifications: v })
            }
          />
        </Row>
      </Section>

      <Section icon={<FolderOpen />} title="Downloads">
        <Row title="Pasta padrão" hint={s.downloadDir}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const p = await api.dialog.pickFolder(s.downloadDir);
              if (p) void patchSettings({ downloadDir: p });
            }}
          >
            Escolher…
          </Button>
        </Row>
      </Section>

      <Section icon={<RefreshCw />} title="Atualizações">
        <Row
          title={`SonoplastiaPro - IASD ${version}`}
          hint={
            portable
              ? "Versão portátil: a atualização troca o próprio arquivo .exe."
              : "Ao abrir, o programa procura versões novas automaticamente."
          }
        >
          <Button size="sm" onClick={() => void api.update.check(true)}>
            Verificar agora
          </Button>
        </Row>
        <Row
          title={`Motor de download (yt-dlp ${ytdlp || "—"})`}
          hint="Se um vídeo não baixar, atualize o motor."
        >
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void updateEngine()}
          >
            <RefreshCw className={busy ? "animate-spin" : ""} /> Atualizar
          </Button>
        </Row>
      </Section>

      <Section icon={<Wrench />} title="Sistema">
        {hw ? (
          <div className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 py-3 text-sm">
            {(
              [
                ["Dispositivo", hw.device],
                ["Processador", hw.cpu],
                ["Memória RAM", hw.ram],
                ["Placa gráfica", hw.gpu],
                ["Armazenamento", hw.disk],
                ["Sistema", hw.os],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <span className="text-muted-foreground">{k}</span>
                <span className="break-words">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            Coletando informações…
          </p>
        )}
        <Row title="Manutenção">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api.app.clearCache();
                pushToast({
                  kind: "success",
                  title: "Cache limpo",
                  message: "Os arquivos temporários foram removidos.",
                });
              }}
            >
              Limpar cache
            </Button>
          </div>
        </Row>
      </Section>

      <section className="spa-card glass rounded-3xl p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Monitor
            size={22}
            strokeWidth={2.5}
            className="text-primary shrink-0"
          />

          <p className="text-brand text-lg font-extrabold">
            SonoplastiaPro - IASD
          </p>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Uma central prática para encontrar vídeos, acompanhar canais e
          preparar downloads em um só lugar.
        </p>

        <div className="mt-5 space-y-3">
          {CREDITS.map(([t, n]) => (
            <div key={t}>
              <p className="text-xs font-semibold text-primary">{t}</p>
              <p className="text-sm">{n}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm italic text-muted-foreground">
          “Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor.” —
          Colossenses 3:23 🙏
        </p>
      </section>
    </div>
  );
}
