import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { listDeclarations } from "@/lib/services/dividends";
import { can } from "@/lib/auth/permissions";
import { naira } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { DividendDeclarationForm } from "@/components/forms/dividend-declaration-form";

export default async function DividendsPage() {
  const ctx = await requirePage("dividend.view");
  const declarations = await listDeclarations(ctx);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Dividends</h1>
        <p className="text-sm text-muted-foreground">
          Surplus appropriation and per-member dividend declarations, one per financial year.
        </p>
      </div>

      {can(ctx.role, "dividend.manage") && <DividendDeclarationForm existingYears={declarations.map((d) => d.year)} />}

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Year</TH>
              <TH>Declared surplus</TH>
              <TH>Dividend (50% default)</TH>
              <TH>Members</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {declarations.map((d) => (
              <TR key={d.id}>
                <TD>
                  <Link href={`/dividends/${d.id}`} className="text-primary underline">
                    {d.year}
                  </Link>
                </TD>
                <TD>{naira(d.declaredSurplus)}</TD>
                <TD>{naira(d.dividendAmount)}</TD>
                <TD>{d._count.allocations}</TD>
                <TD>
                  <StatusBadge status={d.status} />
                </TD>
              </TR>
            ))}
            {declarations.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                  No dividend declarations yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
