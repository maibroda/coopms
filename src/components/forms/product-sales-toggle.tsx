"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductSalesOpenAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ProductSalesToggle({ open }: { open: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {open ? <Badge tone="green">Open</Badge> : <Badge tone="gray">Closed</Badge>}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setProductSalesOpenAction(!open);
            router.refresh();
          })
        }
      >
        {pending ? "…" : open ? "Close Product Sales" : "Open Product Sales"}
      </Button>
    </div>
  );
}
