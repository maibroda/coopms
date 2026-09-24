import { requirePage } from "@/lib/auth/session";
import { listApiKeys } from "@/lib/services/apiKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/dates";
import { ApiKeyCreateForm, RevokeKeyButton } from "@/components/forms/api-key-manager";

export default async function ApiKeysPage() {
  const ctx = await requirePage("settings.manage");
  const keys = await listApiKeys(ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">API / ERP Integration</h1>
        <p className="text-sm text-muted-foreground">
          Generate an API key so another system (payroll, ERP, accounting) can pull member balances and the
          payroll deduction schedule from this cooperative.
        </p>
      </div>

      <ApiKeyCreateForm />

      <Card>
        <CardHeader>
          <CardTitle>Active integration endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-4 text-sm">
          <p>
            <code>GET /api/v1/members</code> — every member with current savings/loan/purchase balances
          </p>
          <p>
            <code>GET /api/v1/members/&#123;membershipNumber&#125;</code> — one member&apos;s balances and full monthly
            statement
          </p>
          <p>
            <code>GET /api/v1/deduction-schedule?month=YYYY-MM</code> — that month&apos;s payroll deduction schedule
          </p>
          <p className="pt-2 text-muted-foreground">
            Send the key as <code>Authorization: Bearer &#123;key&#125;</code>. Responses are JSON.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Label</TH>
              <TH>Key</TH>
              <TH>Created</TH>
              <TH>Last used</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {keys.map((k) => (
              <TR key={k.id}>
                <TD>{k.label}</TD>
                <TD>…{k.keyPreview}</TD>
                <TD>{fmtDate(k.createdAt)}</TD>
                <TD>{k.lastUsedAt ? fmtDate(k.lastUsedAt) : "Never"}</TD>
                <TD>{k.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Active</Badge>}</TD>
                <TD>{!k.revokedAt && <RevokeKeyButton id={k.id} />}</TD>
              </TR>
            ))}
            {keys.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  No API keys yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
