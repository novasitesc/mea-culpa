import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { previewMassTax } from "@/lib/adminTax";

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { amount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const parsedAmount = Number(body.amount ?? 0);
  const amount = Number.isFinite(parsedAmount) ? Math.floor(parsedAmount) : NaN;

  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount debe ser un entero mayor que 0" }, { status: 400 });
  }

  try {
    const data = await previewMassTax({
      db: session.db,
      amount,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar la vista previa de impuestos",
      },
      { status: 500 },
    );
  }
}
