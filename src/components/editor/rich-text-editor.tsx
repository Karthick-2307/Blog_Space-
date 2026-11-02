"use client";

import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/lib/http";
import { cn } from "@/lib/utils";

export type EditorValue = { json: JSONContent; html: string; text: string };

export function RichTextEditor({
  initialContent,
  onChange,
  ariaLabelledBy,
}: {
  initialContent: JSONContent | string | null;
  onChange: (value: EditorValue) => void;
  ariaLabelledBy?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
          isAllowedUri: (url) => /^(https?:|mailto:)/i.test(url),
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "Tell your story…" }),
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "prose-article max-w-none focus:outline-none",
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : { "aria-label": "Article content" }),
      },
    },
    onUpdate: ({ editor }) => onChange({ json: editor.getJSON(), html: editor.getHTML(), text: editor.getText() }),
  });

  return (
    <div className="rounded-md border border-border bg-card/40">
      {editor ? <Toolbar editor={editor} /> : <div className="h-12 border-b border-border" />}
      <div className="editor-content px-4 py-6 sm:px-8">
        {editor ? <EditorContent editor={editor} /> : <div className="min-h-[22rem]" aria-busy="true" />}
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const c = () => editor.chain().focus();
  const groups: { label: string; icon: typeof Bold; active?: boolean; disabled?: boolean; run: () => void }[][] = [
    [
      { label: "Heading", icon: Heading2, active: state.h2, run: () => c().toggleHeading({ level: 2 }).run() },
      { label: "Subheading", icon: Heading3, active: state.h3, run: () => c().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: "Bold", icon: Bold, active: state.bold, run: () => c().toggleBold().run() },
      { label: "Italic", icon: Italic, active: state.italic, run: () => c().toggleItalic().run() },
      { label: "Strikethrough", icon: Strikethrough, active: state.strike, run: () => c().toggleStrike().run() },
      { label: "Inline code", icon: Code, active: state.code, run: () => c().toggleCode().run() },
      { label: "Link", icon: LinkIcon, active: state.link, run: () => setLinkOpen(true) },
    ],
    [
      { label: "Bulleted list", icon: List, active: state.bullet, run: () => c().toggleBulletList().run() },
      { label: "Numbered list", icon: ListOrdered, active: state.ordered, run: () => c().toggleOrderedList().run() },
      { label: "Quote", icon: Quote, active: state.quote, run: () => c().toggleBlockquote().run() },
      { label: "Code block", icon: SquareCode, active: state.codeBlock, run: () => c().toggleCodeBlock().run() },
      { label: "Divider", icon: Minus, run: () => c().setHorizontalRule().run() },
      { label: "Image", icon: ImagePlus, run: () => setImageOpen(true) },
    ],
    [
      { label: "Undo", icon: Undo2, disabled: !state.canUndo, run: () => c().undo().run() },
      { label: "Redo", icon: Redo2, disabled: !state.canRedo, run: () => c().redo().run() },
    ],
  ];

  return (
    <>
      <div
        role="toolbar"
        aria-label="Formatting"
        className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur"
      >
        {groups.map((group, gi) => (
          <div key={gi} className={cn("flex items-center gap-0.5", gi > 0 && "border-l border-border pl-1 ml-1")}>
            {group.map(({ label, icon: Icon, active, disabled, run }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={run}
                disabled={disabled}
                aria-label={label}
                aria-pressed={active ?? undefined}
                title={label}
                className={cn(active && "bg-accent text-accent-foreground")}
              >
                <Icon />
              </Button>
            ))}
          </div>
        ))}
      </div>
      <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
      <ImageDialog editor={editor} open={imageOpen} onOpenChange={setImageOpen} />
    </>
  );
}

function LinkDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onOpenChange(false);
      return;
    }
    const normalized = /^[a-z]+:/i.test(value) ? value : `https://${value}`;
    if (!/^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(normalized)) {
      setError("Enter a valid http(s) or mailto link.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setUrl(editor.getAttributes("link").href ?? "");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <form onSubmit={apply} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
            <DialogDescription>Select text first, then paste a URL. Leave empty to remove the link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              aria-invalid={Boolean(error)}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange: (o: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function insert(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose an image.");
    if (!alt.trim()) return setError("Describe the image for screen-reader users.");
    setUploading(true);
    setError(null);
    try {
      const src = await uploadImage(file, "inline");
      editor.chain().focus().setImage({ src, alt: alt.trim() }).run();
      onOpenChange(false);
      setFile(null);
      setAlt("");
      toast.success("Image added.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !uploading && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={insert} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Insert an image</DialogTitle>
            <DialogDescription>JPEG, PNG, WebP or GIF, up to 5 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="image-file">Image</Label>
            <Input
              id="image-file"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-alt">Alternative text</Label>
            <Input
              id="image-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="What does the image show?"
              maxLength={200}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : null}
              {uploading ? "Uploading…" : "Insert image"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
