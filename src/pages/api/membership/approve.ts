import type { APIRoute } from 'astro';
import {
  getApplicationByToken,
  updateApplicationStatus,
  createDiscordInvite,
  mailApproval,
  mailRejection,
} from '../../../lib/membership';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token  = url.searchParams.get('token') ?? '';
  const action = url.searchParams.get('action');

  if (!token || !['approve', 'reject'].includes(action ?? '')) {
    return html(page('Fehler', 'Ungültiger Link.', false));
  }

  const app = getApplicationByToken(token);
  if (!app) {
    return html(page('Fehler', 'Dieser Link ist ungültig oder abgelaufen.', false));
  }
  if (app.status !== 'pending') {
    const done = app.status === 'approved' ? 'angenommen' : 'abgelehnt';
    return html(page('Bereits bearbeitet', `Diese Anmeldung wurde bereits ${done}.`, false));
  }
  if (new Date(app.tokenExpiry) < new Date()) {
    return html(page('Link abgelaufen', 'Dieser Bestätigungslink ist abgelaufen.', false));
  }

  const approved = action === 'approve';
  updateApplicationStatus(app.id, approved ? 'approved' : 'rejected');

  let discordInvite: string | null = null;
  if (approved) {
    try {
      discordInvite = await createDiscordInvite();
    } catch (err) {
      console.error('Discord invite error:', err);
    }
    await mailApproval(app, discordInvite).catch(console.error);
  } else {
    await mailRejection(app).catch(console.error);
  }

  const name = `${app.data.vorname} ${app.data.nachname}`;
  const msg = approved
    ? `${name} wurde aufgenommen. Eine Willkommens-E-Mail${discordInvite ? ' mit persönlichem Discord-Invite' : ''} wurde versendet.`
    : `${name} wurde abgelehnt. Eine Benachrichtigung wurde versendet.`;

  return html(page(approved ? '✓ Aufgenommen' : '✗ Abgelehnt', msg, approved));
};

function html(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function page(title: string, msg: string, success: boolean): string {
  const accent = success ? '#6aba6a' : '#C08080';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — DDT</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#0C0904;color:#E2D8C8;font-family:Georgia,serif}
.card{max-width:460px;width:100%;margin:2rem;padding:2rem 2.5rem;border:1px solid rgba(155,127,90,.25)}
h1{font-size:.78rem;letter-spacing:.28em;text-transform:uppercase;color:${accent};margin:0 0 1.25rem}
p{font-size:.95rem;line-height:1.7;margin:.5rem 0}
a{color:#9B7F5A;text-decoration:none;border-bottom:1px solid rgba(155,127,90,.3);padding-bottom:.1rem}
</style></head>
<body><div class="card">
<h1>${title}</h1>
<p>${msg}</p>
<p style="margin-top:1.5rem"><a href="/">← Zurück zur Website</a></p>
</div></body></html>`;
}
