import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingTextProps {
  text: string;
  streaming: boolean;
}

// Renders markdown for completed text; while streaming we render raw with cursor for snappier UX.
export const StreamingText = memo(({ text, streaming }: StreamingTextProps) => {
  if (streaming) {
    return (
      <div className="vision-prose">
        <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
        <span className="streaming-cursor" />
      </div>
    );
  }
  return (
    <div className="vision-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ""}</ReactMarkdown>
    </div>
  );
});
StreamingText.displayName = "StreamingText";
