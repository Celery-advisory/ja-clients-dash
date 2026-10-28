"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Muted, TextSmall } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export type CoverImageOption = {
  id: string;
  label: string;
  url: string;
  builtin: boolean;
  isDefault: boolean;
  width: number | null;
  height: number | null;
};

type Props = {
  /** Selected image id, or null to use the firm default. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Admins can change the firm default and remove uploads. */
  canManage?: boolean;
};

/**
 * Library of report cover photos. The photo fills the left half of the cover, a
 * portrait slot, so tiles preview that crop.
 */
export function CoverImagePicker({ value, onChange, canManage = false }: Props) {
  const [images, setImages] = useState<CoverImageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/report-images")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setImages(data.images ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the image library");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultImage = images.find((image) => image.isDefault) ?? null;
  const selectedId = value ?? defaultImage?.id ?? null;

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/report-images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImages((prev) => [...prev, data.image]);
      onChange(data.image.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function makeDefault(image: CoverImageOption) {
    setBusyId(image.id);
    setError(null);
    try {
      const res = await fetch(`/api/report-images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change the default");
      setImages((prev) => prev.map((item) => ({ ...item, isDefault: item.id === image.id })));
      if (value === image.id) onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the default");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(image: CoverImageOption) {
    if (!window.confirm(`Remove "${image.label}" from the library?`)) return;
    setBusyId(image.id);
    setError(null);
    try {
      const res = await fetch(`/api/report-images/${image.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove the image");
      setImages((prev) => prev.filter((item) => item.id !== image.id));
      if (value === image.id) onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the image");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <TextSmall className="font-semibold">Cover image</TextSmall>
          <Muted className="text-[12px]">
            Shown on the left half of the report cover. JPEG or PNG, at least 800px wide.
          </Muted>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Upload image
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading library
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {images.map((image) => {
            const selected = image.id === selectedId;
            const busy = busyId === image.id;
            return (
              <div key={image.id} className="group flex min-w-0 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange(image.isDefault ? null : image.id)}
                  aria-pressed={selected}
                  aria-label={`Use ${image.label} as the cover`}
                  className={cn(
                    "relative aspect-[421/595] overflow-hidden rounded-lg border bg-muted outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-brand-primary ring-2 ring-brand-primary"
                      : "border-border hover:border-brand-primary/50",
                  )}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="140px"
                    className="object-cover"
                  />
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                  {busy ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  ) : null}
                </button>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-xs" title={image.label}>
                    {image.label}
                  </span>
                  {image.isDefault ? (
                    <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                      Default
                    </Badge>
                  ) : null}
                </div>
                {canManage && !image.isDefault ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => makeDefault(image)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Star className="size-3" />
                      Make default
                    </button>
                    {!image.builtin ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(image)}
                        aria-label={`Remove ${image.label}`}
                        className="ml-auto inline-flex items-center text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
