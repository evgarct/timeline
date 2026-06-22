"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { toast } from "sonner";
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
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [pending, setPending] = useState(false);

  async function submitNeonOtp() {
    setPending(true);
    try {
      if (step === "email") {
        const response = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
        if (response.error) throw new Error(response.error.message);
        setStep("otp");
        toast.success(copy.codeSent);
        return;
      }
      const response = await authClient.signIn.emailOtp({ email, otp });
      if (response.error) throw new Error(response.error.message);
      router.push(`/${locale}/today`);
      router.refresh();
    } catch {
      toast.error(copy.authError);
    } finally {
      setPending(false);
    }
  }

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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (configured) void submitNeonOtp();
            else if (email) router.push(`/${locale}/today`);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="auth-email">{copy.email}</FieldLabel>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                disabled={step === "otp" || pending}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            {configured && step === "otp" ? (
              <Field>
                <FieldLabel htmlFor="auth-otp">{copy.otp}</FieldLabel>
                <Input
                  id="auth-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={8}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
              </Field>
            ) : null}
            <Button type="submit" size="lg" disabled={pending}>
              {configured ? (step === "email" ? copy.sendCode : copy.verifyCode) : copy.continue}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
