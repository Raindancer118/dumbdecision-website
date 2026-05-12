import type { APIRoute } from 'astro';
import { issueOTP, mailOTP, validateEmail } from '../../../lib/membership';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!validateEmail(email)) {
    return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }

  try {
    const otp = issueOTP(email);
    await mailOTP(email, otp);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'RATE_LIMITED') {
      return Response.json(
        { error: 'Bitte warte eine Minute, bevor du einen neuen Code anforderst.' },
        { status: 429 }
      );
    }
    console.error('OTP send error:', err);
    return Response.json({ error: 'Code konnte nicht gesendet werden.' }, { status: 500 });
  }
};
