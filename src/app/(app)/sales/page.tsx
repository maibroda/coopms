import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { listSalesPaginated } from "@/lib/services/sales";
import { naira } from "@/lib/money";
import { periodName } from "@/lib/dates";
import { parsePage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { SaleRowActions } from "@/components/forms/sale-row-actions";
import { PaginationControls } from "@/components/pagination-controls";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await requirePage("sale.view");
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const result = await listSalesPaginated(ctx, { page, pageSize: DEFAULT_PAGE_SIZE });
  const sales = result.items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Product Sales</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} purchase(s) on installment — settled outside the payroll deduction schedule.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/exports/sales">
            <Button variant="outline">Export XLSX</Button>
          </a>
          <Link href="/sales/new">
            <Button>New purchase</Button>
          </Link>
        </div>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Item</TH>
              <TH>Category</TH>
              <TH>Cost</TH>
              <TH>Start</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/members/${s.memberId}`} className="text-primary underline">
                    {s.member.fullName}
                  </Link>
                </TD>
                <TD>{s.itemName}</TD>
                <TD>{s.category}</TD>
                <TD>{naira(s.cost)}</TD>
                <TD>{periodName(s.startMonth)}</TD>
                <TD>{naira(s.monthlyDeduction)}</TD>
                <TD>{naira(s.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={s.status} />
                </TD>
                <TD>
                  <SaleRowActions saleId={s.id} memberId={s.memberId} status={s.status} />
                </TD>
              </TR>
            ))}
            {sales.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-8 text-center text-muted-foreground">
                  No product purchases on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <PaginationControls page={result.page} totalPages={result.totalPages} total={result.total} searchParams={{}} />
      </Card>
    </div>
  );
}
