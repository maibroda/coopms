import { requirePage } from "@/lib/auth/session";
import { listAuditLog } from "@/lib/services/auditLog";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export default async function AuditLogPage() {
  const ctx = await requirePage("audit.view");
  const entries = await listAuditLog(ctx, { take: 200 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only record of every balance-changing and approval action. Most recent 200 entries.
        </p>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
            </TR>
          </THead>
          <TBody>
            {entries.map((e) => (
              <TR key={e.id}>
                <TD>{e.createdAt.toLocaleString("en-NG")}</TD>
                <TD>{e.actorName}</TD>
                <TD>{e.action.replace(/_/g, " ")}</TD>
                <TD>
                  {e.entityType} · {e.entityId.slice(0, 10)}…
                </TD>
              </TR>
            ))}
            {entries.length === 0 && (
              <TR>
                <TD colSpan={4} className="py-8 text-center text-muted-foreground">
                  No activity recorded yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
