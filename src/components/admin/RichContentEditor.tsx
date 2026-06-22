import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
  Youtube as YoutubeIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlignableImage, type ImageAlign } from "@/components/admin/editor-image";
import { ImageCropModal } from "@/components/admin/ImageCropModal";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadBucket?: "site-assets" | "product-images";
};

const editorProse =
  "prose prose-sm max-w-none min-h-[220px] px-4 py-3 focus:outline-none text-espresso " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
  "[&_img]:rounded-xl [&_img]:my-4 " +
  "[&_img[data-align=left]]:float-left [&_img[data-align=left]]:mr-4 [&_img[data-align=left]]:mb-2 [&_img[data-align=left]]:max-w-[45%] " +
  "[&_img[data-align=right]]:float-right [&_img[data-align=right]]:ml-4 [&_img[data-align=right]]:mb-2 [&_img[data-align=right]]:max-w-[45%] " +
  "[&_iframe]:rounded-xl";

async function uploadEditorImage(file: File, bucket: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `editor/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function RichContentEditor({
  value,
  onChange,
  placeholder = "Rédigez une description riche : titres, gras, images, vidéos…",
  uploadBucket = "site-assets",
}: Props) {
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      AlignableImage.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360 }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: editorProse },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== editor.getText()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const imageAlign = (editor.getAttributes("image").align as ImageAlign) || "center";

  function pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setCropFile(file);
      setCropOpen(true);
    };
    input.click();
  }

  async function insertCroppedImage(file: File) {
    try {
      const url = await uploadEditorImage(file, uploadBucket);
      editor.chain().focus().setImage({ src: url, align: "center" }).run();
    } catch (e: any) {
      toast.error(e.message ?? "Upload impossible");
    }
  }

  function setImageAlign(align: ImageAlign) {
    if (editor.isActive("image")) {
      editor.chain().focus().setImageAlign(align).run();
      return;
    }
    toast.message("Sélectionnez d'abord une image dans le texte");
  }

  function addLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL du lien", prev ?? "https://");
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addYoutube() {
    const url = window.prompt("URL YouTube");
    if (!url) return;
    editor.commands.setYoutubeVideo({ src: url });
  }

  const btn = (active: boolean) =>
    `rounded-md border px-2 py-1.5 text-xs transition ${active ? "border-copper bg-copper/10 text-copper" : "border-border hover:bg-cream"}`;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex flex-wrap gap-1 border-b border-border bg-cream/40 p-2">
          <button type="button" title="Gras" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></button>
          <button type="button" title="Italique" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" title="Souligné" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></button>
          <button type="button" title="Titre H2" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></button>
          <button type="button" title="Titre H3" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></button>
          <button type="button" title="Liste à puces" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></button>
          <button type="button" title="Liste numérotée" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></button>
          <button type="button" title="Citation" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></button>
          <button type="button" title="Aligner à gauche" className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-3.5 w-3.5" /></button>
          <button type="button" title="Centrer" className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-3.5 w-3.5" /></button>
          <button type="button" title="Aligner à droite" className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-3.5 w-3.5" /></button>
          <button type="button" title="Lien" className={btn(editor.isActive("link"))} onClick={addLink}><Link2 className="h-3.5 w-3.5" /></button>
          <button type="button" title="Image (avec rognage)" className={btn(false)} onClick={pickImage}><ImagePlus className="h-3.5 w-3.5" /></button>
          <span className="mx-1 w-px self-stretch bg-border" />
          <button type="button" title="Image à gauche" className={btn(editor.isActive("image") && imageAlign === "left")} onClick={() => setImageAlign("left")}><AlignLeft className="h-3.5 w-3.5" /></button>
          <button type="button" title="Image centrée" className={btn(editor.isActive("image") && imageAlign === "center")} onClick={() => setImageAlign("center")}><AlignCenter className="h-3.5 w-3.5" /></button>
          <button type="button" title="Image à droite" className={btn(editor.isActive("image") && imageAlign === "right")} onClick={() => setImageAlign("right")}><AlignRight className="h-3.5 w-3.5" /></button>
          <button type="button" title="Vidéo YouTube" className={btn(false)} onClick={addYoutube}><YoutubeIcon className="h-3.5 w-3.5" /></button>
        </div>
        <EditorContent editor={editor} />
      </div>

      <ImageCropModal
        file={cropFile}
        open={cropOpen}
        onClose={() => {
          setCropOpen(false);
          setCropFile(null);
        }}
        onConfirm={insertCroppedImage}
      />
    </>
  );
}
