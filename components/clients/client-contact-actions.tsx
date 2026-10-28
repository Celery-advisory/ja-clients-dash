import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type ClientContactActionsProps = {
  className?: string;
  primaryClassName?: string;
  onDark?: boolean;
};

export function ClientContactActions({
  className,
  primaryClassName,
  onDark = false,
}: ClientContactActionsProps) {
  const { messages, advisor } = appConfig.routes.client;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Link
        href={messages}
        className={cn(
          buttonVariants({ size: "sm" }),
          "h-8 bg-brand-primary text-white hover:bg-brand-primary/90",
          primaryClassName,
        )}
      >
        Send a message
      </Link>
      <Link
        href={advisor}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8",
          onDark && "border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white",
        )}
      >
        Your advisor
      </Link>
    </div>
  );
}
