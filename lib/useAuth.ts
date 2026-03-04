"use client";

import { useState, useEffect } from "react";
import { DEMO_USERS } from "@/lib/demoUsers";

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

  useEffect(() => {
    // Verificar si hay un usuario en localStorage
    const storedUser = localStorage.getItem("meaculpa_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    // Simular delay de red
    await new Promise((resolve) => setTimeout(resolve, 800));

    const foundUser = DEMO_USERS.find(
      (u) => u.email === email && u.password === password,
    );

    if (!foundUser) {
      return { success: false, error: "Correo o contraseña incorrectos" };
    }

    const { password: _, ...userWithoutPassword } = foundUser;
    localStorage.setItem("meaculpa_user", JSON.stringify(userWithoutPassword));
    setUser(userWithoutPassword);

    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem("meaculpa_user");
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
