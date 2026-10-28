import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Dashboard Title: 30px serif
const h1Variants = cva(
  "font-heading text-h1 font-medium leading-tight"
);

// Page Heading: 24px serif
const h2Variants = cva(
  "font-heading text-h2 font-medium leading-snug"
);

// Section Heading: 20px serif
const h3Variants = cva(
  "font-heading text-h3 font-medium leading-snug"
);

// Card Title – 18px 600
const h4Variants = cva(
  "font-subheading text-h4 font-semibold leading-snug"
);

// Body Text – 14px 400
const textVariants = cva("font-sans text-body", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

// Lead / intro copy – 16px 400
const leadVariants = cva("font-sans text-lead text-muted-foreground");

// Secondary Text – 13px 400
const textSmallVariants = cva("font-sans text-body-sm text-foreground");

// Labels – 12px 500
const captionVariants = cva(
  "font-sans text-caption font-medium text-muted-foreground"
);

// Small Helper Text – 12px 400
const overlineVariants = cva(
  "font-sans text-overline uppercase tracking-wide text-muted-foreground"
);

// KPI Number – 36px 700 (within the 32–48px range)
const numericVariants = cva(
  "font-numeric text-[2.25rem] font-bold tracking-tight leading-none text-foreground"
);

// Display – extra-large hero text, treated as Dashboard Title size
function Display({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 className={cn(h1Variants(), className)} {...props} />;
}

function H1({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 className={cn(h1Variants(), className)} {...props} />;
}

function H2({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn(h2Variants(), className)} {...props} />;
}

function H3({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn(h3Variants(), className)} {...props} />;
}

function H4({ className, ...props }: React.ComponentProps<"h4">) {
  return <h4 className={cn(h4Variants(), className)} {...props} />;
}

function Text({
  className,
  variant,
  ...props
}: React.ComponentProps<"p"> & VariantProps<typeof textVariants>) {
  return (
    <p className={cn(textVariants({ variant }), className)} {...props} />
  );
}

function Lead({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn(leadVariants(), className)} {...props} />;
}

// Secondary text – 13px
function TextSmall({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn(textSmallVariants(), className)} {...props} />;
}

// Labels – 12px 500
function Caption({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn(captionVariants(), className)} {...props} />;
}

function Overline({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn(overlineVariants(), className)} {...props} />;
}

function Muted({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(textVariants({ variant: "muted" }), className)}
      {...props}
    />
  );
}

// KPI Number – 36px 700
function Numeric({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn(numericVariants(), className)} {...props} />
  );
}

export {
  Caption,
  Display,
  H1,
  H2,
  H3,
  H4,
  Lead,
  Muted,
  Numeric,
  Overline,
  Text,
  TextSmall,
  captionVariants,
  h1Variants,
  h2Variants,
  h3Variants,
  h4Variants,
  numericVariants,
  overlineVariants,
  textSmallVariants,
  textVariants,
};
