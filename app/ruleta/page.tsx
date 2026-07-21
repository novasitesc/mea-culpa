"use client";

// Pantalla de la ruleta (/ruleta). Consulta el estado en GET /api/ruleta/config
// (coste de la siguiente tirada, pagos pendientes) y gira con
// POST /api/profile/ruleta-spin.

import HomePage from "../page";

export default function RuletaPage() {
  return <HomePage forcedSection="ruleta" />;
}
