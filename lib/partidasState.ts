export async function syncPartidasInProgress(db: any): Promise<void> {
  const nowIso = new Date().toISOString();

  const { error } = await db
    .from("partidas")
    .update({ estado: "en_progreso" })
    .eq("estado", "abierta")
    .not("inicio_en", "is", null)
    .lte("inicio_en", nowIso);

  if (error) {
    throw new Error(error.message ?? "No se pudo sincronizar estado de partidas");
  }
}
