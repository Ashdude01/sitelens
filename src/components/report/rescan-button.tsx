"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { rescanAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RescanButton({ domain }: { domain: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await rescanAction(domain);
            if (res.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {pending ? "Scanning…" : "Re-scan"}
      </Button>
      {error && <p className="text-destructive max-w-60 text-right text-xs">{error}</p>}
    </div>
  );
}
