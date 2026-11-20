import {
  ArrowDownToLine,
  Home,
  Library,
  RefreshCw,
  Settings,
  Share2,
} from "lucide-react";
import { api, go } from "@/lib/actions";
import { useApp, type Page } from "@/lib/store";
import { cn } from "@/lib/utils";

const ITEMS: { key: Page; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Início", icon: Home },
  { key: "downloads", label: "Downloads", icon: ArrowDownToLine },
  { key: "library", label: "Biblioteca", icon: Library },
  { key: "localsend", label: "LocalSend", icon: Share2 },
  { key: "settings", label: "Configurações", icon: Settings },
];

export function Sidebar(): JSX.Element {
  const page = useApp((s) => s.page);
  const downloads = useApp((s) => s.downloads);
  const version = useApp((s) => s.version);
  const update = useApp((s) => s.update);
  const active = downloads.filter(
    (d) =>
      d.status === "downloading" ||
      d.status === "processing" ||
      d.status === "queued",
  ).length;
  return (
    <nav className="spa-sidebar flex w-[212px] shrink-0 flex-col gap-1 px-3 pb-3 pt-1">
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={cn(
            "flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors",
            page === key
              ? "bg-brand text-white shadow-lg"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="size-[18px]" />
          <span className="flex-1 text-left">{label}</span>
          {key === "downloads" && active > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-emerald-700">
              {active}
            </span>
          )}
        </button>
      ))}
      <div className="flex-1" />
      {update.phase === "available" && (
        <button
          className="mb-2 flex items-center gap-2 rounded-2xl bg-primary/15 px-3 py-2.5 text-left text-xs font-semibold text-primary"
          onClick={() => void api.update.check(true)}
        >
          <RefreshCw className="size-4" /> Nova versão {update.version}{" "}
          disponível
        </button>
      )}
      <p className="px-3 text-xs text-muted-foreground">
        🎧 SonoplastiaPro · v{version}
      </p>
    </nav>
  );
}
