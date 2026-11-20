import { useEffect, useMemo, useRef, useState } from "react";
import { History, Mic, Search, X } from "lucide-react";
import { api, clearSearch, patchSettings, runSearch } from "@/lib/actions";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VoiceOverlay, type VoiceUi } from "./VoiceOverlay";

interface Row {
  text: string;
  history: boolean;
}

/** Barra de pesquisa no estilo do YouTube: pílula, sugestões do próprio YouTube, histórico, setas/Enter/Esc e botão de voz. */
export function SearchBar(): JSX.Element {
  const query = useApp((s) => s.query);
  const history = useApp((s) => s.settings.searchHistory);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [voice, setVoice] = useState<VoiceUi>({
    open: false,
    listening: false,
  });
  const input = useRef<HTMLInputElement>(null);
  const voiceToken = useRef(0);

  useEffect(() => setText(query), [query]);

  useEffect(() => {
    const q = text.trim();
    if (!q) return setRemote([]);
    let cancelled = false;
    const t = window.setTimeout(() => {
      api.search
        .suggest(q)
        .then((r) => !cancelled && setRemote(r))
        .catch(() => undefined);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [text]);

  // atalho "/" foca a pesquisa (como no YouTube)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (
        e.key === "/" &&
        tag !== "input" &&
        tag !== "textarea" &&
        tag !== "select"
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows: Row[] = useMemo(() => {
    const q = text.trim().toLowerCase();
    const hist = (
      q ? history.filter((h) => h.toLowerCase().includes(q)) : history
    )
      .slice(0, q ? 3 : 8)
      .map((t) => ({ text: t, history: true }));
    const sug = remote
      .filter(
        (r) => !hist.some((h) => h.text.toLowerCase() === r.toLowerCase()),
      )
      .map((t) => ({ text: t, history: false }));
    return [...hist, ...sug].slice(0, 9);
  }, [text, history, remote]);

  const submit = (value: string): void => {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    void runSearch(value);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!rows.length) return;
      setOpen(true);
      setActive(
        (a) =>
          (a + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(active >= 0 && rows[active] ? rows[active].text : text);
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  };

  const listen = async (): Promise<void> => {
    const token = ++voiceToken.current;
    setVoice({ open: true, listening: true });
    try {
      const r = await api.voice.listen();
      if (token !== voiceToken.current) return;
      if (r.status === "ok" && r.text) {
        setVoice({ open: false, listening: false });
        setText(r.text);
        void runSearch(r.text);
      } else
        setVoice({
          open: true,
          listening: false,
          status: r.status,
          detail: r.text,
        });
    } catch (e) {
      if (token === voiceToken.current)
        setVoice({
          open: true,
          listening: false,
          status: "error",
          detail: (e as Error).message,
        });
    }
  };
  const closeVoice = (): void => {
    voiceToken.current++;
    setVoice({ open: false, listening: false });
  };

  return (
    <div className="spa-search relative flex items-center gap-2.5">
      <div className="relative flex h-11 flex-1 items-center rounded-full border bg-input/80 pl-5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        <input
          ref={input}
          value={text}
          spellCheck={false}
          placeholder="Pesquisar no YouTube"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {text && (
          <button
            className="mr-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-accent"
            title="Limpar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText("");
              clearSearch();
              input.current?.focus();
            }}
          >
            <X className="size-4" />
          </button>
        )}
        <button
          className="grid h-full w-14 place-items-center rounded-r-full border-l bg-secondary/70 text-foreground hover:bg-secondary"
          title="Pesquisar"
          onClick={() => submit(text)}
        >
          <Search className="size-[18px]" />
        </button>

        {open && rows.length > 0 && (
          <div className="glass absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl p-1.5 shadow-2xl">
            {!text.trim() && (
              <p className="px-3 pb-1 pt-1.5 text-xs text-muted-foreground">
                Pesquisas recentes
              </p>
            )}
            {rows.map((r, i) => (
              <div
                key={r.text + i}
                className={cn(
                  "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm",
                  i === active ? "bg-accent" : "hover:bg-accent/70",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => submit(r.text)}
              >
                {r.history ? (
                  <History className="size-4 text-muted-foreground" />
                ) : (
                  <Search className="size-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{r.text}</span>
                {r.history && (
                  <button
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                    title="Remover do histórico"
                    onClick={(e) => {
                      e.stopPropagation();
                      void patchSettings({
                        searchHistory: history.filter((h) => h !== r.text),
                      });
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        title="Pesquisar por voz"
        onClick={() => void listen()}
      >
        <Mic className="size-5" />
      </button>
      <VoiceOverlay
        ui={voice}
        onClose={closeVoice}
        onRetry={() => void listen()}
      />
    </div>
  );
}
