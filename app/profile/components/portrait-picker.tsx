"use client";

import { useState } from "react";
import Image from "next/image";

type PortraitPickerProps = {
  userId: string;
  characterId: number;
  currentPortrait?: string;
  onPortraitUpdated: (characterId: number, portrait: string) => void;
  onAlert: (
    title: string,
    message: string,
    variant: "info" | "success" | "warning" | "error",
  ) => void;
};

const AVAILABLE_PORTRAITS = [
  "/characters/barbaro.webp",
  "/characters/bardo.webp",
  "/characters/brujo.webp",
  "/characters/clerigo.webp",
  "/characters/druida.webp",
  "/characters/explorador.webp",
  "/characters/guerrero.webp",
  "/characters/hechicero.webp",
  "/characters/mago.webp",
  "/characters/monje.webp",
  "/characters/paladin.webp",
  "/characters/picaro.webp",
  "/characters/profileplaceholder.webp",
];

export default function PortraitPicker({
  userId,
  characterId,
  currentPortrait,
  onPortraitUpdated,
  onAlert,
}: PortraitPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const selectedPortrait =
    currentPortrait || "/characters/profileplaceholder.webp";

  const handlePortraitSelect = async (portrait: string) => {
    setIsUpdating(true);

    try {
      const response = await fetch("/api/profile/update-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          characterId,
          portrait,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el retrato");
      }

      onPortraitUpdated(characterId, portrait);
      setIsOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      onAlert(
        "Retrato actualizado",
        "La imagen del personaje se guardó correctamente.",
        "success",
      );
    } catch (error) {
      console.error("Error updating portrait:", error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el retrato";
      onAlert("Error al actualizar", message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="w-full px-3 py-2 rounded border border-[#B8860B] text-[#D4AF37] text-sm font-semibold hover:bg-[#D4AF37]/10 transition"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? "Ocultar retratos" : "Cambiar foto"}
      </button>

      {isOpen && (
        <div className="rounded border border-border/60 bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Elige una imagen disponible
          </p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {AVAILABLE_PORTRAITS.map((portraitPath) => {
              const isSelected = selectedPortrait === portraitPath;

              return (
                <button
                  key={portraitPath}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handlePortraitSelect(portraitPath)}
                  className={`relative aspect-square rounded overflow-hidden border-2 transition ${
                    isSelected
                      ? "border-[#D4AF37]"
                      : "border-border hover:border-[#B8860B]"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={portraitPath.split("/").pop()}
                >
                  <Image
                    src={portraitPath}
                    alt={portraitPath.split("/").pop() ?? "Retrato"}
                    fill
                    quality={100}
                    unoptimized
                    priority={isSelected}
                    loading="eager"
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 120px"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
