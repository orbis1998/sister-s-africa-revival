import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "livreur" | "client" | "pos";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, roles: [], loading: true,
  signOut: async () => {}, refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await fetchRoles(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user, session, roles, loading,
      signOut: async () => { await supabase.auth.signOut(); },
      refreshRoles: async () => { if (user) await fetchRoles(user.id); },
    }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export const roleHome = (roles: AppRole[]) => {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("manager")) return "/manager";
  if (roles.includes("livreur")) return "/livreur";
  if (roles.includes("pos")) return "/pos";
  return "/account";
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrateur",
  manager: "Manager",
  livreur: "Livreur",
  pos: "Point de vente",
  client: "Client",
};
