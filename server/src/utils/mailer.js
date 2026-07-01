import nodemailer from "nodemailer";
import { AppError } from "./errors.js";

function boolEnv(value) {
  return String(value).toLowerCase() === "true";
}

function getMailConfig() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new AppError("Email verification is not configured. Please set SMTP credentials.", 500);
  }

  return {
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: boolEnv(EMAIL_SECURE),
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    from: EMAIL_FROM || EMAIL_USER
  };
}

export async function sendVerificationEmail(to, otp) {
  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: "VASTRA Email Verification",
      text: [
        `Your VASTRA verification code is: ${otp}`,
        "",
        "This code expires in 10 minutes. If you did not create an account, you can ignore this email."
      ].join("\n")
    });
  } catch {
    throw new AppError("Could not send verification email. Please check your email address.", 502);
  }
}

export async function sendLoginOtpEmail(to, otp) {
  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: "VASTRA Login Verification",
      text: [
        `Your VASTRA login code is: ${otp}`,
        "",
        "This single-use code expires in 10 minutes. If this was not you, change your password immediately."
      ].join("\n")
    });
  } catch {
    throw new AppError("Could not send the login verification email. Please try again.", 502);
  }
}

export async function sendOrderStatusEmail(to, { orderId, status, explanation = "" }) {
  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: `VASTRA order ${String(orderId).slice(0, 8)} status: ${displayStatus}`,
      text: [
        "Hello,",
        "",
        `Your order #${orderId} shipping status has been updated to: ${displayStatus}.`,
        explanation ? `Details: ${explanation}` : "",
        "",
        "You can view the latest status in your VASTRA order history."
      ].filter(Boolean).join("\n")
    });
  } catch {
    throw new AppError("Could not send the order status email.", 502);
  }
}
