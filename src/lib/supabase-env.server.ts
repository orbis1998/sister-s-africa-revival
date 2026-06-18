function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = raw.trim();
    if (!value) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

export function getSupabasePublicEnv() {
  const url = readEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const publishableKey = readEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  return { url, publishableKey };
}

export function getSupabaseAdminEnv() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, publishableKey, serviceRoleKey };
}

export function missingSupabaseEnvMessage(missing: string[]) {
  return `Variables Supabase manquantes côté serveur : ${missing.join(", ")}. Ajoutez-les dans Vercel → Settings → Environment Variables (Production), puis redéployez.`;
}
