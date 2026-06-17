import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  author_name: z.string().trim().min(2, "Nom trop court").max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10, "Minimum 10 caractères").max(2000),
  location: z.string().trim().max(80).optional(),
});

async function uploadPhoto(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("review-photos").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error(error);
    return null;
  }
  // Bucket is private — generate long-lived signed URL (10 years)
  const { data } = await supabase.storage.from("review-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  return data?.signedUrl ?? null;
}

export function ReviewForm({ productSlug, onSubmitted }: { productSlug: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ author_name: name, rating, comment, location: location || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const [beforeUrl, afterUrl] = await Promise.all([
        before ? uploadPhoto(before) : Promise.resolve(null),
        after ? uploadPhoto(after) : Promise.resolve(null),
      ]);

      const { error } = await supabase.from("reviews").insert({
        product_slug: productSlug,
        author_name: parsed.data.author_name,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        location: parsed.data.location ?? null,
        before_image_url: beforeUrl,
        after_image_url: afterUrl,
      });
      if (error) throw error;
      toast.success("Merci ! Votre avis sera publié après validation.");
      setName("");
      setComment("");
      setLocation("");
      setBefore(null);
      setAfter(null);
      setRating(5);
      onSubmitted();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-card p-8 rounded-sm border border-border/60">
      <div className="eyebrow mb-2">Votre expérience</div>
      <h3 className="font-display text-2xl text-espresso mb-6">Laissez un avis</h3>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Note</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1"
                aria-label={`${n} étoiles`}
              >
                <Star className={`w-6 h-6 ${n <= rating ? "fill-gold text-gold" : "text-border"}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Votre prénom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="w-full bg-cream border border-border px-4 py-3 rounded-sm focus:outline-none focus:border-copper transition-colors text-sm"
              placeholder="Ex. Aïcha"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Ville (optionnel)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={80}
              className="w-full bg-cream border border-border px-4 py-3 rounded-sm focus:outline-none focus:border-copper transition-colors text-sm"
              placeholder="Ex. Kinshasa"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Témoignage</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            className="w-full bg-cream border border-border px-4 py-3 rounded-sm focus:outline-none focus:border-copper transition-colors text-sm resize-none"
            placeholder="Partagez votre transformation, vos résultats…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PhotoInput label="Photo Avant" file={before} setFile={setBefore} />
          <PhotoInput label="Photo Après" file={after} setFile={setAfter} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-hero w-full disabled:opacity-50"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
          ) : (
            "Envoyer mon avis"
          )}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          Chaque avis est relu par notre équipe avant publication.
        </p>
      </div>
    </form>
  );
}

function PhotoInput({ label, file, setFile }: { label: string; file: File | null; setFile: (f: File | null) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">{label}</label>
      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="border border-dashed border-border bg-cream/50 rounded-sm p-4 text-center hover:border-copper transition-colors">
          {file ? (
            <div className="text-xs text-espresso truncate">{file.name}</div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span className="text-[11px]">Choisir une photo</span>
            </div>
          )}
        </div>
      </label>
    </div>
  );
}
