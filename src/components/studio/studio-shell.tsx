"use client";

import { MotionConfig, motion } from "motion/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, LayoutDashboard, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AgentLayer } from "./agent/agent-layer";
import { shellTools } from "./agent/shell-tools";
import { UnsavedGuardProvider, useUnsavedGuard } from "./unsaved-guard";
import { useWebMcpTools } from "@/lib/webmcp/use-webmcp";
import type { Locale } from "@/i18n/config";
import { getStudioCopy } from "@/i18n/studio-messages";
import { spatial } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

export function StudioShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <UnsavedGuardProvider>
      <ShellFrame locale={locale}>{children}</ShellFrame>
    </UnsavedGuardProvider>
  );
}

function ShellFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <ShellContent locale={locale}>{children}</ShellContent>
    </QueryClientProvider>
  );
}

function ShellContent({ locale, children }: { locale: Locale; children: ReactNode }) {
  const copy = getStudioCopy(locale);
  const guard = useUnsavedGuard();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<Theme>("system");

  // WebMCP tool handlers are plain functions, so they read the live page and theme from the DOM instead of render state.
  const tools = useMemo(() => shellTools({
    locale,
    copy,
    getContext: () => ({
      pathname: window.location.pathname,
      theme: document.querySelector('[data-surface="studio"]')?.getAttribute("data-theme") ?? "system",
      unsavedChanges: guard?.isDirty() ?? false
    }),
    navigate: (path) => router.push(path),
    onWrite: () => { void queryClient.invalidateQueries({ queryKey: ["studio"] }); }
  }), [locale, copy, guard, router, queryClient]);
  useWebMcpTools(tools);
  const base = `/${locale}/studio`;
  const items = [
    { href: base, label: copy.nav.dashboard, icon: LayoutDashboard, active: pathname === base },
    { href: `${base}/templates`, label: copy.nav.templates, icon: Dumbbell, active: pathname.startsWith(`${base}/templates`) }
  ];

  return (
      <MotionConfig reducedMotion="user">
        <div data-surface="studio" data-theme={theme === "system" ? undefined : theme} className="min-h-dvh lg:pl-20">
          <nav aria-label="Studio" className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-2 border-t border-[var(--s-outline-variant)] bg-[color-mix(in_srgb,var(--s-background)_88%,transparent)] px-3 py-2 backdrop-blur-xl lg:inset-y-0 lg:left-0 lg:right-auto lg:w-20 lg:flex-col lg:justify-start lg:gap-3 lg:border-r lg:border-t-0 lg:px-0 lg:py-6">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={(event) => guard?.confirmLeave(event, copy.builder.leaveConfirm)} aria-current={item.active ? "page" : undefined} className="relative grid w-16 place-items-center gap-0.5 rounded-[var(--s-radius-lg)] py-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
                {item.active ? <motion.span layoutId="studio-nav" transition={spatial.default} className="absolute inset-0 rounded-[var(--s-radius-lg)] bg-[var(--s-primary-container)]" /> : null}
                <item.icon className={cn("relative size-5", item.active ? "text-[var(--s-on-primary-container)]" : "text-[var(--s-on-surface-variant)]")} />
                <span className={cn("relative", item.active ? "text-[var(--s-on-primary-container)]" : "text-[var(--s-on-surface-variant)]")}>{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              aria-label={copy.nav.theme}
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              className="grid size-10 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)] lg:mt-auto"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </nav>
          <main className="pb-20 lg:pb-0">{children}</main>
          <AgentLayer copy={copy} />
        </div>
      </MotionConfig>
  );
}
