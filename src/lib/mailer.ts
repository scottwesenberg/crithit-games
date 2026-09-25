import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function send(to: string, subject: string, html: string) {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM ?? "CritHit Games <no-reply@crithitgames.com>";

  if (!transport) {
    // No SMTP configured (e.g. local dev without credentials yet) — log
    // instead of throwing, so the rest of the flow keeps working.
    console.warn(
      `[mailer] EMAIL_SERVER_HOST not configured — printing email instead of sending.\nTo: ${to}\nSubject: ${subject}\n${html}`
    );
    return;
  }

  await transport.sendMail({ from, to, subject, html });
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  await send(
    to,
    "Verify your CritHit Games account",
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Welcome to CritHit Games, ${name}!</h2>
      <p>Confirm your email address to activate your account and start tracking orders.</p>
      <p><a href="${verifyUrl}" style="background:#6c37ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Verify my email</a></p>
      <p>Or paste this link into your browser:<br/>${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
    </div>`
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await send(
    to,
    "Reset your CritHit Games password",
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Reset your password</h2>
      <p>Click below to choose a new password. If you didn't request this, you can ignore this email.</p>
      <p><a href="${resetUrl}" style="background:#6c37ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p>
      <p>This link expires in 1 hour.</p>
    </div>`
  );
}

export async function sendOrderConfirmationEmail(to: string, orderNumber: string, totalCents: number) {
  await send(
    to,
    `Order ${orderNumber} confirmed`,
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Thanks for your order!</h2>
      <p>Order <strong>${orderNumber}</strong> is confirmed. Total: $${(totalCents / 100).toFixed(2)}.</p>
      <p>You can track its status any time from your account's Order History page.</p>
    </div>`
  );
}
