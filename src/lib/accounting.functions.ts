import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_REPORT_REGIONS, directionFromCity, directionLabel } from "@/lib/staff-scope";
import { normalizeManagerPermissions } from "@/lib/permissions.functions";
import { resolveManagerCityScope } from "@/lib/manager-finance-scope";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

async function assertExportAccess(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return { isAdmin: true as const, cityScope: null as string | null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: perms }, cityScope] = await Promise.all([
    supabaseAdmin.from("manager_permissions").select("*").eq("user_id", ctx.userId).maybeSingle(),
    resolveManagerCityScope(supabaseAdmin, ctx.userId),
  ]);
  const effective = normalizeManagerPermissions(perms ?? undefined);
  if (!effective.can_view_accounting) throw new Error("Forbidden");
  if (!cityScope) throw new Error("Direction manquante — contactez l'administrateur");
  return { isAdmin: false as const, cityScope };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sumMoney(rows: any[], usdKey: string, fcfaKey: string) {
  return rows.reduce(
    (acc, row) => ({ usd: acc.usd + Number(row[usdKey] ?? 0), fcfa: acc.fcfa + Number(row[fcfaKey] ?? 0) }),
    { usd: 0, fcfa: 0 },
  );
}

async function buildCompanyReport(fromInput?: string, toInput?: string, cityScope?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = fromInput ? new Date(fromInput) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = toInput ? new Date(toInput) : new Date();
  to.setHours(23, 59, 59, 999);

  const { data: posList } = await supabaseAdmin.from("points_of_sale").select("id, name, city");
  const scopedPosIds = cityScope
    ? (posList ?? []).filter((p: any) => directionFromCity(p.city) === cityScope).map((p: any) => p.id)
    : null;

  let ordersQuery = supabaseAdmin.from("orders").select("*")
    .gte("created_at", from.toISOString()).lte("created_at", to.toISOString());
  let posSalesQuery = supabaseAdmin.from("pos_sales").select("*")
    .gte("created_at", from.toISOString()).lte("created_at", to.toISOString());
  let wholesaleQuery = supabaseAdmin.from("wholesale_sales").select("*")
    .gte("sold_at", from.toISOString()).lte("sold_at", to.toISOString());
  let expensesQuery = supabaseAdmin.from("staff_expenses").select("*")
    .gte("spent_at", from.toISOString()).lte("spent_at", to.toISOString());

  if (cityScope) {
    ordersQuery = ordersQuery.eq("city_scope", cityScope);
    wholesaleQuery = wholesaleQuery.eq("city_scope", cityScope);
    expensesQuery = expensesQuery.eq("city_scope", cityScope);
    posSalesQuery = scopedPosIds?.length
      ? posSalesQuery.in("pos_id", scopedPosIds)
      : posSalesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const [{ data: orders }, { data: posSales }, { data: wholesale }, { data: expenses }] = await Promise.all([
    ordersQuery,
    posSalesQuery,
    wholesaleQuery,
    expensesQuery,
  ]);

  const posScope = Object.fromEntries((posList ?? []).map((p: any) => [p.id, p.city]));
  const posSalesScoped = (posSales ?? []).map((sale: any) => ({
    ...sale,
    city_scope: directionFromCity(posScope[sale.pos_id]),
  }));

  const deliveredOrders = (orders ?? []).filter((o: any) => o.status === "delivered");
  const revenueRows = [...deliveredOrders, ...posSalesScoped, ...(wholesale ?? [])];
  const totalRevenue = sumMoney(revenueRows, "total_usd", "total_fcfa");
  const totalExpenses = sumMoney(expenses ?? [], "amount_usd", "amount_fcfa");

  const regionStats = cityScope
    ? [{
        region: { key: cityScope, label: directionLabel(cityScope), scopes: [cityScope] as any },
        revenue: totalRevenue,
        expenses: totalExpenses,
        net: { usd: totalRevenue.usd - totalExpenses.usd, fcfa: totalRevenue.fcfa - totalExpenses.fcfa },
        orders: deliveredOrders.length,
        delivered: sumMoney(deliveredOrders, "total_usd", "total_fcfa"),
        pos: sumMoney(posSalesScoped, "total_usd", "total_fcfa"),
        wholesale: sumMoney(wholesale ?? [], "total_usd", "total_fcfa"),
      }]
    : ADMIN_REPORT_REGIONS.map((region) => {
        const scopedDelivered = sumMoney(
          deliveredOrders.filter((row: any) => region.scopes.includes(row.city_scope)),
          "total_usd",
          "total_fcfa",
        );
        const scopedPos = sumMoney(
          posSalesScoped.filter((row: any) => region.scopes.includes(row.city_scope)),
          "total_usd",
          "total_fcfa",
        );
        const scopedWholesale = sumMoney(
          (wholesale ?? []).filter((row: any) => region.scopes.includes(row.city_scope)),
          "total_usd",
          "total_fcfa",
        );
        const scopedRevenue = {
          usd: scopedDelivered.usd + scopedPos.usd + scopedWholesale.usd,
          fcfa: scopedDelivered.fcfa + scopedPos.fcfa + scopedWholesale.fcfa,
        };
        const scopedExpenses = sumMoney(
          (expenses ?? []).filter((row: any) => region.scopes.includes(row.city_scope)),
          "amount_usd",
          "amount_fcfa",
        );
        return {
          region,
          delivered: scopedDelivered,
          pos: scopedPos,
          wholesale: scopedWholesale,
          revenue: scopedRevenue,
          expenses: scopedExpenses,
          net: {
            usd: scopedRevenue.usd - scopedExpenses.usd,
            fcfa: scopedRevenue.fcfa - scopedExpenses.fcfa,
          },
          orders: deliveredOrders.filter((row: any) => region.scopes.includes(row.city_scope)).length,
        };
      });

  const transactions: Array<{
    type: string;
    ref: string;
    date: string;
    direction: string;
    client: string;
    usd: number;
    fcfa: number;
    status: string;
  }> = [];

  for (const order of deliveredOrders) {
    transactions.push({
      type: "Commande",
      ref: order.order_number,
      date: new Date(order.created_at).toLocaleDateString("fr-FR"),
      direction: directionLabel(order.city_scope),
      client: order.customer_name ?? "",
      usd: Number(order.total_usd ?? 0),
      fcfa: Number(order.total_fcfa ?? 0),
      status: order.status,
    });
  }
  for (const sale of posSalesScoped) {
    transactions.push({
      type: "POS",
      ref: String(sale.id).slice(0, 8),
      date: new Date(sale.created_at).toLocaleDateString("fr-FR"),
      direction: directionLabel(sale.city_scope),
      client: sale.customer_name ?? "Comptoir",
      usd: Number(sale.total_usd ?? 0),
      fcfa: Number(sale.total_fcfa ?? 0),
      status: sale.payment_method ?? "cash",
    });
  }
  for (const sale of wholesale ?? []) {
    transactions.push({
      type: "Gros",
      ref: String(sale.id).slice(0, 8),
      date: new Date(sale.sold_at).toLocaleDateString("fr-FR"),
      direction: directionLabel(sale.city_scope),
      client: sale.customer_name ?? "",
      usd: Number(sale.total_usd ?? 0),
      fcfa: Number(sale.total_fcfa ?? 0),
      status: sale.payment_status ?? "",
    });
  }
  for (const expense of expenses ?? []) {
    transactions.push({
      type: "Dépense",
      ref: String(expense.id).slice(0, 8),
      date: new Date(expense.spent_at).toLocaleDateString("fr-FR"),
      direction: directionLabel(expense.city_scope),
      client: expense.note ?? "",
      usd: Number(expense.amount_usd ?? 0),
      fcfa: Number(expense.amount_fcfa ?? 0),
      status: "dépense",
    });
  }

  const periodLabel = `${from.toLocaleDateString("fr-FR")} — ${to.toLocaleDateString("fr-FR")}`;
  const scopeSuffix = cityScope ? `-${cityScope}` : "";
  const filenameBase = `the-sisters-africa-rapport${scopeSuffix}-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;

  return {
    from,
    to,
    periodLabel,
    filenameBase,
    cityScope: cityScope ?? null,
    cityLabel: cityScope ? directionLabel(cityScope) : null,
    deliveredOrders,
    posSales,
    wholesale,
    totalRevenue,
    totalExpenses,
    net: {
      usd: totalRevenue.usd - totalExpenses.usd,
      fcfa: totalRevenue.fcfa - totalExpenses.fcfa,
    },
    regionStats,
    transactions,
  };
}

function buildCsv(report: Awaited<ReturnType<typeof buildCompanyReport>>) {
  const lines: string[] = [];
  lines.push("Rapport The Sisters Africa");
  if (report.cityLabel) lines.push(`Direction;${report.cityLabel}`);
  lines.push(`Période;${report.from.toLocaleDateString("fr-FR")};${report.to.toLocaleDateString("fr-FR")}`);
  lines.push("");
  lines.push("Section;Indicateur;USD;FCFA");
  lines.push(`Global;Recettes produits;${report.totalRevenue.usd.toFixed(2)};${report.totalRevenue.fcfa}`);
  lines.push(`Global;Dépenses;${report.totalExpenses.usd.toFixed(2)};${report.totalExpenses.fcfa}`);
  lines.push(`Global;Net;${report.net.usd.toFixed(2)};${report.net.fcfa}`);
  lines.push(`Global;Commandes livrées;${report.deliveredOrders.length};`);
  lines.push(`Global;Ventes POS;${(report.posSales ?? []).length};`);
  lines.push(`Global;Ventes en gros;${(report.wholesale ?? []).length};`);
  lines.push("");

  for (const row of report.regionStats) {
    const delivered = (row as any).delivered ?? row.revenue;
    const pos = (row as any).pos ?? { usd: 0, fcfa: 0 };
    const wholesale = (row as any).wholesale ?? { usd: 0, fcfa: 0 };
    lines.push(`Région;${row.region.label};Commandes livrées USD;${delivered.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};Commandes livrées FCFA;${delivered.fcfa}`);
    lines.push(`Région;${row.region.label};POS USD;${pos.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};POS FCFA;${pos.fcfa}`);
    lines.push(`Région;${row.region.label};Gros USD;${wholesale.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};Gros FCFA;${wholesale.fcfa}`);
    lines.push(`Région;${row.region.label};Recettes USD;${row.revenue.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};Recettes FCFA;${row.revenue.fcfa}`);
    lines.push(`Région;${row.region.label};Dépenses USD;${row.expenses.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};Dépenses FCFA;${row.expenses.fcfa}`);
    lines.push(`Région;${row.region.label};Net USD;${row.net.usd.toFixed(2)}`);
    lines.push(`Région;${row.region.label};Net FCFA;${row.net.fcfa}`);
  }

  lines.push("");
  lines.push("Type;Référence;Date;Direction;Client;Montant USD;Montant FCFA;Statut");
  for (const tx of report.transactions) {
    lines.push([
      tx.type,
      tx.ref,
      tx.date,
      tx.direction,
      csvEscape(tx.client),
      tx.usd.toFixed(2),
      tx.fcfa,
      tx.status,
    ].join(";"));
  }

  return lines.join("\n");
}

function buildPdfBase64(report: Awaited<ReturnType<typeof buildCompanyReport>>) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("fr-FR");

  doc.setFillColor(62, 39, 35);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 248, 240);
  doc.setFontSize(20);
  doc.text("The Sisters Africa", 14, 16);
  doc.setFontSize(11);
  doc.text(report.cityLabel ? `Rapport comptable — ${report.cityLabel}` : "Rapport comptable entreprise", 14, 24);
  doc.setFontSize(9);
  doc.text(`Période : ${report.periodLabel}`, 14, 30);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(`Généré le ${generatedAt}`, 140, 30);

  autoTable(doc, {
    startY: 42,
    head: [["Indicateur global", "USD", "FCFA"]],
    body: [
      ["Recettes produits", `$${report.totalRevenue.usd.toFixed(2)}`, report.totalRevenue.fcfa.toLocaleString("fr-FR")],
      ["Dépenses", `$${report.totalExpenses.usd.toFixed(2)}`, report.totalExpenses.fcfa.toLocaleString("fr-FR")],
      ["Net", `$${report.net.usd.toFixed(2)}`, report.net.fcfa.toLocaleString("fr-FR")],
      ["Commandes livrées", String(report.deliveredOrders.length), "—"],
      ["Ventes POS", String((report.posSales ?? []).length), "—"],
      ["Ventes en gros", String((report.wholesale ?? []).length), "—"],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [176, 119, 87], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 245, 238] },
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: afterSummary,
    head: [["Région", "Recettes USD", "Recettes FCFA", "Dépenses USD", "Dépenses FCFA", "Net USD", "Net FCFA", "Cmd."]],
    body: report.regionStats.map((row) => [
      row.region.label,
      `$${row.revenue.usd.toFixed(2)}`,
      row.revenue.fcfa.toLocaleString("fr-FR"),
      `$${row.expenses.usd.toFixed(2)}`,
      row.expenses.fcfa.toLocaleString("fr-FR"),
      `$${row.net.usd.toFixed(2)}`,
      row.net.fcfa.toLocaleString("fr-FR"),
      String(row.orders),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [62, 39, 35], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 245, 238] },
  });

  const afterRegions = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setTextColor(62, 39, 35);
  doc.text("Journal des opérations", 14, afterRegions);

  autoTable(doc, {
    startY: afterRegions + 4,
    head: [["Type", "Réf.", "Date", "Direction", "Client / Note", "USD", "FCFA", "Statut"]],
    body: report.transactions.map((tx) => [
      tx.type,
      tx.ref,
      tx.date,
      tx.direction,
      tx.client.slice(0, 40),
      `$${tx.usd.toFixed(2)}`,
      tx.fcfa.toLocaleString("fr-FR"),
      tx.status,
    ]),
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [176, 119, 87], textColor: 255 },
    columnStyles: { 4: { cellWidth: 42 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`The Sisters Africa — page ${i}/${pageCount}`, 14, 290);
    doc.text("Hors frais de livraison (non comptabilisés)", 105, 290, { align: "center" });
  }

  return doc.output("datauristring").split(",")[1] ?? "";
}

export const exportCompanyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const access = await assertExportAccess(context as any);
    const report = await buildCompanyReport(data.from, data.to, access.cityScope);
    return {
      filename: `${report.filenameBase}.csv`,
      csv: buildCsv(report),
      summary: {
        revenue: report.totalRevenue,
        expenses: report.totalExpenses,
        net: report.net,
      },
    };
  });

export const exportCompanyReportPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const access = await assertExportAccess(context as any);
    const report = await buildCompanyReport(data.from, data.to, access.cityScope);
    return {
      filename: `${report.filenameBase}.pdf`,
      pdfBase64: buildPdfBase64(report),
      summary: {
        revenue: report.totalRevenue,
        expenses: report.totalExpenses,
        net: report.net,
      },
    };
  });
