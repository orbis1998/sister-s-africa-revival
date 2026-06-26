import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchProducts } from "@/lib/products";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let products: Awaited<ReturnType<typeof fetchProducts>> = [];
        try {
          products = await fetchProducts();
        } catch (error) {
          console.error("Sitemap products load failed", error);
        }
        const entries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/products", changefreq: "weekly", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          ...products.map((p) => ({ path: `/product/${p.slug}`, changefreq: "weekly", priority: "0.8" })),
        ];
        const urls = entries.map(
          (e) =>
            `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
