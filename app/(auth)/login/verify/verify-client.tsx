"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { resendLoginOtp, verifyLoginOtp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { H2 } from "@/components/ui/typography";

function VerifySubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className="w-full bg-brand-accent text-white hover:bg-brand-accent/90"
    >
      {pending ? "Verifying..." : "Verify and continue"}
    </Button>
  );
}

function ResendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="font-medium text-white underline-offset-4 hover:underline disabled:opacity-50"
      disabled={disabled || pending}
    >
      {pending ? "Sending..." : "Resend code"}
    </button>
  );
}

export default function VerifyPageClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const next = searchParams.get("next") ?? "";
  const error = searchParams.get("error");
  const resent = searchParams.get("resent");
  const [token, setToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // The field mounts after the page hydrates and the code input sets itself up on the next
  // tick, so focus it once that has settled; the autoFocus attribute alone does not take.
  useEffect(() => {
    const timer = window.setTimeout(() => codeRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-body-sm text-white/60">Check your inbox</p>
        <H2 className="text-white">Enter your code</H2>
        <p className="mt-1 text-body-sm text-white/50">
          We sent a 6-digit code to {email || "your email"}. It expires in 10 minutes.
        </p>
        {error && (
          <p className="mt-2 text-body-sm text-red-300">
            {error === "otp"
              ? "Invalid code. Try again."
              : error.includes("Too many") || error.includes("60 seconds")
                ? `${error} You can still enter a code from an earlier email below.`
                : error}
          </p>
        )}
        {resent && (
          <p className="mt-2 text-body-sm text-emerald-300">A new code has been sent.</p>
        )}
      </div>

      <form ref={formRef} action={verifyLoginOtp} className="flex flex-col gap-6">
        <input type="hidden" name="email" value={email} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="token" value={token} />

        <InputOTP
          maxLength={6}
          value={token}
          onChange={setToken}
          // Submit as soon as the sixth digit lands (typed, pasted or autofilled), after the
          // hidden token field has picked up the new value.
          onComplete={() => setTimeout(() => formRef.current?.requestSubmit(), 0)}
          ref={codeRef}
          containerClassName="justify-start gap-2"
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="size-12 rounded-lg border-white/20 bg-white/10 text-lg text-white data-[active=true]:border-white/60 data-[active=true]:ring-white/20 dark:bg-white/10"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <VerifySubmitButton disabled={token.length !== 6 || !email} />
      </form>

      <div className="text-body-sm text-white/50">
        <p>
          Didn&apos;t receive a code?{" "}
          <Link
            href="/login"
            className="font-medium text-white underline-offset-4 hover:underline"
          >
            Use a different email
          </Link>
        </p>
        <form action={resendLoginOtp} className="mt-2">
          <input type="hidden" name="email" value={email} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <ResendButton disabled={!email} />
        </form>
      </div>
    </div>
  );
}
