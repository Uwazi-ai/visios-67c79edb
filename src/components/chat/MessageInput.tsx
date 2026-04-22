import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles, Send } from "lucide-react";

interface Props {
  channelName: string;
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
  onTyping?: () => void;
  onSummarize?: () => void;
  summarizing?: boolean;
}

export const MessageInput = ({
  channelName,
  disabled,
  onSend,
  onTyping,
  onSummarize,
  summarizing,
}: Props) => {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  async function send() {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    await onSend(t);
  }

  return (
    <div
      className="px-4 py-3"
      style={{
        borderTop: "1px solid var(--border-glass)",
        background: "rgba(2,2,10,0.55)",
      }}
    >
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
          title="Attach (coming soon)"
          disabled
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
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
          disabled={disabled || !text.trim()}
          className="btn-primary"
          style={{ height: 32, padding: "0 12px", flexShrink: 0 }}
        >
          <Send size={12} strokeWidth={2} />
        </button>
      </div>
      <div className="t-mono mt-1" style={{ fontSize: 9, paddingLeft: 4 }}>
        Enter to send · Shift+Enter newline · /todo /meeting · ✦ summarize
      </div>
    </div>
  );
};
