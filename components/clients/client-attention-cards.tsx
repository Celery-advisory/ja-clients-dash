"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { ClientContactActions } from "@/components/clients/client-contact-actions";
import { buttonVariants } from "@/components/ui/button";
import { TextSmall } from "@/components/ui/typography";
import type { DocumentRequest, WmSession } from "@/lib/wealth/wm-types";
import { cn } from "@/lib/utils";

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientAttentionCards({
  nextSession,
  pendingDocumentRequest,
}: {
  nextSession: WmSession | null;
  pendingDocumentRequest: DocumentRequest | null;
}) {
  const showSession = nextSession?.scheduled_at;
  const showDoc = pendingDocumentRequest?.status === "pending";

  if (!showSession && !showDoc) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-card px-4 py-4">
          <TextSmall className="text-muted-foreground">Next session</TextSmall>
          <p className="mt-1 text-sm font-medium">Not yet scheduled</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Get in touch with us or your wealth manager to book your first session.
          </p>
          <Link
            href="/clients/dashboard/sessions"
            className={cn(buttonVariants({ size: "sm" }), "mt-3 h-8 bg-brand-primary text-white hover:bg-brand-primary/90")}
          >
            Request a session
          </Link>
        </div>
        <div className="rounded-xl border border-border/40 bg-card px-4 py-4">
          <TextSmall className="text-muted-foreground">Need something added?</TextSmall>
          <p className="mt-1 text-sm font-medium">We are here to help</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Portfolio, goals, documents, or anything else missing? Message us and we will sort it out.
          </p>
          <ClientContactActions className="mt-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border/40 bg-card px-4 py-4">
        <TextSmall className="text-muted-foreground">Next session</TextSmall>
        {showSession ? (
          <>
            <p className="mt-1 text-sm font-medium">{nextSession!.title}</p>
            <TextSmall className="mt-1 text-muted-foreground">
              {formatSessionDate(nextSession!.scheduled_at!)}
            </TextSmall>
            <Link
              href="/clients/dashboard/sessions"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-8")}
            >
              View sessions
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-medium">Not yet scheduled</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Get in touch with us or your wealth manager to book a session.
            </p>
            <Link
              href="/clients/dashboard/sessions"
              className={cn(buttonVariants({ size: "sm" }), "mt-3 h-8 bg-brand-primary text-white hover:bg-brand-primary/90")}
            >
              Request a session
            </Link>
          </>
        )}
      </div>

      {showDoc ? (
        <div className="rounded-xl border border-border/40 bg-card px-4 py-4">
          <TextSmall className="text-muted-foreground">Needs your attention</TextSmall>
          <p className="mt-1 text-sm">{pendingDocumentRequest!.title}</p>
          <Link
            href="/clients/dashboard/documents"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-8")}
          >
            Upload now
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function ClientUpdateNote({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#eddca0] bg-[#fdf6e3] px-3.5 py-3">
      <MessageCircle className="mt-0.5 size-4 shrink-0 text-[#8a6d1a]" aria-hidden />
      <div>
        <p className="text-sm font-medium text-[#5c4a10]">Update from your wealth manager</p>
        <p className="mt-0.5 text-sm text-[#6b5a1f]">
          {body || title}
        </p>
      </div>
    </div>
  );
}
