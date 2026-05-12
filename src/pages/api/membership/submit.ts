import type { APIRoute } from 'astro';
import {
  verifyOTP,
  createApplication,
  mailAdminNotification,
  mailSubmissionConfirmation,
  validateEmail,
  validateName,
  type MemberData,
} from '../../../lib/membership';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const {
    vorname, nachname, geburtsdatum, email, telefon,
    strasse, plz, ort, discord, erfahrung, motivation, aufmerksam, otp,
  } = body;

  // Required field check
  for (const [key, val] of Object.entries({ vorname, nachname, geburtsdatum, email, strasse, plz, ort, erfahrung, motivation, otp })) {
    if (!val || typeof val !== 'string' || !val.trim()) {
      return Response.json({ error: `Pflichtfeld fehlt: ${key}` }, { status: 400 });
    }
  }

  if (!validateName(String(vorname))) {
    return Response.json({ error: 'Bitte gib einen gültigen Vornamen ein.' }, { status: 400 });
  }
  if (!validateName(String(nachname))) {
    return Response.json({ error: 'Bitte gib einen gültigen Nachnamen ein.' }, { status: 400 });
  }
  if (!validateEmail(String(email))) {
    return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }

  const birthDate = new Date(String(geburtsdatum));
  if (isNaN(birthDate.getTime())) {
    return Response.json({ error: 'Ungültiges Geburtsdatum.' }, { status: 400 });
  }
  const ageDays = (Date.now() - birthDate.getTime()) / 86_400_000;
  if (ageDays < 16 * 365.25) {
    return Response.json(
      { error: 'Du musst mindestens 16 Jahre alt sein, um Mitglied zu werden.' },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!verifyOTP(normalizedEmail, String(otp).trim(), true)) {
    return Response.json(
      { error: 'Der Bestätigungscode ist ungültig oder abgelaufen.' },
      { status: 400 }
    );
  }

  const data: MemberData = {
    vorname:    String(vorname).trim(),
    nachname:   String(nachname).trim(),
    geburtsdatum: birthDate.toISOString().split('T')[0]!,
    email:      normalizedEmail,
    telefon:    telefon ? String(telefon).trim() : undefined,
    strasse:    String(strasse).trim(),
    plz:        String(plz).trim(),
    ort:        String(ort).trim(),
    discord:    discord ? String(discord).trim() : undefined,
    erfahrung:  String(erfahrung) as MemberData['erfahrung'],
    motivation: String(motivation).trim(),
    aufmerksam: aufmerksam ? String(aufmerksam).trim() : undefined,
  };

  try {
    const app = createApplication(data);
    const siteUrl = process.env.SITE_URL ?? 'https://dumbdecision.de';
    await Promise.all([
      mailAdminNotification(app, siteUrl),
      mailSubmissionConfirmation(app),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return Response.json(
        { error: 'Mit dieser E-Mail-Adresse liegt bereits eine Anmeldung vor.' },
        { status: 409 }
      );
    }
    console.error('Membership submit error:', err);
    return Response.json({ error: 'Ein unerwarteter Fehler ist aufgetreten.' }, { status: 500 });
  }
};
