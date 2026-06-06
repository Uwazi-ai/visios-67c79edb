import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Section {
  title: string;
  lines: string[];
}

function parseMarkdown(content: string): { intro: string[]; sections: Section[] } {
  const lines = content.split("\n");
  const intro: string[] = [];
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: sectionMatch[1].trim(), lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (currentSection) sections.push(currentSection);

  return { intro, sections };
}

function formatLine(line: string) {
  // Handle bold
  const boldRe = /\*\*(.+?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = boldRe.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <strong key={key++} style={{ color: "var(--text-primary)", fontWeight: 700 }}>
        {match[1]}
      </strong>
    );
    lastIndex = boldRe.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(<span key={key++}>{line.slice(lastIndex)}</span>);
  }
  return parts.length ? parts : line;
}

function IntroBlock({ lines }: { lines: string[] }) {
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  if (nonEmpty.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      {nonEmpty.map((line, i) => {
        const h1Match = line.match(/^#\s+(.+)$/);
        if (h1Match) {
          return (
            <div
              key={i}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--text-primary)",
                marginBottom: 4,
                lineHeight: 1.3,
              }}
            >
              {h1Match[1]}
            </div>
          );
        }
        return (
          <div
            key={i}
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              marginBottom: 2,
            }}
          >
            {formatLine(line)}
          </div>
        );
      })}
    </div>
  );
}

function SectionBody({ lines }: { lines: string[] }) {
  const items: React.ReactNode[] = [];
  let currentList: string[] = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length === 0) return;
    items.push(
      <ul key={key++} style={{ margin: "4px 0", paddingLeft: 16, listStyle: "none" }}>
        {currentList.map((item, idx) => (
          <li
            key={idx}
            style={{
              position: "relative",
              paddingLeft: 12,
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 7,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--text-muted)",
              }}
            />
            {formatLine(item)}
          </li>
        ))}
      </ul>
    );
    currentList = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushList();
      continue;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      currentList.push(listMatch[1]);
    } else {
      flushList();
      items.push(
        <div
          key={key++}
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            marginBottom: 2,
          }}
        >
          {formatLine(trimmed)}
        </div>
      );
    }
  }
  flushList();

  return <>{items}</>;
}

function CollapsibleSection({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border-glass)",
        background: "var(--bg-glass-1)",
        overflow: "hidden",
        marginBottom: 6,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "inline-flex", color: "var(--text-muted)", flexShrink: 0 }}
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </motion.span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 12,
            color: "var(--text-primary)",
            flex: 1,
          }}
        >
          {title}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 pt-0">
              <SectionBody lines={lines} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BotMessageContent({ content }: { content: string }) {
  const { intro, sections } = parseMarkdown(content);

  return (
    <div style={{ maxWidth: 480 }}>
      <IntroBlock lines={intro} />
      {sections.map((s, i) => (
        <CollapsibleSection key={i} title={s.title} lines={s.lines} />
      ))}
    </div>
  );
}
