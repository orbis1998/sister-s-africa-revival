import { createFileRoute } from "@tanstack/react-router";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Boutique — The Sisters Africa" },
      { name: "description", content: "Découvrez la gamme complète : Mass Gainer, Super Grow et Peanut Butter bio." },
      { property: "og:title", content: "Boutique — The Sisters Africa" },
      { property: "og:description", content: "Bouillies bio d'origine végétale pour adultes et enfants." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <section className="container-page py-20">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="eyebrow mb-3">Boutique</div>
        <h1 className="font-display text-5xl md:text-6xl text-espresso mb-6">La collection</h1>
        <p className="text-muted-foreground">
          Trois formules, une seule promesse&nbsp;: vous accompagner vers la version la plus
          confiante et rayonnante de vous-même.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}
