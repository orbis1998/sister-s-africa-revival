import { cn } from "@/lib/utils";

export function RichContent({ html, className }: { html?: string | null; className?: string }) {
  if (!html?.trim()) return null;
  return (
    <div
      className={cn(
        "rich-content prose prose-sm max-w-none text-espresso/85",
        "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-espresso",
        "[&_h3]:font-display [&_h3]:text-xl [&_h3]:text-espresso",
        "[&_img]:rounded-xl [&_img]:my-4",
        "[&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-copper [&_blockquote]:pl-4",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
