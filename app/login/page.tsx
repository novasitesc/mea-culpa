"use client";

// Pantalla de acceso (/login). Email+contraseña o Google/Discord, ambos vía
// useAuth() (lib/useAuth.ts). Ningún componente llama a Supabase Auth directamente.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useAuth } from "@/lib/useAuth";

// Esquema de validación
const loginSchema = z.object({
  email: z.string().email("El correo electrónico no es válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithOAuth, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
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

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(data.email, data.password);

      if (!result.success) {
        setError(result.error || "Error al iniciar sesión");
      }
      // La redirección la maneja el useEffect que vigila isAuthenticated.
      // No hacer router.push aquí para evitar doble navegación.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onOAuthLogin = async (provider: "google" | "discord") => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loginWithOAuth(provider);
      if (!result.success) {
        setError(result.error || `Error al iniciar sesión con ${provider}`);
        setIsLoading(false);
      }
      // Si fue exitoso, redirigirá automáticamente a OAuth
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
      setIsLoading(false);
    }
  };

  const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      <path fill="none" d="M1 1h22v22H1z"/>
    </svg>
  );

  const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );

  return (
    <div
      className="h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden"
      style={{ overflow: "hidden" }}
    >
      {/* Background Video */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            width: "auto",
            height: "auto",
          }}
        >
          <source src="/imgs/Login/VIdeos/Dragon2.mp4" type="video/mp4" />
        </video>
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
            <CardDescription className="text-base text-muted-foreground mt-2">
              Inicia sesión en tu cuenta
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    className="pl-10 bg-input border-border focus-visible:border-gold relative z-20"
                    autoComplete="email"
                    required
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

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-input border-border focus-visible:border-gold relative z-20"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
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

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full bg-gold hover:bg-gold-dim text-background font-medium py-4 text-base cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-medium">
                    O continuar con
                  </span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border bg-background hover:bg-muted/50 hover:border-gold/50 transition-all font-medium flex items-center justify-center gap-2"
                  onClick={() => onOAuthLogin("google")}
                  disabled={isLoading}
                >
                  <GoogleIcon className="h-5 w-5" />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] hover:text-[#5865F2] hover:border-[#5865F2]/50 transition-all font-medium flex items-center justify-center gap-2"
                  onClick={() => onOAuthLogin("discord")}
                  disabled={isLoading}
                >
                  <DiscordIcon className="h-5 w-5" />
                  Discord
                </Button>
              </div>

              {/* Additional links */}
              <div className="text-center space-y-1 pt-2">
                <p className="text-sm text-muted-foreground">
                  ¿No tienes una cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="text-gold hover:text-gold-dim underline font-medium cursor-pointer"
                  >
                    Regístrate aquí
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-sm text-muted-foreground hover:text-gold transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Mea Culpa - RPG Online
          </p>
          <div className="flex justify-center items-center gap-4 text-xs text-muted-foreground/80">
            <Link href="/terminos" className="hover:text-gold transition-colors">
              Condiciones de Servicio
            </Link>
            <span>•</span>
            <Link href="/privacidad" className="hover:text-gold transition-colors">
              Política de Privacidad
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2">
            Desarrollado por NOVASITE
          </p>
        </div>
      </div>
    </div>
  );
}
