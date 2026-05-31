import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[var(--background)] font-sans">
        <div className="text-center">
          <p className="font-serif text-4xl font-semibold tracking-tight">404</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">This page does not exist.</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-navy-50"
          >
            Back to home
          </Link>
        </div>
      </body>
    </html>
  );
}
