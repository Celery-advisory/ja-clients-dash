"use server";

import { redirect } from "next/navigation";

import { dashboardHomeForRole, isAdvisorRole, isSafeNextPath, ADVISOR_ONBOARDING_PATH } from "@/lib/auth/dashboard-routes";
import { getAdvisorById, getProfileByUserId } from "@/lib/wealth/queries";
import { issueLoginOtp, verifyLoginOtpCode } from "@/lib/auth/otp";
import {
  AdvisorAccessRevokedError,
  ensureWealthProfile,
} from "@/lib/auth/ensure-profile";
import { signInWithEmail } from "@/lib/auth/sign-in-email";
import { sendOtpEmail } from "@/lib/email/resend";

function loginErrorPath(email: string, message: string) {
  const params = new URLSearchParams({ error: message, email });
  return `/login?${params.toString()}`;
}

function verifyErrorPath(email: string, message: string) {
  const params = new URLSearchParams({ error: message, email });
  return `/login/verify?${params.toString()}`;
}

async function deliverLoginOtp(email: string) {
  const code = await issueLoginOtp(email);
  await sendOtpEmail({ to: email, token: code });
}

type SignedInUser = Awaited<ReturnType<typeof signInWithEmail>>;

async function signedInUserFor(email: string): Promise<SignedInUser | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user?.email?.trim().toLowerCase() === email) {
      return user;
    }
  } catch {
    /* no usable session */
  }
  return null;
}

export async function resendLoginOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "").trim();
  if (!email) redirect("/login?error=email");

  try {
    await deliverLoginOtp(email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send code";
    redirect(verifyErrorPath(email, message));
  }

  const params = new URLSearchParams({ email, resent: "1" });
  if (next) params.set("next", next);
  redirect(`/login/verify?${params.toString()}`);
}

export async function verifyLoginOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  if (!email || !token) redirect("/login?error=otp");

  let valid = false;
  try {
    valid = await verifyLoginOtpCode(email, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed";
    redirect(verifyErrorPath(email, message));
  }

  // The same submission can reach the server twice, and the run that loses the
  // race must not report the code as invalid once its twin has already signed in.
  let user: SignedInUser | null = valid ? null : await signedInUserFor(email);

  if (!valid && !user) {
    redirect(verifyErrorPath(email, "Invalid code. Try again."));
  }

  if (!user) {
    try {
      user = await signInWithEmail(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed";
      redirect(verifyErrorPath(email, message));
    }
  }

  let profile;
  try {
    profile = await ensureWealthProfile(user.id, email);
  } catch (error) {
    if (error instanceof AdvisorAccessRevokedError) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase.auth.signOut();
      redirect(loginErrorPath(email, error.message));
    }
    throw error;
  }

  const next = String(formData.get("next") ?? "").trim();
  if (next && isSafeNextPath(next, profile.role)) {
    redirect(next);
  }

  const fullProfile = await getProfileByUserId(user.id);
  if (isAdvisorRole(profile.role) && fullProfile?.advisor_id) {
    const advisor = await getAdvisorById(fullProfile.advisor_id);
    if (advisor && !advisor.onboarding_completed_at) {
      redirect(ADVISOR_ONBOARDING_PATH);
    }
  }

  redirect(dashboardHomeForRole(profile.role));
}

export async function signOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?signedOut=1");
}
