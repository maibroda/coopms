import { requirePage } from "@/lib/auth/session";
import { getSettings, listLoanProducts } from "@/lib/services/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/forms/settings-form";
import { AddLoanProductForm, ToggleLoanProductButton } from "@/components/forms/loan-product-manager";

export default async function OrganizationSettingsPage() {
  await requirePage("settings.manage");
  const [settings, products] = await Promise.all([getSettings(), listLoanProducts(false)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">
          Cooperative-wide policy — changes here apply immediately to every new loan/purchase request.
        </p>
      </div>

      <SettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle>Loan products</CardTitle>
          <p className="text-xs text-muted-foreground">
            Preset rate/duration combinations Treasurer and Admin can pick from when creating a loan, instead of
            always hand-typing them.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <AddLoanProductForm />
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Rate</TH>
                <TH>Duration</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.id}>
                  <TD>{p.name}</TD>
                  <TD>{Number(p.interestRate)}%</TD>
                  <TD>{p.durationMonths} months</TD>
                  <TD>{p.repaymentType}</TD>
                  <TD>{p.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</TD>
                  <TD>
                    <ToggleLoanProductButton id={p.id} isActive={p.isActive} />
                  </TD>
                </TR>
              ))}
              {products.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                    No loan products yet.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
