// src/config/mailer.ts
import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

export const verifyMailer = async (): Promise<void> => {
  try {
    await getTransporter().verify();
    console.log('✅  Nodemailer ready');
  } catch (err) {
    console.warn('⚠️   Nodemailer not configured (emails will be skipped in dev):', (err as Error).message);
  }
};
