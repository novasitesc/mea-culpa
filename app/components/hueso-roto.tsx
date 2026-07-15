"use client";

import { Bone } from "lucide-react";

// Fractura en zigzag compartida por ambas mitades para que el corte encaje.
const GRIETA_IZQ = "polygon(0% 0%, 50% 0%, 42% 28%, 55% 52%, 44% 78%, 51% 100%, 0% 100%)";
const GRIETA_DER = "polygon(50% 0%, 100% 0%, 100% 100%, 51% 100%, 44% 78%, 55% 52%, 42% 28%)";

/** Hueso partido en dos: mitades separadas y giradas sobre una fractura dentada. */
export default function HuesoRoto({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden>
      <Bone
        className="absolute inset-0 w-full h-full -translate-x-[7%] translate-y-[5%] -rotate-12"
        style={{ clipPath: GRIETA_IZQ }}
      />
      <Bone
        className="absolute inset-0 w-full h-full translate-x-[7%] -translate-y-[5%] rotate-12"
        style={{ clipPath: GRIETA_DER }}
      />
    </span>
  );
}
