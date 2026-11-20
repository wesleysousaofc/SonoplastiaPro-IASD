import { Copy, Minus, Square, X, Zap } from "lucide-react";
import { api, patchSettings } from "@/lib/actions";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";

export function Header(): JSX.Element {
  const light = useApp((s) => s.settings.lightMode);
  const maximized = useApp((s) => s.maximized);
  return (
    <header className="spa-titlebar drag flex h-16 shrink-0 items-center gap-4 px-4">
      <div className="flex w-[200px] items-center gap-2.5">
        <Logo />
        <span className="text-[15px] font-bold leading-tight tracking-tight">
          SonoplastiaPro
          <span className="text-brand block text-[9px] font-semibold">
            IGREJA ADVENTISTA DO SÉTIMO DIA
          </span>
        </span>
      </div>
      <div className="no-drag mx-auto w-full max-w-2xl">
        <SearchBar />
      </div>
      <div className="no-drag flex items-center gap-1.5">
        <button
          title="Modo Leve: desliga prévias, blur e animações para PCs fracos"
          onClick={() => void patchSettings({ lightMode: !light })}
          className={cn(
            "mr-2 flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
            light
              ? "border-transparent bg-brand text-white"
              : "bg-secondary/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap className="size-3.5" /> Modo Leve{" "}
          {light ? "ligado" : "desligado"}
        </button>
        <button
          className="grid size-9 place-items-center rounded-full hover:bg-accent"
          title="Minimizar"
          onClick={() => api.win.minimize()}
        >
          <Minus className="size-4" />
        </button>
        <button
          className="grid size-9 place-items-center rounded-full hover:bg-accent"
          title={maximized ? "Restaurar" : "Maximizar"}
          onClick={() => api.win.toggleMaximize()}
        >
          {maximized ? (
            <Copy className="size-3.5" />
          ) : (
            <Square className="size-3.5" />
          )}
        </button>
        <button
          className="grid size-9 place-items-center rounded-full hover:bg-destructive hover:text-white"
          title="Fechar"
          onClick={() => api.win.close()}
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
