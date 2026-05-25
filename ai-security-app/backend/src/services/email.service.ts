// src/services/email.service.ts
import { getTransporter } from '../config/mailer';

const FROM = process.env.SMTP_FROM || 'AI Security <no-reply@aisecurity.com>';

// ─── OTP Email Template ───────────────────────────────────────────────────────
const otpTemplate = (otp: string, name: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Identity</title>
  <style>
    body { margin: 0; padding: 0; background: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; background: #0f1923; border: 1px solid #1e3a5f; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0a2540 0%, #1a3a6c 100%); padding: 32px 40px; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; color: #4fa3e0; letter-spacing: 2px; }
    .logo span { color: #ffffff; }
    .body { padding: 40px; }
    h2 { color: #e2e8f0; font-size: 20px; margin: 0 0 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .otp-box { background: #0a2540; border: 1px solid #1e3a5f; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #4fa3e0; font-family: 'Courier New', monospace; }
    .expiry { color: #64748b; font-size: 13px; margin-top: 8px; }
    .footer { background: #080d12; padding: 20px 40px; text-align: center; }
    .footer p { color: #475569; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">AI<span>Security</span></div>
    </div>
    <div class="body">
      <h2>Hello, ${name} 👋</h2>
      <p>To complete your verification, use the one-time password below. It expires in <strong style="color:#4fa3e0">10 minutes</strong>.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="expiry">Valid for 10 minutes · Do not share</div>
      </div>
      <p>If you didn't request this, you can safely ignore this email. Your account remains secure.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AI Security Platform · All rights reserved</p>
    </div>
  </div>
</body>
</html>
`;

// ─── Welcome Email Template ───────────────────────────────────────────────────
const welcomeTemplate = (name: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; background: #0f1923; border: 1px solid #1e3a5f; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0a2540 0%, #1a3a6c 100%); padding: 32px 40px; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; color: #4fa3e0; letter-spacing: 2px; }
    .logo span { color: #ffffff; }
    .body { padding: 40px; }
    h2 { color: #e2e8f0; font-size: 22px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .cta { display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 8px; }
    .footer { background: #080d12; padding: 20px 40px; text-align: center; }
    .footer p { color: #475569; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">AI<span>Security</span></div>
    </div>
    <div class="body">
      <h2>Welcome aboard, ${name}! 🛡️</h2>
      <p>Your account is now active. You have access to our AI-powered threat detection, real-time scanning, and security analytics dashboard.</p>
      <p>Get started by exploring your dashboard and generating your first API key.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard" class="cta">Go to Dashboard →</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AI Security Platform · All rights reserved</p>
    </div>
  </div>
</body>
</html>
`;

// ─── Public API ───────────────────────────────────────────────────────────────
export const sendOTPEmail = async (to: string, name: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
    console.log(`\n📧  [DEV] OTP for ${to}: ${otp}\n`);
    return;
  }
  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: `${otp} — Your AI Security Verification Code`,
    html: otpTemplate(otp, name),
  });
};

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
    console.log(`\n📧  [DEV] Welcome email skipped for ${to}\n`);
    return;
  }
  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: `Welcome to AI Security Platform, ${name}!`,
    html: welcomeTemplate(name),
  });
};

// ─── Password Reset Template & Sender ───────────────────────────────────────
const resetTemplate = (otp: string, name: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset</title>
  <style>
    body { margin: 0; padding: 0; background: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; background: #0f1923; border: 1px solid #1e3a5f; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0a2540 0%, #1a3a6c 100%); padding: 32px 40px; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; color: #4fa3e0; letter-spacing: 2px; }
    .logo span { color: #ffffff; }
    .body { padding: 40px; }
    h2 { color: #e2e8f0; font-size: 20px; margin: 0 0 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .otp-box { background: #0a2540; border: 1px solid #1e3a5f; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #f97316; font-family: 'Courier New', monospace; }
    .expiry { color: #64748b; font-size: 13px; margin-top: 8px; }
    .footer { background: #080d12; padding: 20px 40px; text-align: center; }
    .footer p { color: #475569; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">AI<span>Security</span></div>
    </div>
    <div class="body">
      <h2>Hello, ${name} 👋</h2>
      <p>We received a request to reset your password. Use the code below to set a new password. It expires in <strong style="color:#f97316">10 minutes</strong>.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="expiry">Valid for 10 minutes · Do not share</div>
      </div>
      <p>If you didn't request this, you can safely ignore this email and no changes will be made.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AI Security Platform · All rights reserved</p>
    </div>
  </div>
</body>
</html>
`;

export const sendPasswordResetEmail = async (to: string, name: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
    console.log(`\n📧  [DEV] Password reset OTP for ${to}: ${otp}\n`);
    return;
  }
  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: `${otp} — Password reset code`,
    html: resetTemplate(otp, name),
  });
};
