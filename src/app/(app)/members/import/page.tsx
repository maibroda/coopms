import { requirePage } from "@/lib/auth/session";
import { BalanceImportForm } from "@/components/forms/balance-import-form";
import { MemberImportForm } from "@/components/forms/member-import-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BulkImportPage() {
  await requirePage("member.manage");

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
            opening balance for that code — re-upload a corrected file to fix a mistake.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <a href="/api/balances/template">
            <Button variant="outline">Download template</Button>
          </a>
          <BalanceImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
