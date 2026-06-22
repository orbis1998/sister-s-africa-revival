import TiptapImage from "@tiptap/extension-image";

export type ImageAlign = "left" | "center" | "right";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    alignableImage: {
      setImageAlign: (align: ImageAlign) => ReturnType;
    };
  }
}

export const AlignableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center" as ImageAlign,
        parseHTML: (el) => (el.getAttribute("data-align") as ImageAlign) || "center",
        renderHTML: (attrs) => {
          const align = (attrs.align as ImageAlign) || "center";
          return align === "center" ? {} : { "data-align": align };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign:
        (align: ImageAlign) =>
        ({ commands }) =>
          commands.updateAttributes("image", { align }),
    };
  },
});
