import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Server-rendered prev/next controls — preserves every other query param, only rewrites `page`. */
export function PaginationControls({
  page,
  totalPages,
  total,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <div className="flex items-center justify-between px-1 py-2 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        ) : (
          <Link href={hrefFor(page - 1)}>
            <Button variant="outline" size="sm">
              Previous
            </Button>
          </Link>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        ) : (
          <Link href={hrefFor(page + 1)}>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
