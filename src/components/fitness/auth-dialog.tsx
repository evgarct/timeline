"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { authClient } from "@/lib/auth/client";
import type { Copy } from "@/i18n/messages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AuthDialog({
  copy,
  locale,
  configured,
  triggerLabel
}: {
  copy: Copy;
  locale: string;
  configured: boolean;
  triggerLabel: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 w-full rounded-xl">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="bottom-[calc(1rem+var(--safe-bottom))] top-auto translate-y-0 rounded-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2">
        <DialogHeader>
          <DialogTitle>{copy.signIn}</DialogTitle>
          <DialogDescription>{copy.email}</DialogDescription>
        </DialogHeader>
        {configured ? (
          <NeonAuthUIProvider authClient={authClient} redirectTo={`/${locale}/today`} emailOTP>
            <AuthView path="sign-in" />
          </NeonAuthUIProvider>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (email) router.push(`/${locale}/today`);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="demo-email">{copy.email}</FieldLabel>
                <Input
                  id="demo-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" size="lg">{copy.continue}</Button>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

