import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { listMembersPaginated } from "@/lib/services/members";
import { naira } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { parsePage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/pagination-controls";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requirePage("member.view");
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const result = await listMembersPaginated(ctx, { q, page, pageSize: DEFAULT_PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">{result.total} member(s)</p>
        </div>
        <div className="flex gap-2">
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, number, department…"
              className="h-9 w-64 rounded-md border border-input bg-card px-3 text-sm"
            />
            <Button variant="outline" type="submit">
              Search
            </Button>
          </form>
          <Link href="/members/import">
            <Button variant="outline">Bulk import</Button>
          </Link>
          <a href="/api/exports/members">
            <Button variant="outline">Export XLSX</Button>
          </a>
          <Link href="/members/new">
            <Button>Add member</Button>
          </Link>
        </div>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Membership #</TH>
              <TH>Full name</TH>
              <TH>Department</TH>
              <TH>Date joined</TH>
              <TH>Monthly contribution</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {result.items.map((m) => (
              <TR key={m.id}>
                <TD>
                  <Link href={`/members/${m.id}`} className="font-medium text-primary underline">
                    {m.membershipNumber}
                  </Link>
                </TD>
                <TD>{m.fullName}</TD>
                <TD>{m.department ?? "—"}</TD>
                <TD>{fmtDate(m.dateJoined)}</TD>
                <TD>{naira(m.monthlyContribution)}</TD>
                <TD>
                  <StatusBadge status={m.status} />
                </TD>
              </TR>
            ))}
            {result.items.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  No members found.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <PaginationControls page={result.page} totalPages={result.totalPages} total={result.total} searchParams={{ q }} />
      </Card>
    </div>
  );
}
