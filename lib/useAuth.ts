"use client"

import { useState, useEffect } from "react"

export interface User {
  id: string
  email: string
  name: string
  role: string
  level: number
}

// Usuarios de prueba
const DEMO_USERS = [
  {
    id: "1",
    email: "demo@meaculpa.com",
    password: "123456",
    name: "Nyra Valewind",
    role: "Dungeon Explorer",
    level: 7,
  },
  {
    id: "2",
    email: "admin@meaculpa.com",
    password: "admin123",
    name: "Liza Darkwood",
    role: "Game Master",
    level: 20,
  },
]

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay un usuario en localStorage
    const storedUser = localStorage.getItem("meaculpa_user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 800))

    const foundUser = DEMO_USERS.find(
      u => u.email === email && u.password === password
    )

    if (!foundUser) {
      return { success: false, error: "Correo o contraseña incorrectos" }
    }

    const { password: _, ...userWithoutPassword } = foundUser
    localStorage.setItem("meaculpa_user", JSON.stringify(userWithoutPassword))
    setUser(userWithoutPassword)

    return { success: true }
  }

  const logout = () => {
    localStorage.removeItem("meaculpa_user")
    setUser(null)
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  }
}
