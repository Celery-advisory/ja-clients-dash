import { Resend } from "npm:resend@4.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET")?.replace(/^v1,whsec_/, "");
// Sign-in codes come from auth@ on the verified sending domain, matching lib/email/senders.ts.
const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN")?.trim().replace(/^@/, "");
const fromEmail =
  Deno.env.get("RESEND_FROM_AUTH") ??
  (fromDomain ? `JA Wealth <auth@${fromDomain}>` : undefined) ??
  Deno.env.get("RESEND_FROM_EMAIL") ??
  "JA Wealth <noreply@no-reply.celerey.co>";

type SendEmailHookPayload = {
  user: { email: string };
  email_data: {
    token: string;
    email_action_type: string;
  };
};

function otpEmailHtml(token: string) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <p style="color: #b2936b; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">JA Wealth</p>
      <h1 style="font-size: 24px; color: #202356; margin-bottom: 8px;">Your sign-in code</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #444;">
        Use this one-time code to sign in to your client portal. It expires in 10 minutes.
      </p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 0.3em; color: #202356; margin: 24px 0;">
        ${token}
      </p>
      <p style="font-size: 13px; line-height: 1.5; color: #666;">
        If you did not request this code, you can ignore this email.
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  if (!resendApiKey || !hookSecret) {
    return Response.json(
      { error: "Missing RESEND_API_KEY or SEND_EMAIL_HOOK_SECRET" },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as SendEmailHookPayload;
    const resend = new Resend(resendApiKey);

    const subject =
      email_data.email_action_type === "recovery"
        ? "Reset your JA Wealth password"
        : "Your JA Wealth sign-in code";

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      subject,
      html: otpEmailHtml(email_data.token),
    });

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hook failed";
    return Response.json({ error: message }, { status: 401 });
  }
});
