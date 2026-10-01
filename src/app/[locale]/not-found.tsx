import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("body")}</p>
        <Button asChild>
          <Link href="/">{t("back")}</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
