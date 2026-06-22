"use client";

import { useRef, useState } from "react";
import { Camera, Images, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import type { EventType, InBodyMetric, TimelineEvent } from "@/domain/events";
import { parseInBodyText } from "@/domain/inbody-parser";
import type { Copy } from "@/i18n/messages";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const titles: Record<EventType, keyof Pick<Copy, "workout" | "measurements" | "progressPhoto" | "inbody">> = {
  workout: "workout",
  measurements: "measurements",
  progress_photo: "progressPhoto",
  inbody: "inbody"
};

export function EventComposer({
  type,
  copy,
  userId,
  onClose,
  onSaved
}: {
  type: EventType | null;
  copy: Copy;
  userId: string;
  onClose: () => void;
  onSaved: (event: TimelineEvent) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [metrics, setMetrics] = useState<InBodyMetric[]>([]);
  const [ocrPending, setOcrPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [muscleGroup, setMuscleGroup] = useState("Push");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, number | undefined>>({});

  async function runOcr(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.info("PDF is stored as the original. Use the MCP agent for structured extraction.");
      return;
    }
    setOcrPending(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();
      setMetrics(parseInBodyText(result.data.text));
    } catch {
      toast.error("Could not recognize this report. You can enter values manually.");
    } finally {
      setOcrPending(false);
    }
  }

  function chooseFiles(selected: FileList | null) {
    const next = selected ? Array.from(selected) : [];
    setFiles(next);
    if (type === "inbody" && next[0]) void runOcr(next[0]);
  }

  async function save() {
    if (!type) return;
    setSavePending(true);
    try {
      const blobs: Array<{ pathname: string; url: string }> = [];
      if (files.length) {
        const uploaded = await Promise.all(files.map(async (file) => {
          const pathname = `users/${userId}/${type}/${crypto.randomUUID()}-${file.name}`;
          try {
            const blob = await upload(pathname, file, {
              access: "private",
              handleUploadUrl: "/api/uploads",
              multipart: file.size > 4 * 1024 * 1024
            });
            return { pathname: blob.pathname, url: `/api/media?pathname=${encodeURIComponent(blob.pathname)}` };
          } catch (error) {
            if (process.env.NODE_ENV === "production") throw error;
            return { pathname: URL.createObjectURL(file), url: URL.createObjectURL(file) };
          }
        }));
        blobs.push(...uploaded);
      }

      const base = {
        id: crypto.randomUUID(),
        occurredAt: new Date(occurredAt),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        note: note || undefined
      };
      let event: TimelineEvent;
      if (type === "workout") {
        event = { ...base, type, completed: true, muscleGroups: [muscleGroup] };
      } else if (type === "measurements") {
        const values = Object.fromEntries(Object.entries(measurements).filter(([, value]) => value !== undefined));
        if (!Object.keys(values).length) throw new Error("measurement-required");
        event = { ...base, type, values };
      } else if (type === "progress_photo") {
        if (!blobs.length) throw new Error("photo-required");
        event = {
          ...base,
          type,
          photos: blobs.map((blob, index) => ({
            id: crypto.randomUUID(),
            url: blob.url,
            originalUrl: blob.pathname,
            alt: `Progress photo ${index + 1}`
          }))
        };
      } else {
        if (!blobs[0] || !files[0] || !metrics.length) throw new Error("inbody-required");
        event = {
          ...base,
          type,
          source: {
            url: blobs[0].pathname,
            mimeType: files[0].type as "application/pdf" | "image/heic" | "image/heif" | "image/jpeg" | "image/png",
            fileName: files[0].name
          },
          metrics,
          extraction: { method: "local_ocr", reviewed: true }
        };
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event)
      });
      if (!response.ok) throw new Error("event-save-failed");
      const saved = await response.json() as TimelineEvent;
      onSaved({ ...saved, occurredAt: new Date(saved.occurredAt) } as TimelineEvent);
      toast.success(copy.completed);
      setFiles([]);
      setMetrics([]);
      onClose();
    } catch {
      toast.error("Upload failed. Check storage configuration and try again.");
    } finally {
      setSavePending(false);
    }
  }

  if (!type) return null;

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{copy[titles[type]]}</DrawerTitle>
          <DrawerDescription>{copy.addEvent}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="occurred-at">{copy.today}</FieldLabel>
              <Input id="occurred-at" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </Field>

            {type === "workout" ? (
              <Field>
                <FieldLabel htmlFor="muscle-group">{copy.workout}</FieldLabel>
                <Select value={muscleGroup} onValueChange={setMuscleGroup}>
                  <SelectTrigger id="muscle-group"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {["Push", "Pull", "Legs", "Chest", "Upper"].map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {type === "measurements" ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["weightKg", "Weight, kg"],
                  ["waistCm", "Waist, cm"],
                  ["chestCm", "Chest, cm"],
                  ["neckCm", "Neck, cm"],
                  ["leftBicepCm", "Left bicep, cm"],
                  ["rightBicepCm", "Right bicep, cm"],
                  ["leftThighCm", "Left thigh, cm"],
                  ["rightThighCm", "Right thigh, cm"],
                  ["leftCalfCm", "Left calf, cm"],
                  ["rightCalfCm", "Right calf, cm"]
                ].map(([key, label]) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`measurement-${key}`}>{label}</FieldLabel>
                    <Input
                      id={`measurement-${key}`}
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value ? Number(event.target.value.replace(",", ".")) : undefined;
                        setMeasurements((current) => ({ ...current, [key]: value }));
                      }}
                    />
                  </Field>
                ))}
              </div>
            ) : null}

            {type === "progress_photo" || type === "inbody" ? (
              <Field>
                <FieldLabel>{type === "inbody" ? copy.uploadReport : copy.progressPhoto}</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="lg" onClick={() => galleryRef.current?.click()}>
                    <Images data-icon="inline-start" />
                    {copy.photos}
                  </Button>
                  <Button type="button" variant="outline" size="lg" onClick={() => cameraRef.current?.click()}>
                    <Camera data-icon="inline-start" />
                    {copy.camera}
                  </Button>
                </div>
                <input
                  ref={galleryRef}
                  className="sr-only"
                  type="file"
                  accept={type === "inbody" ? "image/heic,image/heif,image/jpeg,image/png,application/pdf" : "image/heic,image/heif,image/jpeg,image/png"}
                  multiple={type === "progress_photo"}
                  onChange={(event) => chooseFiles(event.target.files)}
                />
                <input
                  ref={cameraRef}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => chooseFiles(event.target.files)}
                />
                {files.length ? (
                  <p className="text-xs text-muted-foreground">{files.map((file) => file.name).join(", ")}</p>
                ) : null}
              </Field>
            ) : null}

            {type === "inbody" && (ocrPending || metrics.length) ? (
              <Field>
                <FieldLabel>{copy.reviewReport}</FieldLabel>
                {ocrPending ? (
                  <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                    <LoaderCircle className="animate-spin" />
                    Local OCR…
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {metrics.map((metric) => (
                      <div key={metric.key} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                        <span className="text-sm">{metric.label}</span>
                        <Input defaultValue={`${metric.value}`} aria-label={metric.label} />
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="note">{copy.note}</FieldLabel>
              <Textarea id="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </FieldGroup>
        </div>
        <DrawerFooter>
          <Button size="lg" onClick={() => void save()} disabled={savePending}>
            {savePending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
            {copy.save}
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
