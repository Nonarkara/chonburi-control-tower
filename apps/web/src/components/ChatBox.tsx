import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { safeUrl } from "../lib/safeUrl";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface Props {
  apiBase: string;
}

const SUGGESTED_PROMPTS = [
  "What's the current PM2.5 in Chonburi and what should the municipality advise residents?",
  "Summarise Chonburi's EEC position in 4 bullets.",
  "Which open datasets matter most for Chonburi municipal operations?",
  "How bad is traffic on Sukhumvit Rd through Chonburi at 8:30 am?",
  "What flood risks does Chonburi face and how are other coastal cities managing them?",
  "Where can I find live CCTV feeds near the Chonburi town hall?",
];

const STORAGE_KEY = "chonburi:chat-history-v1";
const MAX_HISTORY_TURNS = 16;

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_HISTORY_TURNS);
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_HISTORY_TURNS)),
    );
  } catch {}
}

/**
 * Render a tiny safe subset of markdown:
 *   **bold**, [text](url), single-line newlines, "- " bullets.
 * Everything HTML-unsafe is escaped first. URLs validated through safeUrl().
 */
function renderMarkdownLite(src: string): React.ReactNode {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tokenise the line into spans of bold/link/text.
  const tokenize = (line: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let rest = line;
    let key = 0;
    // Combined regex: link OR bold
    const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/;
    while (rest.length) {
      const m = re.exec(rest);
      if (!m) {
        out.push(<span key={key++} dangerouslySetInnerHTML={{ __html: esc(rest) }} />);
        break;
      }
      if (m.index > 0) {
        out.push(
          <span key={key++} dangerouslySetInnerHTML={{ __html: esc(rest.slice(0, m.index)) }} />,
        );
      }
      if (m[1] && m[2]) {
        const safe = safeUrl(m[2]);
        if (safe) {
          out.push(
            <a key={key++} href={safe} target="_blank" rel="noopener noreferrer">
              {m[1]}
            </a>,
          );
        } else {
          out.push(<span key={key++}>{m[1]}</span>);
        }
      } else if (m[3]) {
        out.push(<strong key={key++}>{m[3]}</strong>);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    return out;
  };

  const lines = src.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bullets.map((b, i) => (
          <li key={i}>{tokenize(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-•]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-•]\s+/, ""));
    } else if (line === "") {
      flushBullets();
      blocks.push(<div key={`sp-${i}`} className="chat-sp" />);
    } else {
      flushBullets();
      blocks.push(<p key={`p-${i}`}>{tokenize(line)}</p>);
    }
  });
  flushBullets();
  return blocks;
}

export function ChatBox({ apiBase }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveHistory(messages), [messages]);

  // Auto-scroll on new message / streaming reply
  useEffect(() => {
    if (!open) return;
    const t = transcriptRef.current;
    if (t) t.scrollTop = t.scrollHeight;
  }, [messages, busy, open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      setError(null);
      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user" as const, content: text },
      ];
      setMessages(newMessages);
      setInput("");
      setBusy(true);

      const ctrl = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`${apiBase}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: newMessages.slice(-MAX_HISTORY_TURNS) }),
          signal: ctrl.signal,
        });
        const json = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !json.reply) {
          setError(json.error ?? `Request failed (${res.status})`);
          return;
        }
        setMessages((prev) => [...prev, { role: "model", content: json.reply ?? "" }]);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Network error — try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [apiBase, busy, messages],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      send(input);
    },
    [input, send],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setBusy(false);
  }, []);

  const turnCount = useMemo(() => messages.length, [messages]);

  return (
    <div className={`chatbox ${open ? "chatbox-open" : "chatbox-closed"}`}>
      {!open && (
        <button
          type="button"
          className="chat-handle"
          onClick={() => setOpen(true)}
          aria-label="Open concierge chat"
        >
          <span className="chat-handle-dot" />
          <span className="chat-handle-label">
            <strong>Ask CTM</strong>
            <span className="mono">
              Concierge for Chonburi · EEC · municipal ops · data
            </span>
          </span>
          <span className="chat-handle-cta mono">[ASK →]</span>
        </button>
      )}

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Concierge chat">
          <header className="chat-head">
            <div className="col">
              <span className="eyebrow mono">CTM-Concierge · Gemini 2.5 Flash</span>
              <h2 className="chat-title">Ask anything about Chonburi</h2>
            </div>
            <div className="chat-head-tools">
              {turnCount > 0 && (
                <button onClick={clear} className="mono chat-clear" aria-label="Clear conversation">
                  CLEAR
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="mono chat-close"
                aria-label="Close chat"
              >
                [ESC] CLOSE
              </button>
            </div>
          </header>

          <div ref={transcriptRef} className="chat-transcript">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p className="chat-empty-lede">
                  Live link to a municipal briefer. Free-tier model — clear,
                  factual, no fluff. Try one of these or type your own:
                </p>
                <div className="chat-suggestions">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="chat-suggestion"
                      onClick={() => send(p)}
                      disabled={busy}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                <span className="chat-msg-role mono">
                  {m.role === "user" ? "YOU" : "CTM"}
                </span>
                <div className="chat-msg-body">
                  {m.role === "model" ? renderMarkdownLite(m.content) : <p>{m.content}</p>}
                </div>
              </div>
            ))}

            {busy && (
              <div className="chat-msg chat-msg-model chat-msg-busy">
                <span className="chat-msg-role mono">CTM</span>
                <div className="chat-msg-body">
                  <span className="chat-typing">
                    <span /><span /><span />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="chat-error mono" role="alert">
                {error}
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Chonburi traffic, EEC, air quality, municipal data…"
              maxLength={1200}
              disabled={busy}
              aria-label="Your message"
              autoFocus
            />
            <button type="submit" className="mono" disabled={busy || !input.trim()}>
              {busy ? "…" : "SEND"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
