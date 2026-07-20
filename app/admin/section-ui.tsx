"use client";

/**
 * Primitivas visuales compartidas de los módulos del panel admin.
 * Reutilizan el sistema de diseño del "salón de mando" (clases adm-* de
 * globals.css): paneles temáticos por color de acento, halos, grano,
 * stats y un modal renovado. Toda la lógica vive en cada módulo; esto es
 * solo presentación.
 */

import React from "react";

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function accentVars(accent: string): React.CSSProperties {
  return { ["--adm-accent" as string]: accent };
}

// ─── Hero: panel introductorio de cada módulo ────────────────────────────────

export function AdmHero({
  accent,
  icon: Icon,
  title,
  subtitle,
  right,
  children,
}: {
  accent: string;
  icon: IconType;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="adm-panel relative overflow-hidden rounded-xl p-5"
      style={accentVars(accent)}
    >
      <span className="adm-accent-line" aria-hidden />
      <span className="adm-hero-halo" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-4">
        <span
          className="adm-icon-float inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: `${accent}55`, background: `${accent}1a`, color: accent }}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}

// ─── Panel temático genérico ─────────────────────────────────────────────────

export function AdmPanel({
  accent,
  className = "",
  children,
  style,
}: {
  accent?: string;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`adm-panel rounded-xl p-4 ${className}`}
      style={{ ...(accent ? accentVars(accent) : {}), ...style }}
    >
      {children}
    </div>
  );
}

// ─── Encabezado interno de un panel ──────────────────────────────────────────

export function AdmHeading({
  accent,
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  accent: string;
  icon?: IconType;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: `${accent}55`, background: `${accent}1a`, color: accent }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h4 className="font-serif text-sm text-foreground">{title}</h4>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

export function AdmStat({
  label,
  value,
  accent = "#d4af37",
  icon: Icon,
  tone,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  icon?: IconType;
  tone?: string;
  delay?: number;
}) {
  return (
    <div
      className="adm-panel adm-row-in relative overflow-hidden rounded-xl p-3.5"
      style={{ ...accentVars(accent), ["--adm-delay" as string]: `${delay}s` }}
    >
      <span className="adm-stat-glow" aria-hidden />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-3.5 w-3.5" style={{ color: accent }} />}
      </div>
      <p
        className="relative mt-1.5 font-serif text-2xl font-semibold leading-none"
        style={{ color: tone ?? "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Pills temáticas (sub-pestañas) ──────────────────────────────────────────

export type AdmPillTab<T extends string> = { id: T; label: string; icon?: IconType };

export function AdmPills<T extends string>({
  tabs,
  active,
  onChange,
  accent = "#d4af37",
}: {
  tabs: AdmPillTab<T>[];
  active: T;
  onChange: (id: T) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const on = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
              on
                ? ""
                : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            style={
              on
                ? {
                    borderColor: `${accent}66`,
                    background: `${accent}1f`,
                    color: accent,
                    boxShadow: `0 0 18px -8px ${accent}`,
                  }
                : undefined
            }
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
