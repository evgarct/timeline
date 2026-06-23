"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy as CopyIcon, KeyRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Copy } from "@/i18n/messages";
import type { StorageQuota } from "@/domain/storage";
import { formatStorageMegabytes } from "@/domain/storage";
import { seedSchedules } from "@/data/seed";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function SettingsScreen({
  locale,
  copy,
  storageQuota
}: {
  locale: string;
  copy: Copy;
  storageQuota: StorageQuota;
}) {
  const [token, setToken] = useState<string | null>(null);
  const storageText = storageQuota.limitBytes === null
    ? copy.storageUnlimited
    : copy.storageUsed
      .replace("{used}", String(formatStorageMegabytes(storageQuota.usedBytes)))
      .replace("{limit}", String(formatStorageMegabytes(storageQuota.limitBytes)));

  async function createToken() {
    const response = await fetch("/api/mcp/tokens", { method: "POST" });
    const body = await response.json() as { token?: string };
    const nextToken = body.token ?? `ft_dev_${crypto.randomUUID().replaceAll("-", "")}`;
    setToken(nextToken);
  }

  return (
    <main className="app-shell px-4 pb-10">
      <header className="flex min-h-16 items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/${locale}/today`} aria-label="Back"><ArrowLeft /></Link>
        </Button>
        <h1 className="text-lg font-semibold">{copy.settings}</h1>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href={`/${locale}`}>{copy.home}</Link>
        </Button>
      </header>

      <div className="flex flex-col gap-8 pt-4">
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold">{copy.profile}</h2>
          <div className="surface flex flex-col gap-4 rounded-xl p-4">
            <p className="text-sm font-medium">Demo athlete</p>
            <p className="text-xs text-muted-foreground">Europe/Prague · metric units</p>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs font-medium">{copy.storage}</p>
              <p className="mt-1 text-xs text-muted-foreground">{storageText}</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold">{copy.schedule}</h2>
          <div className="surface divide-y overflow-hidden rounded-xl">
            {seedSchedules.map((schedule) => (
              <label key={schedule.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <Checkbox defaultChecked={schedule.enabled} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{schedule.eventType.replace("_", " ")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {schedule.weekdays.join(", ")} · {schedule.intervalWeeks}w
                  </span>
                </span>
                <Check className="text-muted-foreground" />
              </label>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold">{copy.mcp}</h2>
          <div className="surface flex flex-col gap-4 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary"><KeyRound /></span>
              <div>
                <p className="text-sm font-medium">{copy.token}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Developer preview token for your personal MCP client. It is shown only once.
                </p>
              </div>
            </div>
            <Separator />
            {token ? (
              <div className="flex gap-2">
                <Input readOnly value={token} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy token"
                  onClick={async () => {
                    await navigator.clipboard.writeText(token);
                    toast.success("Copied");
                  }}
                >
                  <CopyIcon />
                </Button>
              </div>
            ) : (
              <Button onClick={createToken}>{copy.createToken}</Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
