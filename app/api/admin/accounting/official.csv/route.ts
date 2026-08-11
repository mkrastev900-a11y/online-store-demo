import { NextResponse } from "next/server";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { normalizeAccountingPeriod } from "@/lib/internal-accounting";
import { getOfficialAccountingReport } from "@/lib/official-accounting";

function csv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function decimal(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export async function GET(request: Request) {
  const admin = await requireAdminPermissionApi("ACCOUNTING:EXPORT");
  if (!admin) return NextResponse.json({ error: "Нямате право за експорт." }, { status: 403 });

  const url = new URL(request.url);
  const period = normalizeAccountingPeriod(url.searchParams.get("period") || undefined);
  const report = await getOfficialAccountingReport(period);

  const rows = [
    ["Дата на събитието", "Тип", "Референция", "Поръчка", "Клиент", "Плащане", "Регистрирана по ЗДДС при продажбата", "ДДС ставка %", "Сума EUR", "Данъчна основа EUR", "ДДС EUR"],
    ...report.events.map((event) => [
      event.eventDate.toISOString(),
      event.type === "SALE" ? "Продажба" : "Възстановяване",
      event.reference,
      event.orderId,
      event.customerName,
      event.paymentMethod,
      event.vatRegisteredAtSale ? "Да" : "Не",
      event.vatRate,
      decimal(event.type === "REFUND" ? -event.amount : event.amount),
      decimal(event.type === "REFUND" ? -event.taxBase : event.taxBase),
      decimal(event.type === "REFUND" ? -event.vat : event.vat),
    ]),
  ];

  const content = `\uFEFF${rows.map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="store-accounting-events-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
