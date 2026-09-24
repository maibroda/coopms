"use client";
import { useActionState } from "react";
import { importBalancesAction } from "@/app/actions/balances";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { naira } from "@/lib/money";

export function BalanceImportForm() {
  const [state, action, pending] = useActionState(importBalancesAction, undefined);

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Excel file (.xlsx)</label>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state?.result && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm">
              {state.result.total} row(s) processed — <strong>{state.result.applied} applied</strong>,{" "}
              {state.result.failed > 0 ? <strong className="text-destructive">{state.result.failed} failed</strong> : "0 failed"}.
            </p>
            <Table>
              <THead>
                <TR>
                  <TH>Row</TH>
                  <TH>ID No</TH>
                  <TH>Name in file</TH>
                  <TH>Code</TH>
                  <TH>Amount</TH>
                  <TH>Result</TH>
                </TR>
              </THead>
              <TBody>
                {state.result.rows.map((r) => (
                  <TR key={r.rowNumber}>
                    <TD>{r.rowNumber}</TD>
                    <TD>{r.membershipNumber}</TD>
                    <TD>{r.fullNameInFile || "—"}</TD>
                    <TD>{r.code}</TD>
                    <TD>{naira(r.amount)}</TD>
                    <TD className={r.status === "FAILED" ? "text-destructive" : "text-emerald-700"}>
                      {r.status}
                      {r.message ? ` — ${r.message}` : ""}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
