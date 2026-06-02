import { useEffect, useMemo, useRef, useState } from "react";
import {
  Paperclip,
  Sparkles,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from "lucide-react";

export interface MentionUser {
  id: string;
  display_name: string | null;
  email: string;
  handle: string; // lowercased name for @-matching
}

export interface ChatAttachment {
  path: string; // storage object key
  name: string; // original file name
  size: number; // bytes
  type: string; // mime type
}

export type UploadProgressFn = (ratio: number) => void;

interface Props {
  channelName: string;
  disabled?: boolean;
  members: MentionUser[];
  onSend: (text: string, mentions: string[], attachments: ChatAttachment[]) => Promise<void> | void;
  onUpload?: (file: File, onProgress: UploadProgressFn) => Promise<ChatAttachment>;
  onTyping?: () => void;
  onSummarize?: () => void;
  summarizing?: boolean;
}

const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250 MB
const MAX_ATTACHMENTS = 5;

type PendingStatus = "uploading" | "done" | "error";

interface PendingItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: PendingStatus;
  progress: number; // 0..1
  attachment?: ChatAttachment;
  error?: string;
}

interface MentionState {
  open: boolean;
  query: string;
  start: number;
  index: number;
}

const initialMention: MentionState = { open: false, query: "", start: -1, index: 0 };

function fileKind(type: string): "image" | "video" | "doc" {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "doc";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const MessageInput = ({
  channelName,
  disabled,
  members,
  onSend,
  onUpload,
  onTyping,
  onSummarize,
  summarizing,
}: Props) => {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<MentionState>(initialMention);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  const suggestions = useMemo(() => {
    if (!mention.open) return [];
    const q = mention.query.toLowerCase();
    return members
      .filter((m) => !q || m.handle.includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, mention]);

  useEffect(() => {
    if (mention.open && mention.index >= suggestions.length) {
      setMention((s) => ({ ...s, index: 0 }));
    }
  }, [suggestions.length, mention.open, mention.index]);

  function detectMention(value: string, caret: number) {
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const prev = value[i - 1];
        if (i === 0 || prev === " " || prev === "\n" || prev === "\t") {
          const query = value.slice(i + 1, caret);
          if (/^[a-zA-Z0-9_.-]*$/.test(query)) {
            setMention({ open: true, query, start: i, index: 0 });
            return;
          }
        }
        break;
      }
      if (ch === " " || ch === "\n" || ch === "\t") break;
      i--;
    }
    setMention(initialMention);
  }

  function insertMention(user: MentionUser) {
    if (mention.start < 0) return;
    const before = text.slice(0, mention.start);
    const caret = taRef.current?.selectionStart ?? text.length;
    const after = text.slice(caret);
    const tag = `@${user.handle} `;
    const next = before + tag + after;
    setText(next);
    setMention(initialMention);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = (before + tag).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function extractMentions(value: string): string[] {
    const ids = new Set<string>();
    const handles = new Map(members.map((m) => [m.handle, m.id]));
    const re = /(?:^|\s)@([a-zA-Z0-9_.-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      const id = handles.get(m[1].toLowerCase());
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }

  const uploadingCount = pending.filter((p) => p.status === "uploading").length;
  const errorCount = pending.filter((p) => p.status === "error").length;
  const doneItems = pending.filter((p) => p.status === "done");

  async function send() {
    const t = text.trim();
    if ((!t && doneItems.length === 0) || disabled) return;
    if (uploadingCount > 0) return;
    if (errorCount > 0) return;
    const mentions = extractMentions(t);
    const atts = doneItems.map((p) => p.attachment!).filter(Boolean);
    setText("");
    setPending([]);
    setMention(initialMention);
    await onSend(t, mentions, atts);
  }

  function patchItem(id: string, patch: Partial<PendingItem>) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function runUpload(item: PendingItem) {
    if (!onUpload) return;
    patchItem(item.id, { status: "uploading", progress: 0, error: undefined });
    try {
      const att = await onUpload(item.file, (ratio) => {
        patchItem(item.id, { progress: Math.max(0, Math.min(1, ratio)) });
      });
      patchItem(item.id, { status: "done", progress: 1, attachment: att });
    } catch (err: any) {
      const msg = err?.message ?? "Upload failed";
      patchItem(item.id, { status: "error", error: msg });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !onUpload) return;
    const arr = Array.from(files);
    const queued: PendingItem[] = [];
    for (const f of arr) {
      if (pending.length + queued.length >= MAX_ATTACHMENTS) break;
      if (f.size > MAX_FILE_BYTES) {
        // eslint-disable-next-line no-console
        console.warn(`Skipping ${f.name}: exceeds 250 MB`);
        continue;
      }
      queued.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        status: "uploading",
        progress: 0,
      });
    }
    if (queued.length === 0) return;
    setPending((prev) => [...prev, ...queued]);
    // Upload in parallel
    await Promise.all(queued.map((q) => runUpload(q)));
  }

  function retry(id: string) {
    const item = pending.find((p) => p.id === id);
    if (!item) return;
    void runUpload(item);
  }

  function removeItem(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((s) => ({ ...s, index: (s.index + 1) % suggestions.length }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((s) => ({
          ...s,
          index: (s.index - 1 + suggestions.length) % suggestions.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[mention.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(initialMention);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      className="px-4 py-3 relative"
      style={{
        borderTop: "1px solid var(--border-glass)",
        background: "rgba(2,2,10,0.55)",
      }}
    >
      {mention.open && suggestions.length > 0 && (
        <div
          className="absolute z-20"
          style={{ left: 16, right: 16, bottom: "100%", marginBottom: 6, maxWidth: 320 }}
        >
          <div
            className="rounded-[10px] overflow-hidden"
            style={{
              background: "rgba(10,10,20,0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--border-glass-hover)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="t-mono px-3 py-1.5"
              style={{ fontSize: 9, borderBottom: "1px solid var(--border-glass)" }}
            >
              People · ↑↓ navigate · ↵ insert
            </div>
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                onMouseEnter={() => setMention((s) => ({ ...s, index: i }))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                style={{
                  background: i === mention.index ? "var(--bg-glass-active)" : "transparent",
                  borderLeft:
                    i === mention.index
                      ? "2px solid var(--primary-bright)"
                      : "2px solid transparent",
                }}
              >
                <div
                  className="flex items-center justify-center font-display"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "rgba(96,165,250,0.15)",
                    color: "#60A5FA",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {(u.display_name ?? u.email)
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    @{u.handle}
                  </div>
                  <div className="t-mono truncate" style={{ fontSize: 9 }}>
                    {u.display_name ?? u.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div
          className="flex flex-col gap-1.5 mb-2 p-2 rounded-[10px]"
          style={{
            background: "var(--bg-glass-1)",
            border: "1px solid var(--border-glass)",
          }}
        >
          {pending.map((p) => {
            const kind = fileKind(p.type);
            const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : FileText;
            const pct = Math.round(p.progress * 100);
            const statusColor =
              p.status === "error"
                ? "#F87171"
                : p.status === "done"
                  ? "#34D399"
                  : "#60A5FA";
            const barColor =
              p.status === "error"
                ? "rgba(248,113,113,0.85)"
                : p.status === "done"
                  ? "rgba(52,211,153,0.85)"
                  : "rgba(96,165,250,0.85)";
            const barBg =
              p.status === "error"
                ? "rgba(248,113,113,0.15)"
                : p.status === "done"
                  ? "rgba(52,211,153,0.15)"
                  : "rgba(96,165,250,0.15)";

            return (
              <div
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-[8px]"
                style={{
                  background: barBg,
                  border: `1px solid ${statusColor}55`,
                }}
              >
                <Icon size={13} strokeWidth={1.5} style={{ color: statusColor, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate"
                      style={{
                        color: "var(--text-primary)",
                        fontSize: 11,
                        fontFamily: "var(--font-body)",
                      }}
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    <span
                      className="t-mono"
                      style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}
                    >
                      {formatBytes(p.size)}
                    </span>
                  </div>
                  <div
                    className="mt-1 relative overflow-hidden rounded-full"
                    style={{
                      height: 3,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${p.status === "error" ? 100 : pct}%`,
                        background: barColor,
                        transition: "width 150ms linear",
                      }}
                    />
                  </div>
                  <div
                    className="t-mono mt-0.5 flex items-center gap-1.5"
                    style={{ fontSize: 9, color: statusColor }}
                  >
                    {p.status === "uploading" && (
                      <>
                        <Loader2 size={9} className="animate-spin" />
                        <span>Uploading… {pct}%</span>
                      </>
                    )}
                    {p.status === "done" && (
                      <>
                        <CheckCircle2 size={9} strokeWidth={2} />
                        <span>Ready</span>
                      </>
                    )}
                    {p.status === "error" && (
                      <>
                        <AlertTriangle size={9} strokeWidth={2} />
                        <span className="truncate">{p.error ?? "Failed"}</span>
                      </>
                    )}
                  </div>
                </div>
                {p.status === "error" && (
                  <button
                    onClick={() => retry(p.id)}
                    title="Retry upload"
                    className="flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      color: "#F87171",
                      background: "rgba(248,113,113,0.10)",
                      flexShrink: 0,
                    }}
                  >
                    <RotateCw size={11} strokeWidth={1.8} />
                  </button>
                )}
                <button
                  onClick={() => removeItem(p.id)}
                  title="Remove"
                  className="flex items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  <X size={11} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className="flex items-end gap-2 p-2 rounded-[12px]"
        style={{
          background: "var(--bg-glass-1)",
          border: "1px solid var(--border-glass)",
        }}
      >
        <button
          className="btn-icon"
          style={{ width: 32, height: 32, flexShrink: 0 }}
          title="Attach files"
          disabled={disabled || !onUpload || pending.length >= MAX_ATTACHMENTS}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={14} strokeWidth={1.5} />
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            onTyping?.();
            const caret = e.target.selectionStart ?? v.length;
            detectMention(v, caret);
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onClick={(e) => {
            const el = e.currentTarget;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onBlur={() => setTimeout(() => setMention(initialMention), 120)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Read-only channel" : `Message #${channelName}…`}
          rows={1}
          disabled={disabled}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "none",
            padding: "6px 4px",
            maxHeight: 140,
          }}
        />
        <button
          className="btn-icon"
          style={{ width: 32, height: 32, flexShrink: 0 }}
          onClick={onSummarize}
          disabled={summarizing}
          title="AI summarize this channel"
        >
          <Sparkles
            size={14}
            strokeWidth={1.5}
            style={{ color: summarizing ? "var(--text-muted)" : "#60A5FA" }}
          />
        </button>
        <button
          onClick={() => void send()}
          disabled={
            disabled ||
            uploadingCount > 0 ||
            errorCount > 0 ||
            (!text.trim() && doneItems.length === 0)
          }
          className="btn-primary"
          style={{ height: 32, padding: "0 12px", flexShrink: 0 }}
          title={
            uploadingCount > 0
              ? "Waiting for uploads to finish"
              : errorCount > 0
                ? "Resolve failed uploads first"
                : "Send"
          }
        >
          <Send size={12} strokeWidth={2} />
        </button>
      </div>
      <div className="t-mono mt-1 flex items-center gap-2" style={{ fontSize: 9, paddingLeft: 4 }}>
        <span>Enter to send · Shift+Enter newline · @mention · /todo /meeting · ✦ summarize</span>
        {uploadingCount > 0 && (
          <span style={{ color: "#60A5FA" }}>
            · Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
          </span>
        )}
        {errorCount > 0 && (
          <span style={{ color: "#F87171" }}>
            · {errorCount} failed — retry to continue
          </span>
        )}
      </div>
    </div>
  );
};
