"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  home: string;
  isAdmin: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carga la sesión activa y escucha cambios de auth
  useEffect(() => {
    let ignore = false;

    const supabase = getSupabase();

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
        // setTimeout saca la llamada del contexto del lock de auth.
        // onAuthStateChange mantiene el lock mientras corre; si dentro llamamos
        // a getSupabase().from(...) se vuelve a pedir el lock → "Lock broken".
        const uid = session.user.id;
        const email = session.user.email ?? "";
        setTimeout(() => { hydrateProfile(uid, email); }, 0);
      } else {
        setUser(null);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  /** Lee el perfil de la tabla `perfiles` y construye el objeto User */
  async function hydrateProfile(uid: string, email: string) {
    const { data } = await getSupabase()
      .from("perfiles")
      .select("nombre, rol, nivel, hogar")
      .eq("id", uid)
      .single();

    setUser({
      id: uid,
      email,
      name: data?.nombre ?? email,
      role: data?.rol ?? "Dungeon Explorer",
      level: data?.nivel ?? 1,
      home: data?.hogar ?? "Sin hogar",
      isAdmin: data?.rol === "Game Master",
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
