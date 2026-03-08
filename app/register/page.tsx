"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getSupabase } from "@/lib/supabase";
import Image from "next/image";
import { Lock, Mail, Eye, EyeOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Esquema de validación
const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
    email: z.string().email("El correo electrónico no es válido"),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  // Ocultar scrollbar cuando se monta el componente
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[register] Intentando signUp para:", data.email);

      // Registrar usuario en Supabase Auth
      const { data: authData, error: authError } =
        await getSupabase().auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              name: data.username,
            },
          },
        });

      console.log("[register] Respuesta de signUp:", { authData, authError });

      if (authError) {
        const detail = `${authError.message} (status: ${(authError as any).status ?? "?"}, code: ${(authError as any).code ?? "??"})`;
        console.error("[register] authError:", authError);
        throw new Error(detail);
      }

      if (authData.user) {
        router.push("/login?registered=true");
      } else {
        // Algunos proyectos Supabase requieren confirmación de email
        setError(
          "Revisa tu correo para confirmar el registro antes de iniciar sesión.",
        );
      }
    } catch (err) {
      console.error("[register] Error inesperado:", err);
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden"
      style={{ overflow: "hidden" }}
    >
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
        <Card
          className="bg-card shadow-2xl candle-glow"
          style={{
            borderColor: "#8B4513",
            borderWidth: "2px",
            borderStyle: "solid",
            boxShadow:
              "inset 0 0 20px rgba(0, 0, 0, 0.5), 0 0 10px rgba(139, 69, 19, 0.2)",
          }}
        >
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative w-full max-w-xs h-auto aspect-4/3">
                <Image
                  src="/imgs/Login/calavera.jpeg"
                  alt="Mea Culpa - Más allá del vigésimo nivel"
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 768px) 320px, 400px"
                />
              </div>
            </div>
            <CardTitle className="text-2xl text-gold font-serif">
              Crear Cuenta
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Regístrate para comenzar tu aventura
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Grid de dos columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Columna izquierda */}
                <div className="space-y-4">
                  {/* Username field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="username"
                      className="text-foreground flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Nombre de Usuario
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Tu nombre de aventurero"
                      className="bg-input border-border focus-visible:border-gold"
                      autoCapitalize="none"
                      autoCorrect="off"
                      tabIndex={1}
                      autoFocus
                      {...register("username")}
                      disabled={isLoading}
                    />
                    {errors.username && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.username.message}
                      </p>
                    )}
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-foreground flex items-center gap-2"
                    >
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
                        autoCapitalize="none"
                        autoCorrect="off"
                        tabIndex={3}
                        {...register("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors cursor-pointer z-30"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Columna derecha */}
                <div className="space-y-4">
                  {/* Email field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-foreground flex items-center gap-2"
                    >
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
                        autoCapitalize="none"
                        autoCorrect="off"
                        tabIndex={2}
                        {...register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-foreground flex items-center gap-2"
                    >
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
                        autoCapitalize="none"
                        autoCorrect="off"
                        tabIndex={4}
                        {...register("confirmPassword")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
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
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit button */}
              <div className="flex justify-center pt-2">
                <Button
                  type="submit"
                  className="bg-gold hover:bg-gold-dim text-background font-medium py-4 px-12 text-base cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </div>

              {/* Additional links */}
              <div className="text-center space-y-1 pt-2">
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
        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2024 Mea Culpa - RPG Online
        </p>
      </div>
    </div>
  );
}
