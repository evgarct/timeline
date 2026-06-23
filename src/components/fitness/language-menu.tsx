"use client";

import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { locales } from "@/i18n/config";

export function LanguageMenu({ locale }: { locale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function changeLocale(nextLocale: string) {
    const nextPath = pathname.replace(/^\/(ru|en|cs)(?=\/|$)/, `/${nextLocale}`);
    router.push(nextPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language">
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => changeLocale(item)}>
            {item.toUpperCase()} {item === locale ? <Check aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
