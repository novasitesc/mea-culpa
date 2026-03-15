"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Eye, EyeOff } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();

      if (!mounted) return;

      if (!session) {
        setError(
          "Enlace invalido o expirado. Solicita un nuevo correo de recuperacion.",
        );
      }
      setIsCheckingSession(false);
    };

    checkRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess("Contrasena actualizada correctamente. Ahora puedes iniciar sesion.");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
        >
          <source src="/imgs/Login/VIdeos/Dragon2.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/60" />
      </div>

      <div className="relative z-20 w-full max-w-lg">
        <Card
          className="bg-card shadow-2xl candle-glow"
          style={{
            borderColor: "#8B4513",
            borderWidth: "2px",
            borderStyle: "solid",
          }}
        >
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative w-full max-w-xs h-auto aspect-4/3">
                <Image
                  src="/imgs/Login/calavera.jpeg"
                  alt="Mea Culpa"
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 768px) 320px, 400px"
                />
              </div>
            </div>
            <CardTitle className="text-2xl text-gold font-serif">
              Nueva contrasena
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Ingresa tu nueva contrasena para completar la recuperacion
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isCheckingSession ? (
              <div className="flex justify-center py-8">
                <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Nueva contrasena
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-input border-border focus-visible:border-gold"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading || !!error}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    Confirmar contrasena
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-input border-border focus-visible:border-gold"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading || !!error}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive text-center">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm text-emerald-400 text-center">{success}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gold hover:bg-gold-dim text-background font-medium py-4 text-base"
                  disabled={isLoading || !!error}
                >
                  {isLoading ? "Actualizando..." : "Guardar nueva contrasena"}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-sm text-muted-foreground hover:text-gold transition-colors"
                  >
                    Volver a iniciar sesion
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
