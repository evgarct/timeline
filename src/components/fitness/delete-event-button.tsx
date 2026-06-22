"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({
  id,
  returnHref,
  label,
  cancelLabel,
  title,
  description,
  failedLabel
}: {
  id: string;
  returnHref: string;
  label: string;
  cancelLabel: string;
  title: string;
  description: string;
  failedLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setPending(false);
      setError(failedLabel);
      return;
    }
    router.push(returnHref);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg">
          <Trash2 data-icon="inline-start" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={(event) => {
            event.preventDefault();
            void remove();
          }} disabled={pending}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
