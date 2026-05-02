import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingTextProps {
  text: string;
  streaming: boolean;
}

// Convert Vision citation tokens like [gmail:ID|label] into clickable markdown links.
function transformCitations(input: string): string {
  return input.replace(/\[(gmail|drive|kb|slack|task|jira):([^|\]]+)(?:\|([^\]]+))?\]/g, (_m, kind, id, label) => {
    const text = (label || id).trim();
    switch (kind) {
      case "gmail":
        return `[📧 ${text}](https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(id)})`;
      case "drive":
        return `[📁 ${text}](https://drive.google.com/file/d/${encodeURIComponent(id)}/view)`;
      case "kb":
        return `[📚 ${text}](/knowledge?doc=${encodeURIComponent(id)})`;
      case "slack":
        return `**💬 #${text}**`;
      case "task":
        return `**✅ ${text}**`;
      case "jira":
        return `**🎫 ${text}**`;
      default:
        return text;
    }
  });
}

export const StreamingText = memo(({ text, streaming }: StreamingTextProps) => {
  const transformed = useMemo(() => streaming ? text : transformCitations(text || ""), [text, streaming]);
  if (streaming) {
    return (
      <div className="vision-prose">
        <span style={{ whiteSpace: "pre-wrap" }}>{transformed}</span>
        <span className="streaming-cursor" />
      </div>
    );
  }
  return (
    <div className="vision-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("/") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="vision-citation-chip"
            >
              {children}
            </a>
          ),
        }}
      >
        {transformed}
      </ReactMarkdown>
    </div>
  );
});
StreamingText.displayName = "StreamingText";
