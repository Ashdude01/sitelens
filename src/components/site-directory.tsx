import { getTranslations } from "next-intl/server";
import { Clock, TrendingUp } from "lucide-react";
import { popularSiteCards, recentSiteCards } from "@/server/repositories/reports";
import { SiteCardGrid } from "@/components/site-card";

/** "Recently analyzed" + "Popular sites", shown above the footer on public pages. Internal links help discovery and SEO. */
export async function SiteDirectory({ exclude }: { exclude?: string }) {
  const [recent, popular] = await Promise.all([recentSiteCards(9), popularSiteCards(9)]);
  const r = recent.filter((s) => s.domain !== exclude).slice(0, 8);
  const p = popular.filter((s) => s.domain !== exclude).slice(0, 8);
  const t = await getTranslations("directory");
  if (!r.length && !p.length) return null;
  return (
    <section aria-label={t("more")} className="bg-muted/30 mt-4 border-t">
      <div className="mx-auto max-w-[1700px] space-y-10 px-4 py-12">
        {p.length > 0 && (
          <div>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <TrendingUp className="text-muted-foreground size-4" /> {t("popular")}
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">{t("popularBody")}</p>
            <SiteCardGrid sites={p} />
          </div>
        )}
        {r.length > 0 && (
          <div>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Clock className="text-muted-foreground size-4" /> {t("recent")}
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">{t("recentBody")}</p>
            <SiteCardGrid sites={r} />
          </div>
        )}
      </div>
    </section>
  );
}
