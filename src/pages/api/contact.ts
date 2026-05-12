import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'mx.volantic.de',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name    = String(form.get('name')    ?? '').trim();
  const email   = String(form.get('email')   ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();

  if (!name || !email || !subject || !message) {
    return Response.redirect(new URL('/kontakt?error=1', request.url), 303);
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.redirect(new URL('/kontakt?error=1', request.url), 303);
  }

  try {
    await transporter.sendMail({
      from: `"DDT Kontaktformular" <${process.env.SMTP_FROM ?? 'noreply@dumbdecision.de'}>`,
      to: 'vorstand@dumbdecision.de',
      replyTo: `"${name}" <${email}>`,
      subject: `[Kontakt] ${subject}`,
      text: `Name: ${name}\nE-Mail: ${email}\n\n${message}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });
  } catch {
    return Response.redirect(new URL('/kontakt?error=1', request.url), 303);
  }

  return Response.redirect(new URL('/kontakt?sent=1', request.url), 303);
};
