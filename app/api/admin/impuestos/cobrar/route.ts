import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { executeMassTax } from "@/lib/adminTax";

const REQUIRED_CONFIRMATION = "CONFIRMAR IMPUESTOS";

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  if (session.rolSistema !== "super_admin") {
    return NextResponse.json(
      { error: "Solo un super_admin puede cobrar impuestos" },
      { status: 403 },
    );
  }

  let body: { amount?: unknown; confirmationText?: unknown };
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

  const confirmationText = String(body.confirmationText ?? "")
    .trim()
    .toUpperCase();

  if (confirmationText !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        error: `Debes escribir \"${REQUIRED_CONFIRMATION}\" para ejecutar el cobro`,
      },
      { status: 400 },
    );
  }

  try {
    const data = await executeMassTax({
      db: session.db,
      amount,
      adminId: session.userId,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar el cobro de impuestos",
      },
      { status: 500 },
    );
  }
}
