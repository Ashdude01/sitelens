"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { lookupAction, type LookupState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchForm({ size = "default", autoFocus = false, className }: { size?: "default" | "lg"; autoFocus?: boolean; className?: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, { error: null });
  const lg = size === "lg";
  return (
    <form action={action} className={cn("w-full", className)} role="search">
      <div className={cn("flex w-full gap-2", lg && "flex-col sm:flex-row")}>
        <div className="relative flex-1">
          <Search className={cn("text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2", lg ? "size-5" : "size-4")} />
          <Input
            name="q"
            required
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="url"
            aria-label="Domain"
            aria-invalid={!!state.error}
            placeholder={lg ? "example.com" : "Analyze a domain…"}
            className={cn("pl-9", lg && "bg-card h-12 pl-11 text-base md:text-base")}
          />
        </div>
        {lg ? (
          <Button type="submit" size="lg" className="h-12 px-6" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Analyze
          </Button>
        ) : (
          <Button type="submit" size="icon" variant="secondary" disabled={pending} aria-label="Analyze">
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          </Button>
        )}
      </div>
      {state.error && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
