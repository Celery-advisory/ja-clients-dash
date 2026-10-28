import Link from "next/link";

import {
  DashCard,
  DashCardContent,
} from "@/components/ui/dash-card";
import { TextSmall } from "@/components/ui/typography";

/** Short workflow hint for the book-level Reports page. */
export function GenerateReportsGuide() {
  return (
    <DashCard padding="sm" className="border-brand-primary/20 bg-brand-primary/5">
      <DashCardContent className="gap-3">
        <TextSmall className="font-medium text-foreground">
          Where statement numbers are entered
        </TextSmall>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>
            Open a client from{" "}
            <Link href="/advisors/dashboard/clients" className="font-medium text-foreground underline-offset-4 hover:underline">
              Clients
            </Link>
            .
          </li>
          <li>
            Open the client&apos;s{" "}
            <span className="font-medium text-foreground">Statement data</span> page. Pick a
            month, type previous and current values for each bucket, then save.
          </li>
          <li>
            Click{" "}
            <span className="font-medium text-foreground">Generate report</span> for a
            monthly, quarterly, or annual PDF. It is saved as a draft that only staff can see.
          </li>
          <li>
            Preview the draft below, then{" "}
            <span className="font-medium text-foreground">Publish</span>. The client gets it in
            their portal and an email with the headline numbers. Outstanding statements stay at
            the top of this page until they are published.
          </li>
        </ol>
        <TextSmall className="text-muted-foreground">
          Try the same flow with sample data in{" "}
          <Link
            href="/advisors/dashboard/demo/reports"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Demo gallery → Generate client report
          </Link>
          .
        </TextSmall>
      </DashCardContent>
    </DashCard>
  );
}
