import Image from "next/image";
import { ArrowDown, Menu } from "lucide-react";
import { notFound } from "next/navigation";
import { AuthDialog } from "@/components/fitness/auth-dialog";
import { LanguageMenu } from "@/components/fitness/language-menu";
import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { isNeonAuthConfigured } from "@/lib/auth/server";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getMessages(locale);

  return (
    <main className="app-shell relative flex min-h-[100dvh] flex-col overflow-hidden px-5 pb-[calc(1.25rem+var(--safe-bottom))]">
      <header className="flex min-h-16 items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-full border text-xs font-semibold">FT</span>
        <div className="flex items-center gap-1">
          <LanguageMenu locale={locale} />
          <Button variant="ghost" size="icon" aria-label="Menu"><Menu /></Button>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 flex-col pt-12">
        <h1 className="max-w-sm text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.055em]">{copy.hero}</h1>
        <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">{copy.heroBody}</p>
        <div className="mt-auto flex flex-col gap-3 pb-4">
          <AuthDialog copy={copy} locale={locale} configured={isNeonAuthConfigured} triggerLabel={copy.start} />
          <AuthDialog copy={copy} locale={locale} configured={isNeonAuthConfigured} triggerLabel={copy.signIn} />
          <a href="#story" className="mx-auto flex items-center gap-2 py-2 text-xs text-muted-foreground">
            {copy.bodyHistory}
            <ArrowDown />
          </a>
        </div>
      </section>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%]">
        <Image
          src="/demo/progress-back.png"
          alt=""
          fill
          priority
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-cover object-top opacity-82 [mask-image:linear-gradient(to_bottom,transparent,black_32%)]"
        />
      </div>
    </main>
  );
}

