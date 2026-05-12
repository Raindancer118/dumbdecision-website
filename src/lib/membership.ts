import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const APPS_FILE = path.join(DATA_DIR, 'applications.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ExperienceLevel = 'anfaenger' | 'gelegenheit' | 'erfahren' | 'veteran';

export interface MemberData {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
  telefon?: string;
  strasse: string;
  plz: string;
  ort: string;
  discord?: string;
  erfahrung: ExperienceLevel;
  motivation: string;
  aufmerksam?: string;
}

export interface Application {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
  token: string;
  tokenExpiry: string;
  data: MemberData;
}

interface OTPEntry {
  otp: string;
  expiry: string;
  attempts: number;
  sentAt: string;
}

// ── JSON helpers ───────────────────────────────────────────────────────────

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Validation ─────────────────────────────────────────────────────────────

export function validateName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  return /^[\p{L}\p{M}][\p{L}\p{M} '\-]*[\p{L}\p{M}]$|^[\p{L}\p{M}]{2}$/u.test(trimmed);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── OTP ────────────────────────────────────────────────────────────────────

export function issueOTP(email: string): string {
  const otps = readJSON<Record<string, OTPEntry>>(OTPS_FILE, {});
  const key = email.toLowerCase();
  const existing = otps[key];

  // 60-second cooldown between sends
  if (existing && Date.now() - new Date(existing.sentAt).getTime() < 60_000) {
    throw new Error('RATE_LIMITED');
  }

  const otp = crypto.randomInt(100_000, 999_999).toString();
  otps[key] = {
    otp,
    expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0,
    sentAt: new Date().toISOString(),
  };
  writeJSON(OTPS_FILE, otps);
  return otp;
}

export function verifyOTP(email: string, otp: string, consume: boolean): boolean {
  const otps = readJSON<Record<string, OTPEntry>>(OTPS_FILE, {});
  const key = email.toLowerCase();
  const entry = otps[key];
  if (!entry) return false;
  if (new Date(entry.expiry) < new Date()) return false;
  if (entry.attempts >= 5) return false;
  if (entry.otp !== otp) {
    entry.attempts++;
    writeJSON(OTPS_FILE, otps);
    return false;
  }
  if (consume) {
    delete otps[key];
    writeJSON(OTPS_FILE, otps);
  }
  return true;
}

// ── Applications ───────────────────────────────────────────────────────────

export function createApplication(data: MemberData): Application {
  ensureDir();
  const apps = readJSON<Application[]>(APPS_FILE, []);
  const dup = apps.find(
    a => a.data.email.toLowerCase() === data.email.toLowerCase() && a.status !== 'rejected'
  );
  if (dup) throw new Error('EMAIL_EXISTS');

  const app: Application = {
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    token: crypto.randomBytes(32).toString('hex'),
    tokenExpiry: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    data,
  };
  apps.push(app);
  writeJSON(APPS_FILE, apps);
  return app;
}

export function getApplicationByToken(token: string): Application | null {
  return readJSON<Application[]>(APPS_FILE, []).find(a => a.token === token) ?? null;
}

export function updateApplicationStatus(id: string, status: 'approved' | 'rejected'): void {
  const apps = readJSON<Application[]>(APPS_FILE, []);
  const app = apps.find(a => a.id === id);
  if (app) {
    app.status = status;
    app.updatedAt = new Date().toISOString();
    writeJSON(APPS_FILE, apps);
  }
}

// ── Discord ────────────────────────────────────────────────────────────────

export async function createDiscordInvite(): Promise<string | null> {
  const apiUrl    = process.env.BOT_INVITE_API_URL;
  const apiSecret = process.env.BOT_INVITE_API_SECRET;

  if (!apiUrl || !apiSecret) {
    console.warn('BOT_INVITE_API_URL/SECRET nicht konfiguriert — kein Invite generiert.');
    return process.env.DISCORD_INVITE_URL ?? null;
  }

  const res = await fetch(`${apiUrl}/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiSecret}` },
  });

  if (!res.ok) {
    console.error('Invite-API Fehler:', res.status, await res.text());
    return process.env.DISCORD_INVITE_URL ?? null;
  }

  const json = await res.json() as { url?: string };
  return json.url ?? null;
}

// ── Mailer ─────────────────────────────────────────────────────────────────

let _transport: Transporter | null = null;

function mailer(): Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'mx.volantic.de',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _transport;
}

const FROM = () => `"Dumb Decision TTRPG" <${process.env.SMTP_FROM ?? 'kontakt@dumbdecision.de'}>`;

export async function mailOTP(email: string, otp: string): Promise<void> {
  await mailer().sendMail({
    from: FROM(),
    to: email,
    subject: `Dein Bestätigungscode: ${otp}`,
    text: `Dein Code für die Vereinsanmeldung: ${otp}\n\nGültig für 10 Minuten.`,
    html: tplOTP(otp),
  });
}

export async function mailAdminNotification(app: Application, siteUrl: string): Promise<void> {
  const base = siteUrl.replace(/\/$/, '');
  const approve = `${base}/api/membership/approve?token=${app.token}&action=approve`;
  const reject  = `${base}/api/membership/approve?token=${app.token}&action=reject`;
  await mailer().sendMail({
    from: FROM(),
    to: process.env.ADMIN_EMAIL ?? 'vorstand@dumbdecision.de',
    subject: `[DDT] Neue Anmeldung: ${app.data.vorname} ${app.data.nachname}`,
    html: tplAdmin(app, approve, reject),
  });
}

export async function mailSubmissionConfirmation(app: Application): Promise<void> {
  await mailer().sendMail({
    from: FROM(),
    to: app.data.email,
    subject: 'Deine Vereinsanmeldung bei Dumb Decision TTRPG',
    html: tplSubmissionConfirmation(app),
  });
}

export async function mailApproval(app: Application, discordInvite: string | null): Promise<void> {
  await mailer().sendMail({
    from: FROM(),
    to: app.data.email,
    subject: 'Willkommen bei Dumb Decision TTRPG!',
    html: tplApproval(app, discordInvite),
  });
}

export async function mailRejection(app: Application): Promise<void> {
  await mailer().sendMail({
    from: FROM(),
    to: app.data.email,
    subject: 'Deine Bewerbung bei Dumb Decision TTRPG',
    html: tplRejection(app),
  });
}

// ── Email templates ─────────────────────────────────────────────────────────

const LOGO_URL = 'https://dumbdecision.de/logo-color-opt.png';

function base(body: string, subject?: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject ?? 'Dumb Decision TTRPG'}</title>
</head>
<body style="margin:0;padding:0;background-color:#0C0904;font-family:Georgia,'Times New Roman',serif;color:#E2D8C8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0C0904;min-height:100vh;">
    <tr><td align="center" style="padding:2.5rem 1rem 4rem;">

      <!-- Card -->
      <table role="presentation" width="100%" style="max-width:580px;background-color:#110D06;border:1px solid rgba(155,127,90,.25);" cellpadding="0" cellspacing="0">

        <!-- Header with logo -->
        <tr>
          <td style="padding:2.25rem 2.5rem 1.75rem;border-bottom:1px solid rgba(155,127,90,.2);text-align:center;">
            <img src="${LOGO_URL}" alt="Dumb Decision TTRPG" width="160" height="auto"
                 style="display:block;margin:0 auto;max-width:160px;height:auto;" />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:2.25rem 2.5rem;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:1.25rem 2.5rem 1.75rem;border-top:1px solid rgba(155,127,90,.15);text-align:center;">
            <p style="margin:0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#5A4E3C;">
              Dumb Decision TTRPG &nbsp;·&nbsp;
              <a href="mailto:kontakt@dumbdecision.de" style="color:#7A6A56;text-decoration:none;">kontakt@dumbdecision.de</a>
              &nbsp;·&nbsp;
              <a href="https://dumbdecision.de" style="color:#7A6A56;text-decoration:none;">dumbdecision.de</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function sectionLabel(text: string): string {
  return `<p style="margin:0 0 .2rem;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:#9B7F5A;">${text}</p>`;
}

function sectionValue(text: string, extra = ''): string {
  return `<p style="margin:0 0 .9rem;font-size:.92rem;line-height:1.7;color:#E2D8C8;${extra}">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid rgba(155,127,90,.2);margin:1.5rem 0;" />`;
}

const EXP_LABELS: Record<string, string> = {
  anfaenger:  'Anfänger (noch keine Erfahrung)',
  gelegenheit:'Gelegenheitsspieler',
  erfahren:   'Erfahren',
  veteran:    'Veteran',
};

function tplSubmissionConfirmation(app: Application): string {
  const d   = app.data;
  const age = Math.floor((Date.now() - new Date(d.geburtsdatum).getTime()) / (365.25 * 86_400_000));
  const submittedAt = new Date(app.createdAt).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
  return base(`
    <p style="margin:0 0 .3rem;font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:#9B7F5A;">Aufnahmeantrag eingegangen</p>
    <p style="margin:0 0 1.5rem;font-size:1rem;line-height:1.8;color:#C8BBA8;">
      Liebe*r <strong style="color:#E2D8C8;">${d.vorname}</strong>, vielen Dank für deine Anmeldung!
      Dein Antrag ist beim Vorstand eingegangen und wird in Kürze geprüft.
      Du erhältst eine separate E-Mail, sobald eine Entscheidung getroffen wurde.
    </p>

    ${divider()}

    <!-- Antragskopie -->
    <p style="margin:0 0 1rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#9B7F5A;">Deine Angaben (Antragskopie)</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:rgba(155,127,90,.05);border:1px solid rgba(155,127,90,.15);margin-bottom:1.75rem;">
      <tr><td style="padding:1.25rem 1.5rem;">
        ${sectionLabel('Name')}${sectionValue(`${d.vorname} ${d.nachname}`)}
        ${sectionLabel('Geburtsdatum')}${sectionValue(`${new Date(d.geburtsdatum).toLocaleDateString('de-DE')} (${age} Jahre)`)}
        ${sectionLabel('Adresse')}${sectionValue(`${d.strasse}, ${d.plz} ${d.ort}`)}
        ${sectionLabel('E-Mail')}${sectionValue(d.email)}
        ${d.telefon ? sectionLabel('Telefon') + sectionValue(d.telefon) : ''}
        ${d.discord ? sectionLabel('Discord') + sectionValue(d.discord) : ''}
        ${sectionLabel('TTRPG-Erfahrung')}${sectionValue(EXP_LABELS[d.erfahrung] ?? d.erfahrung)}
        ${sectionLabel('Motivation')}${sectionValue(d.motivation, 'white-space:pre-wrap;')}
      </td></tr>
    </table>

    ${divider()}

    <!-- Mitgliedsvertrag -->
    <p style="margin:0 0 1rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#9B7F5A;">Mitgliedsvertrag — Dumb Decision TTRPG e.V.</p>

    <p style="margin:0 0 .75rem;font-size:.88rem;line-height:1.8;color:#C8BBA8;">
      Mit der Unterzeichnung dieses Antrags erkläre ich mich bereit, Mitglied im Verein
      <strong style="color:#E2D8C8;">Dumb Decision TTRPG e.V.</strong> (in Gründung) zu werden
      und erkenne die Vereinssatzung in ihrer jeweils gültigen Fassung an.
    </p>

    <p style="margin:0 0 .4rem;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#9B7F5A;">Mitgliedsbeitrag</p>
    <p style="margin:0 0 .75rem;font-size:.88rem;line-height:1.8;color:#C8BBA8;">
      Derzeit werden <strong style="color:#E2D8C8;">keine Mitgliedsbeiträge</strong> erhoben.
      Der Verein behält sich vor, Beiträge zu einem späteren Zeitpunkt einzuführen.
      Die Höhe wird von der Mitgliederversammlung beschlossen und rechtzeitig bekanntgegeben.
    </p>

    <p style="margin:0 0 .4rem;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#9B7F5A;">Kündigung</p>
    <p style="margin:0 0 .75rem;font-size:.88rem;line-height:1.8;color:#C8BBA8;">
      Die Mitgliedschaft kann jederzeit <strong style="color:#E2D8C8;">zum Ende des laufenden Monats</strong>
      durch formlose E-Mail an
      <a href="mailto:vorstand@dumbdecision.de" style="color:#9B7F5A;text-decoration:none;">vorstand@dumbdecision.de</a> gekündigt werden.
    </p>

    <p style="margin:0 0 .4rem;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#9B7F5A;">Sonderkündigungsrecht</p>
    <p style="margin:0 0 .75rem;font-size:.88rem;line-height:1.8;color:#C8BBA8;">
      Werden Mitgliedsbeiträge neu eingeführt oder erhöht, besteht ein
      <strong style="color:#E2D8C8;">Sonderkündigungsrecht</strong>:
      Die Kündigung ist in diesem Fall bis zum Ende des übernächsten Monats nach Bekanntgabe möglich,
      mit Wirkung zum selben Termin.
    </p>

    ${divider()}

    <p style="margin:0;font-size:.78rem;color:#5A4E3C;">
      Antrag eingegangen: ${submittedAt} &nbsp;·&nbsp; Antrags-ID: ${app.id.slice(0, 8).toUpperCase()}
    </p>
  `, 'Deine Vereinsanmeldung bei Dumb Decision TTRPG');
}

function tplOTP(otp: string): string {
  return base(`
    <p style="margin:0 0 1rem;font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:#9B7F5A;">Bestätigung der E-Mail-Adresse</p>
    <p style="margin:0 0 1.25rem;font-size:1rem;line-height:1.8;color:#C8BBA8;">
      Du hast eine Mitgliedschaftsanfrage bei <strong style="color:#E2D8C8;">Dumb Decision TTRPG</strong> gestartet.
      Bitte bestätige deine E-Mail-Adresse mit folgendem Code:
    </p>

    <!-- OTP block -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:1.75rem 0;">
      <tr>
        <td align="center" style="background:rgba(201,146,42,.07);border:1px solid rgba(201,146,42,.3);padding:1.75rem 2rem;">
          <p style="margin:0 0 .5rem;font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:#9B7F5A;">Dein Code</p>
          <p style="margin:0;font-size:2.8rem;letter-spacing:.55em;color:#C9922A;font-family:Georgia,serif;font-weight:normal;">${otp}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:.85rem;line-height:1.75;color:#7A6A56;">
      Gültig für <strong style="color:#9B7F5A;">10 Minuten</strong>.
      Falls du keine Anmeldung gestartet hast, ignoriere diese E-Mail.
    </p>
  `, `Bestätigungscode: ${otp}`);
}

function tplAdmin(app: Application, approve: string, reject: string): string {
  const d = app.data;
  const age = Math.floor((Date.now() - new Date(d.geburtsdatum).getTime()) / (365.25 * 86_400_000));
  return base(`
    <p style="margin:0 0 .3rem;font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:#9B7F5A;">Neue Mitgliedsanfrage</p>
    <p style="margin:0 0 1.5rem;font-size:1.1rem;color:#E2D8C8;">
      ${d.vorname} ${d.nachname}
      <span style="font-size:.85rem;color:#7A6A56;margin-left:.5rem;">(${age} Jahre)</span>
    </p>

    <!-- Data grid -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:rgba(155,127,90,.05);border:1px solid rgba(155,127,90,.15);padding:0;margin-bottom:1.5rem;">
      <tr>
        <td style="padding:1.25rem 1.5rem;">
          ${sectionLabel('E-Mail')}${sectionValue(d.email)}
          ${d.telefon ? sectionLabel('Telefon') + sectionValue(d.telefon) : ''}
          ${sectionLabel('Adresse')}${sectionValue(`${d.strasse}, ${d.plz} ${d.ort}`)}
          ${d.discord ? sectionLabel('Discord') + sectionValue(d.discord) : ''}
          ${sectionLabel('Geburtsdatum')}${sectionValue(`${new Date(d.geburtsdatum).toLocaleDateString('de-DE')} · ${age} Jahre`)}
          ${sectionLabel('TTRPG-Erfahrung')}${sectionValue(EXP_LABELS[d.erfahrung] ?? d.erfahrung)}
          ${d.aufmerksam ? sectionLabel('Aufmerksam geworden durch') + sectionValue(d.aufmerksam) : ''}
          ${sectionLabel('Motivation')}${sectionValue(d.motivation, 'white-space:pre-wrap;')}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 1.25rem;font-size:.8rem;color:#5A4E3C;">
      Eingegangen: ${new Date(app.createdAt).toLocaleString('de-DE')} &nbsp;·&nbsp; Entscheidung innerhalb von 30 Tagen erbeten.
    </p>

    <!-- Action buttons -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:.75rem;">
          <a href="${approve}" style="display:inline-block;padding:.75rem 1.75rem;text-decoration:none;font-family:Arial,sans-serif;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;border:1px solid #3a8a3a;color:#6aba6a;background:rgba(42,122,42,.1);">✓ &nbsp;Aufnehmen</a>
        </td>
        <td>
          <a href="${reject}" style="display:inline-block;padding:.75rem 1.75rem;text-decoration:none;font-family:Arial,sans-serif;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;border:1px solid #8a3a3a;color:#ba6a6a;background:rgba(122,42,42,.1);">✗ &nbsp;Ablehnen</a>
        </td>
      </tr>
    </table>
    <p style="margin:.75rem 0 0;font-size:.72rem;color:#5A4E3C;">Links sind 30 Tage gültig.</p>
  `, `[DDT] Neue Anmeldung: ${d.vorname} ${d.nachname}`);
}

function tplApproval(app: Application, invite: string | null): string {
  return base(`
    <p style="margin:0 0 .3rem;font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:#C9922A;">Willkommen im Verein</p>
    <p style="margin:0 0 1.5rem;font-size:1.15rem;line-height:1.6;color:#E2D8C8;">
      Liebe*r <strong>${app.data.vorname}</strong>,
    </p>
    <p style="margin:0 0 1rem;font-size:.95rem;line-height:1.8;color:#C8BBA8;">
      wir freuen uns sehr, dich als neues Mitglied bei
      <strong style="color:#E2D8C8;">Dumb Decision TTRPG</strong> begrüßen zu dürfen!
      Deine Bewerbung wurde vom Vorstand geprüft und angenommen.
    </p>

    ${divider()}

    <p style="margin:0 0 .5rem;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#9B7F5A;">Nächster Schritt</p>
    <p style="margin:0 0 1rem;font-size:.95rem;line-height:1.8;color:#C8BBA8;">
      Tritt jetzt unserem Discord-Server bei, um Teil der Community zu werden und dich vorzustellen.
      Dein persönlicher Einladungslink:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:1.25rem 0;">
      <tr>
        <td align="center" style="padding-bottom:.75rem;">
          ${invite
            ? `<a href="${invite}"
                  style="display:inline-block;padding:.85rem 2.25rem;text-decoration:none;font-family:Arial,sans-serif;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;border:1px solid #9B7F5A;color:#E2D8C8;background:rgba(155,127,90,.15);">
                 Discord beitreten &nbsp;↗
               </a>`
            : `<p style="margin:0;font-size:.9rem;color:#7A6A56;">Der Discord-Einladungslink wird dir separat zugesandt.</p>`
          }
        </td>
      </tr>
      <tr>
        <td align="center">
          <a href="https://chat.whatsapp.com/ERdM3Lo2KFm1c09xEZPX6O"
             style="display:inline-block;padding:.85rem 2.25rem;text-decoration:none;font-family:Arial,sans-serif;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;border:1px solid #4a7a4a;color:#8fca8f;background:rgba(74,122,74,.12);">
            WhatsApp-Gruppe &nbsp;↗
          </a>
        </td>
      </tr>
    </table>
    ${invite ? `<p style="margin:0 0 1rem;font-size:.8rem;color:#7A6A56;text-align:center;">Der Discord-Link ist einmalig und für 7 Tage gültig.</p>` : ''}

    ${divider()}

    <p style="margin:0 0 .5rem;font-size:.92rem;line-height:1.8;color:#C8BBA8;">
      Bei Fragen erreichst du uns jederzeit unter
      <a href="mailto:kontakt@dumbdecision.de" style="color:#9B7F5A;text-decoration:none;">kontakt@dumbdecision.de</a>.
    </p>
    <p style="margin:1.5rem 0 0;font-size:.92rem;font-style:italic;color:#9B7F5A;line-height:1.7;">
      Tom, Dominik &amp; Tobi<br/>
      <span style="font-style:normal;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#5A4E3C;">Vorstand · Dumb Decision TTRPG</span>
    </p>
  `, 'Willkommen bei Dumb Decision TTRPG!');
}

function tplRejection(app: Application): string {
  return base(`
    <p style="margin:0 0 1.5rem;font-size:1rem;line-height:1.6;color:#E2D8C8;">
      Liebe*r <strong>${app.data.vorname}</strong>,
    </p>
    <p style="margin:0 0 1rem;font-size:.95rem;line-height:1.8;color:#C8BBA8;">
      vielen Dank für dein Interesse an <strong style="color:#E2D8C8;">Dumb Decision TTRPG</strong>
      und dafür, dass du dir die Zeit genommen hast, dich bei uns zu bewerben.
    </p>
    <p style="margin:0 0 1.5rem;font-size:.95rem;line-height:1.8;color:#C8BBA8;">
      Nach eingehender Prüfung durch unseren Vorstand müssen wir dir leider mitteilen,
      dass wir deine Bewerbung zum jetzigen Zeitpunkt nicht annehmen können.
    </p>

    ${divider()}

    <p style="margin:0 0 .5rem;font-size:.92rem;line-height:1.8;color:#C8BBA8;">
      Solltest du Fragen haben oder mehr Informationen wünschen, erreichst du uns unter
      <a href="mailto:kontakt@dumbdecision.de" style="color:#9B7F5A;text-decoration:none;">kontakt@dumbdecision.de</a>.
    </p>
    <p style="margin:1.5rem 0 0;font-size:.92rem;font-style:italic;color:#9B7F5A;line-height:1.7;">
      Tom, Dominik &amp; Tobi<br/>
      <span style="font-style:normal;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#5A4E3C;">Vorstand · Dumb Decision TTRPG</span>
    </p>
  `, 'Deine Bewerbung bei Dumb Decision TTRPG');
}
