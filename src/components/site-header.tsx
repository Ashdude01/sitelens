import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ScanSearch } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { config } from "@/server/config";

export async function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  const t = await getTranslations("nav");
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1700px] items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
            <ScanSearch className="size-4" />
          </span>
          <span className="hidden sm:inline">{config.siteName}</span>
        </Link>
        {showSearch && <SearchForm className="ml-auto max-w-sm" />}
        <nav className={showSearch ? "flex items-center gap-1" : "ml-auto flex items-center gap-1"}>
          <Link href="/technologies" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            {t("technologies")}
          </Link>
          <Link href="/methodology" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            {t("methodology")}
          </Link>
          <Link href="/docs/api" className="text-muted-foreground hover:text-foreground hidden px-2 text-sm md:inline">
            {t("api")}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="text-muted-foreground mt-auto border-t py-6 text-sm">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("tagline", { site: config.siteName })}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/methodology" className="hover:text-foreground">
            {t("how")}
          </Link>
          <Link href="/docs/api" className="hover:text-foreground">
            {t("api")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
