"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Ingresa un correo electronico valido.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (resetError) {
        throw resetError;
      }

      setSuccess(
        "Si el correo existe, te enviamos un enlace para restablecer tu contrasena.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo.");
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
          <source src="/imgs/Login/VIdeos/Dragon.mp4" type="video/mp4" />
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
              Recuperar contrasena
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Te enviaremos un enlace para restablecerla
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Correo electronico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    className="pl-10 bg-input border-border focus-visible:border-gold"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
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
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar correo de recuperacion"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
