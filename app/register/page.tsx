"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@supabase/supabase-js"
import Image from "next/image"
import { Lock, Mail, Eye, EyeOff, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Esquema de validación
const registerSchema = z
  .object({
    username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
    email: z.string().email("El correo electrónico no es válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      // Crear cliente de Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuración de Supabase no encontrada")
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      // Registrar usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
          },
        },
      })

      if (authError) {
        throw new Error(authError.message || "Error al registrar usuario")
      }

      if (authData.user) {
        // Aquí podrías guardar información adicional en una tabla de perfiles
        // Por ahora, redirigimos al login
        router.push("/login?registered=true")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background GIF */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
        <img
          src="/imgs/background.gif"
          alt="Background"
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            width: "auto",
            height: "auto",
          }}
        />
        {/* Overlay oscuro para mejorar legibilidad */}
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-20 w-full max-w-lg">
        <Card className="bg-card border-gold-dim medieval-border shadow-2xl candle-glow">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center mb-6">
              <div className="relative w-full max-w-sm h-auto aspect-[4/3]">
                <Image
                  src="/imgs/mea-culpa-logo.jpeg"
                  alt="Mea Culpa - Más allá del vigésimo nivel"
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 768px) 320px, 400px"
                />
              </div>
            </div>
            <CardTitle className="text-2xl text-gold font-serif">Crear Cuenta</CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Regístrate para comenzar tu aventura
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Username field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nombre de Usuario
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Tu nombre de aventurero"
                  className="bg-input border-border focus-visible:border-gold"
                  {...register("username")}
                  disabled={isLoading}
                />
                {errors.username && (
                  <p className="text-sm text-destructive mt-1">{errors.username.message}</p>
                )}
              </div>

              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    className="pl-10 bg-input border-border focus-visible:border-gold relative z-20"
                    {...register("email")}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-input border-border focus-visible:border-gold relative z-20"
                    {...register("password")}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors cursor-pointer z-30"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirmar Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-input border-border focus-visible:border-gold relative z-20"
                    {...register("confirmPassword")}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors cursor-pointer z-30"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-gold hover:bg-gold-dim text-background font-medium py-6 px-12 text-base cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </div>

              {/* Additional links */}
              <div className="text-center space-y-2 pt-4">
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes una cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-gold hover:text-gold-dim underline font-medium cursor-pointer"
                  >
                    Inicia sesión aquí
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 Mea Culpa - RPG Online
        </p>
      </div>
    </div>
  )
}
