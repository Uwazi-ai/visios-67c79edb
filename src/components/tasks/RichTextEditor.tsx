import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Code, Quote } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder }: Props) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[100px] px-3 py-2 rounded-md focus:outline-none",
        style:
          "background: var(--bg-glass-1); border: 1px solid var(--border-glass); color: var(--text-primary); font-family: Satoshi, sans-serif;",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const Btn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-1 rounded hover:bg-white/10"
      style={{ color: active ? "var(--text-accent)" : "var(--text-muted)" }}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-0.5 px-1">
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={12} /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={12} /></Btn>
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={12} /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={12} /></Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={12} /></Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={12} /></Btn>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
};
