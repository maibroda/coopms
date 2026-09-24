import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">You do not have permission to view this page.</p>
      <Link href="/" className="text-primary underline">
        Back home
      </Link>
    </main>
  );
}
