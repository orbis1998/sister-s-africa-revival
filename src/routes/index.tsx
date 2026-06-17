import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { ArrowRight, Leaf, ShieldCheck, Truck, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Sisters Africa — Bouillies bio pour une prise de poids saine" },
      { name: "description", content: "Mass Gainer, Super Grow et Peanut Butter — bouillies bio pour adultes et enfants. Livraison RDC & Congo Brazzaville." },
      { property: "og:title", content: "The Sisters Africa" },
      { property: "og:image", content: heroImg },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative">
        <div className="grid lg:grid-cols-2 min-h-[88vh]">
          <div className="bg-cream flex items-center order-2 lg:order-1">
            <div className="container-page py-16 lg:py-0 lg:px-16 max-w-2xl">
              <div className="eyebrow mb-6">Powered by The Sisters · 100% Bio</div>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-espresso leading-[1.05] mb-8">
                La prise de poids,<br />
                <em className="text-copper not-italic">naturelle</em> et<br />
                saine.
              </h1>
              <p className="text-base text-espresso/75 leading-relaxed max-w-md mb-10">
                Des bouillies bio d'origine végétale, conçues en Afrique pour révéler vos courbes
                et soutenir la croissance de vos enfants. Résultats visibles en deux semaines.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/products" className="btn-hero">
                  Découvrir la boutique <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/product/$slug" params={{ slug: "mass-gainer" }} className="btn-ghost">
                  Le Mass Gainer
                </Link>
              </div>
              <div className="mt-12 pt-8 border-t border-border/60 flex items-center gap-8 text-xs text-muted-foreground">
                <div><strong className="font-display text-espresso text-2xl block leading-none">10K+</strong> clientes satisfaites</div>
                <div><strong className="font-display text-espresso text-2xl block leading-none">3-6kg</strong> en 2 semaines</div>
                <div><strong className="font-display text-espresso text-2xl block leading-none">100%</strong> bio végétal</div>
              </div>
            </div>
          </div>
          <div className="relative order-1 lg:order-2 min-h-[50vh] lg:min-h-full">
            <img
              src={heroImg}
              alt="Femme rayonnante incarnant la confiance The Sisters"
              className="absolute inset-0 w-full h-full object-cover"
              width={1600}
              height={1200}
            />
          </div>
        </div>
      </section>

      {/* FEATURES STRIP */}
      <section className="border-y border-border/60 bg-clay/30">
        <div className="container-page grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {[
            { icon: Leaf, label: "100% bio végétal" },
            { icon: ShieldCheck, label: "Résultats garantis" },
            { icon: Truck, label: "Livraison RDC & Congo" },
            { icon: HeartHandshake, label: "Service client humain" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-clay/30 px-6 py-6 flex items-center gap-3">
              <Icon className="w-5 h-5 text-copper" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-[0.18em] text-espresso/80">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="container-page py-24">
        <div className="flex items-end justify-between mb-14">
          <div>
            <div className="eyebrow mb-3">Best-sellers</div>
            <h2 className="font-display text-4xl md:text-5xl text-espresso">Nos formules signature</h2>
          </div>
          <Link to="/products" className="hidden md:inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-espresso hover:text-copper">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* STORY */}
      <section className="bg-espresso text-cream py-24">
        <div className="container-page grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow text-gold mb-4">Notre histoire</div>
            <h2 className="font-display text-4xl md:text-5xl mb-6 leading-tight">
              Deux sœurs, une mission&nbsp;: redéfinir la beauté africaine.
            </h2>
            <p className="text-cream/80 leading-relaxed mb-4">
              Née d'un constat simple — la difficulté pour de nombreuses femmes et enfants
              d'accéder à une nutrition saine et adaptée — The Sisters Africa s'est donné
              pour mission de formuler des bouillies bio efficaces, accessibles et délicieuses.
            </p>
            <p className="text-cream/80 leading-relaxed">
              Aujourd'hui, des milliers de clientes à travers la RDC, le Congo Brazzaville
              et au-delà nous font confiance pour leur transformation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-copper/20 p-8 rounded-sm">
              <div className="font-display text-5xl text-gold mb-2">+10K</div>
              <div className="text-xs uppercase tracking-widest text-cream/70">Clientes</div>
            </div>
            <div className="bg-copper/20 p-8 rounded-sm mt-12">
              <div className="font-display text-5xl text-gold mb-2">4</div>
              <div className="text-xs uppercase tracking-widest text-cream/70">Pays livrés</div>
            </div>
            <div className="bg-copper/20 p-8 rounded-sm">
              <div className="font-display text-5xl text-gold mb-2">100%</div>
              <div className="text-xs uppercase tracking-widest text-cream/70">Origine végétale</div>
            </div>
            <div className="bg-copper/20 p-8 rounded-sm mt-12">
              <div className="font-display text-5xl text-gold mb-2">2 sem.</div>
              <div className="text-xs uppercase tracking-widest text-cream/70">Premiers résultats</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-24 text-center">
        <div className="eyebrow mb-4">Service client</div>
        <h2 className="font-display text-4xl md:text-5xl text-espresso mb-6">
          The Sisters got your back.
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">
          Notre équipe vous accompagne par WhatsApp, de la commande à la livraison.
        </p>
        <Link to="/products" className="btn-hero">Commencer ma transformation</Link>
      </section>
    </>
  );
}
