import { requirePage } from "@/lib/auth/session";
import { BalanceImportForm } from "@/components/forms/balance-import-form";
import { MemberImportForm } from "@/components/forms/member-import-form";
import { listBalanceImports } from "@/lib/services/balances";
import { naira } from "@/lib/money";
import { fmtDate, periodName } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export default async function BulkImportPage() {
  const ctx = await requirePage("member.manage");
  const imports = await listBalanceImports(ctx);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Bulk import</h1>
        <p className="text-sm text-muted-foreground">Onboard new members or bring forward balances from a spreadsheet.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New members</CardTitle>
          <p className="text-xs text-muted-foreground">
            Creates new member records — the same as filling in &quot;Add member&quot; one at a time, done in bulk.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <a href="/api/members/import-template">
            <Button variant="outline">Download template</Button>
          </a>
          <MemberImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening balances</CardTitle>
          <p className="text-xs text-muted-foreground">
            Bring forward existing savings and loan balances from manual records, for members already in the
            system. Columns: ID No, Names, Code (SAVINGS or LOAN), Amount. Uploading sets each member&apos;s
            opening balance for that code — re-upload a corrected file to fix a mistake. For a LOAN row, add
            Rate %, Remaining Months and Loan Start Month to bring it forward as its own loan with a real
            repayment period instead of a single lump balance — a member can have several such rows, each
            becoming its own loan, and any one of them can be corrected afterwards from the Loans page
            (&quot;Admin adjust&quot;) without affecting the others.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <a href="/api/balances/template">
            <Button variant="outline">Download template</Button>
          </a>
          <BalanceImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening balance import history</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every balance upload, with the period those balances were as of — so it&apos;s always clear which
            upload a member&apos;s opening balance came from and what point in time it represents.
          </p>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Uploaded</TH>
              <TH>Balances as of</TH>
              <TH>File</TH>
              <TH>Rows</TH>
              <TH>Applied</TH>
              <TH>Failed</TH>
              <TH>Total applied (₦)</TH>
            </TR>
          </THead>
          <TBody>
            {imports.map((imp) => {
              const applied = imp.rows.filter((r) => r.status === "APPLIED");
              const failed = imp.rows.filter((r) => r.status === "FAILED");
              const totalApplied = applied.reduce((a, r) => a + Number(r.amount), 0);
              return (
                <TR key={imp.id}>
                  <TD>{fmtDate(imp.createdAt)}</TD>
                  <TD>{periodName(imp.asOfDate)}</TD>
                  <TD>{imp.fileName}</TD>
                  <TD>{imp.rows.length}</TD>
                  <TD>{applied.length}</TD>
                  <TD className={failed.length > 0 ? "text-destructive" : undefined}>{failed.length}</TD>
                  <TD>{naira(totalApplied)}</TD>
                </TR>
              );
            })}
            {imports.length === 0 && (
              <TR>
                <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                  No balance imports yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
