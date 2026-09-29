import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-2xl font-semibold">That doesn&apos;t look like a domain we can analyze</h1>
        <p className="text-muted-foreground text-sm">Enter a public domain name such as example.com.</p>
        <Button asChild>
          <Link href="/">Back to search</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
