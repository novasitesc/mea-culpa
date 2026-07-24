"use client";

// Tooltip de hover con la descripción de un conjuro. Reutilizado por el modal
// de lanzamiento y por el log de la sala. Usa Radix HoverCard (ya instalado):
// se posiciona en un portal, así que nunca lo recorta el scroll del contenedor.
// La descripción es HTML acotado del catálogo → se sanea con DOMPurify como en
// el registro de conjuros del perfil.
import * as HoverCard from "@radix-ui/react-hover-card";
import DOMPurify from "isomorphic-dompurify";

// Sin atributos: elimina on*, href, src, style y demás vectores de XSS.
const SPELL_ALLOWED_TAGS = ["p", "br", "ul", "ol", "li", "em", "strong", "i", "b"];

type Props = {
  name: string;
  escuela?: string | null;
  spellLevel?: number;
  description?: string | null;
  children: React.ReactNode;
};

export default function SpellDescriptionHover({ name, escuela, spellLevel, description, children }: Props) {
  // Sin descripción no hay tooltip: el trigger queda como texto normal.
  if (!description) return <>{children}</>;

  return (
    <HoverCard.Root openDelay={120} closeDelay={80}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="z-[200] w-[300px] max-w-[90vw] max-h-[280px] overflow-y-auto overscroll-contain p-3.5 rounded-lg border border-[#8B7355]/40 bg-[#120e0b]/95 backdrop-blur-md shadow-2xl custom-scrollbar data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex flex-col gap-2">
            <div className="border-b border-[#8B7355]/20 pb-1.5">
              <span className="text-sm font-bold text-[#D4AF37] font-serif">{name}</span>
              <span className="block text-[10px] uppercase tracking-wider text-foreground/40 mt-0.5">
                {escuela ?? "Escuela desconocida"}
                {spellLevel !== undefined && (spellLevel === 0 ? " · Truco" : ` · Nivel ${spellLevel}`)}
              </span>
            </div>
            <div
              className="text-xs text-muted-foreground prose prose-invert prose-p:my-1 prose-strong:text-amber-100/90 leading-relaxed select-text"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(description, {
                  ALLOWED_TAGS: SPELL_ALLOWED_TAGS,
                  ALLOWED_ATTR: [],
                }),
              }}
            />
          </div>
          <HoverCard.Arrow className="fill-[#8B7355]/40" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
