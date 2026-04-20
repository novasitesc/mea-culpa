"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { normalizeAccountLevel } from "@/lib/accountLevel";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  home: string;
  oro: number;
  isAdmin: boolean;
  rolSistema: string;
  nivel20Url: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string>("");

  // Carga la sesión activa y escucha cambios de auth
  useEffect(() => {
    let ignore = false;

    const supabase = getSupabase();

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!ignore && session?.access_token) setToken(session.access_token);
      if (!ignore && session?.user) {
        await hydrateProfile(session.user.id, session.user.email ?? "");
      }
      if (!ignore) setIsLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (!ignore) setToken(session.access_token ?? "");
        // setTimeout saca la llamada del contexto del lock de auth.
        // onAuthStateChange mantiene el lock mientras corre; si dentro llamamos
        // a getSupabase().from(...) se vuelve a pedir el lock → "Lock broken".
        const uid = session.user.id;
        const email = session.user.email ?? "";
        setTimeout(() => {
          hydrateProfile(uid, email);
        }, 0);
      } else {
        setUser(null);
        if (!ignore) setToken("");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleAuthRefresh = (event: Event) => {
      if (!user) return;
      const detail = (event as CustomEvent<{ oro?: number }>).detail;
      const oro = detail?.oro;
      if (typeof oro === "number") {
        setUser((prev) => (prev ? { ...prev, oro } : prev));
        return;
      }
      hydrateProfile(user.id, user.email);
    };

    window.addEventListener("auth:refresh", handleAuthRefresh);
    return () => window.removeEventListener("auth:refresh", handleAuthRefresh);
  }, [user]);

  /** Lee el perfil de la tabla `perfiles` y construye el objeto User */
  async function hydrateProfile(uid: string, email: string) {
    const { data } = await getSupabase()
      .from("perfiles")
      .select("nombre, rol, nivel, hogar, oro, es_admin, rol_sistema, nivel20_url")
      .eq("id", uid)
      .single();

    setUser({
      id: uid,
      email,
      name: data?.nombre ?? email,
      role: data?.rol ?? "Dungeon Explorer",
      level: normalizeAccountLevel(data?.nivel ?? 1),
      home: data?.hogar ?? "Sin hogar",
      oro: data?.oro ?? 0,
      isAdmin: data?.es_admin ?? false,
      rolSistema:
        data?.rol_sistema ?? (data?.es_admin ? "admin" : "usuario"),
      nivel20Url: data?.nivel20_url ?? null,
    });
  }

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = async () => {
    await getSupabase().auth.signOut();
    setUser(null);
  };

  const refreshUser = () => {
    if (!user) return Promise.resolve();
    return hydrateProfile(user.id, user.email);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
    token,
  };
}
