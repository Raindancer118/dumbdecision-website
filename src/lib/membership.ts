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

function base(body: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/>
<style>
body{margin:0;padding:0;background:#0C0904;color:#E2D8C8;font-family:Georgia,'Times New Roman',serif}
.w{max-width:560px;margin:0 auto;padding:2.5rem 2rem}
.hd{border-bottom:1px solid rgba(155,127,90,.3);padding-bottom:1.25rem;margin-bottom:2rem}
.hd h1{font-size:.75rem;letter-spacing:.3em;text-transform:uppercase;color:#9B7F5A;margin:0}
p{font-size:.95rem;line-height:1.75;margin:.6rem 0}
.lbl{font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#9B7F5A;display:block;margin-bottom:.15rem;margin-top:.9rem}
.val{color:#E2D8C8;font-size:.95rem}
hr{border:none;border-top:1px solid rgba(155,127,90,.2);margin:1.5rem 0}
.btn{display:inline-block;padding:.7rem 1.75rem;text-decoration:none;font-family:Arial,sans-serif;font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;border:1px solid;margin:.35rem .35rem 0 0}
.ok{border-color:#3a8a3a;color:#6aba6a;background:rgba(42,122,42,.1)}
.no{border-color:#8a3a3a;color:#ba6a6a;background:rgba(122,42,42,.1)}
.dc{border-color:#9B7F5A;color:#C4A07A;background:rgba(155,127,90,.1)}
.otp{font-size:2.4rem;letter-spacing:.5em;color:#C9922A;text-align:center;padding:1.5rem;border:1px solid rgba(155,127,90,.3);margin:1.5rem 0}
.ft{margin-top:2rem;padding-top:1.25rem;border-top:1px solid rgba(155,127,90,.15);font-size:.75rem;color:#7A6A56}
</style></head><body><div class="w">
<div class="hd"><h1>Dumb Decision TTRPG</h1></div>
${body}
<div class="ft">Dumb Decision TTRPG · kontakt@dumbdecision.de · dumbdecision.de</div>
</div></body></html>`;
}

const EXP_LABELS: Record<string, string> = {
  anfaenger:  'Anfänger (noch keine Erfahrung)',
  gelegenheit:'Gelegenheitsspieler',
  erfahren:   'Erfahren',
  veteran:    'Veteran',
};

function tplOTP(otp: string): string {
  return base(`
<p>Du hast eine Vereinsanmeldung bei Dumb Decision TTRPG gestartet.</p>
<p>Dein Bestätigungscode:</p>
<div class="otp">${otp}</div>
<p style="color:#7A6A56;font-size:.85rem">Gültig für <strong>10 Minuten</strong>. Falls du keine Anmeldung gestartet hast, ignoriere diese E-Mail.</p>`);
}

function tplAdmin(app: Application, approve: string, reject: string): string {
  const d = app.data;
  const age = Math.floor((Date.now() - new Date(d.geburtsdatum).getTime()) / (365.25 * 86_400_000));
  return base(`
<p>Neue Vereinsanmeldung — bitte innerhalb von 30 Tagen entscheiden.</p>
<hr/>
<span class="lbl">Name</span><span class="val">${d.vorname} ${d.nachname}</span>
<span class="lbl">Geburtsdatum</span><span class="val">${new Date(d.geburtsdatum).toLocaleDateString('de-DE')} (${age} Jahre)</span>
<span class="lbl">E-Mail</span><span class="val">${d.email}</span>
${d.telefon ? `<span class="lbl">Telefon</span><span class="val">${d.telefon}</span>` : ''}
<span class="lbl">Adresse</span><span class="val">${d.strasse}, ${d.plz} ${d.ort}</span>
${d.discord ? `<span class="lbl">Discord</span><span class="val">${d.discord}</span>` : ''}
<span class="lbl">TTRPG-Erfahrung</span><span class="val">${EXP_LABELS[d.erfahrung] ?? d.erfahrung}</span>
${d.aufmerksam ? `<span class="lbl">Aufmerksam geworden durch</span><span class="val">${d.aufmerksam}</span>` : ''}
<span class="lbl">Motivation</span><span class="val" style="white-space:pre-wrap">${d.motivation}</span>
<hr/>
<p style="color:#7A6A56;font-size:.85rem">Eingegangen: ${new Date(app.createdAt).toLocaleString('de-DE')}</p>
<a href="${approve}" class="btn ok">✓ Aufnehmen</a>
<a href="${reject}"  class="btn no">✗ Ablehnen</a>
<p style="color:#7A6A56;font-size:.78rem;margin-top:.75rem">Links sind 30 Tage gültig.</p>`);
}

function tplApproval(app: Application, invite: string | null): string {
  return base(`
<p>Liebe*r ${app.data.vorname},</p>
<p>wir freuen uns sehr, dich als neues Mitglied bei <em>Dumb Decision TTRPG</em> willkommen zu heißen! Deine Bewerbung wurde vom Vorstand geprüft und angenommen.</p>
<hr/>
<p><strong style="color:#9B7F5A">Nächster Schritt: Discord</strong></p>
<p>Tritt unserem Discord-Server bei, um Teil der Community zu werden. Dein persönlicher Einladungslink:</p>
${invite
  ? `<p style="text-align:center;margin:1.5rem 0"><a href="${invite}" class="btn dc">Discord beitreten ↗</a></p>
     <p style="color:#7A6A56;font-size:.85rem">Dieser Link ist einmalig und für 7 Tage gültig.</p>`
  : `<p style="color:#7A6A56">Der Discord-Einladungslink wird dir separat zugesandt.</p>`}
<hr/>
<p>Bei Fragen erreichst du uns jederzeit unter <a href="mailto:kontakt@dumbdecision.de" style="color:#9B7F5A">kontakt@dumbdecision.de</a>.</p>
<p style="margin-top:1.5rem;font-style:italic;color:#9B7F5A">Tom, Dominik &amp; Tobi<br/>Vorstand, Dumb Decision TTRPG</p>`);
}

function tplRejection(app: Application): string {
  return base(`
<p>Liebe*r ${app.data.vorname},</p>
<p>vielen Dank für dein Interesse an <em>Dumb Decision TTRPG</em>.</p>
<p>Nach Prüfung durch unseren Vorstand können wir deine Bewerbung zum jetzigen Zeitpunkt leider nicht annehmen. Bei Fragen stehen wir gerne unter <a href="mailto:kontakt@dumbdecision.de" style="color:#9B7F5A">kontakt@dumbdecision.de</a> zur Verfügung.</p>
<p style="margin-top:1.5rem;font-style:italic;color:#9B7F5A">Tom, Dominik &amp; Tobi<br/>Vorstand, Dumb Decision TTRPG</p>`);
}
