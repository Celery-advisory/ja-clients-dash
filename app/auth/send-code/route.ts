import { issueLoginOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email/resend";

/**
 * The login form posts here as a plain HTML form rather than a server action. A real
 * form post is what lets browsers remember the email for autofill next time, and it
 * submits on Enter even before the page's JavaScript has loaded.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "").trim();

  // 303 so the browser follows with a GET, as after any form post. The Location is a
  // relative path so the browser stays on the host it used, even behind a proxy.
  const go = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

  if (!email) return go("/login?error=email");

  try {
    const code = await issueLoginOtp(email);
    await sendOtpEmail({ to: email, token: code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send code";
    return go(`/login?${new URLSearchParams({ error: message, email }).toString()}`);
  }

  const params = new URLSearchParams({ email });
  if (next) params.set("next", next);
  return go(`/login/verify?${params.toString()}`);
}
