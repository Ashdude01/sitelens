import Link from "next/link";
import { ScanSearch } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { config } from "@/server/config";

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
            <ScanSearch className="size-4" />
          </span>
          <span className="hidden sm:inline">{config.siteName}</span>
        </Link>
        {showSearch && <SearchForm className="ml-auto max-w-sm" />}
        <nav className={showSearch ? "flex items-center gap-1" : "ml-auto flex items-center gap-1"}>
          <Link href="/technologies" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            Technologies
          </Link>
          <Link href="/methodology" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            Methodology
          </Link>
          <Link href="/docs/api" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            API
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground mt-auto border-t py-6 text-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {config.siteName}: tech stacks with evidence, traffic as honest ranges.
        </p>
        <div className="flex gap-4">
          <Link href="/methodology" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/docs/api" className="hover:text-foreground">
            API
          </Link>
        </div>
      </div>
    </footer>
  );
}
