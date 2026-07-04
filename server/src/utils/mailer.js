import nodemailer from "nodemailer";
import { formatCurrency } from "../../../shared/currency.mjs";
import { AppError } from "./errors.js";
import { createOrderReceiptPdf } from "./receiptPdf.js";

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

function transporterFor(config) {
  return nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.auth });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function absoluteImageUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const origin = process.env.SERVER_URL || process.env.API_ORIGIN || "";
  return origin ? `${origin.replace(/\/$/, "")}/${String(url).replace(/^\//, "")}` : "";
}

function orderItemsText(items = []) {
  return items.map((item) => {
    const variation = [item.selectedSize && `size ${item.selectedSize}`, item.selectedColor && `color ${item.selectedColor}`].filter(Boolean).join(", ");
    return `- ${item.name}${variation ? ` (${variation})` : ""}: ${item.quantity} x ${formatCurrency(item.priceAtPurchase)}`;
  });
}

function orderItemsHtml(items = []) {
  return items.map((item) => {
    const image = absoluteImageUrl(item.imageUrl);
    const variation = [item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor && `Color ${item.selectedColor}`].filter(Boolean).join(" / ");
    return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #e5e5e5">
      ${image ? `<img src="${escapeHtml(image)}" alt="" width="64" height="80" style="object-fit:cover;border-radius:8px" />` : ""}
      <div><strong>${escapeHtml(item.name)}</strong><div style="color:#737373;font-size:13px;margin-top:4px">${escapeHtml(variation || "Standard variation")}</div>
      <div style="margin-top:6px">Qty ${item.quantity} x ${escapeHtml(formatCurrency(item.priceAtPurchase))}</div></div>
    </div>`;
  }).join("");
}

function emailShell({ title, badge, body, order }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f1eb;font-family:Arial,sans-serif;color:#171717">
    <div style="max-width:640px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e5e5">
      <div style="background:#171717;color:#fff;padding:22px 28px"><div style="font-size:25px;font-weight:800;letter-spacing:3px">VASTRA</div></div>
      <div style="padding:28px"><span style="display:inline-block;background:#f1e3da;color:#8a4f33;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;text-transform:uppercase">${escapeHtml(badge)}</span>
      <h1 style="font-size:25px;margin:16px 0 8px">${escapeHtml(title)}</h1>${body}
      <div style="margin-top:22px"><h2 style="font-size:17px">Order #${escapeHtml(String(order.id).slice(0, 8))}</h2>${orderItemsHtml(order.items)}</div>
      <div style="margin-top:20px;padding:16px;background:#faf7f4;border-radius:10px"><strong>Grand total</strong><span style="float:right;font-weight:800">${escapeHtml(formatCurrency(order.totalAmount))}</span></div>
      <p style="margin-top:24px;color:#737373;font-size:13px">Thank you for choosing VASTRA.</p></div>
    </div></body></html>`;
}

export async function sendVerificationEmail(to, otp) {
  const config = getMailConfig();
  const transporter = transporterFor(config);

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
  const transporter = transporterFor(config);

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

export async function sendOrderReceiptEmail(to, order) {
  const config = getMailConfig();
  const transporter = transporterFor(config);
  const receipt = await createOrderReceiptPdf(order);
  const paymentName = order.paymentMethod === "card" ? "Card" : "Cash on Delivery";
  const text = [
    `Hello ${order.customerName},`, "", `Your VASTRA order #${order.id} was placed successfully.`,
    ...orderItemsText(order.items), "", `Payment: ${paymentName} (${order.paymentStatus})`,
    `Delivery address: ${order.deliveryAddress}`, `Grand total: ${formatCurrency(order.totalAmount)}`,
    "", "Your PDF receipt is attached. Thank you for shopping with VASTRA."
  ].join("\n");
  const html = emailShell({
    title: "Order placed successfully",
    badge: order.paymentStatus,
    order,
    body: `<p style="line-height:1.6">Hello ${escapeHtml(order.customerName)}, your order is confirmed.</p><p style="line-height:1.6"><strong>Payment:</strong> ${escapeHtml(paymentName)} (${escapeHtml(order.paymentStatus)})<br><strong>Delivery:</strong> ${escapeHtml(order.deliveryAddress)}</p>`
  });
  await transporter.sendMail({
    from: config.from,
    to,
    subject: `VASTRA order ${String(order.id).slice(0, 8)} confirmed`,
    text,
    html,
    attachments: [{ filename: `VASTRA-receipt-${String(order.id).slice(0, 8)}.pdf`, content: receipt, contentType: "application/pdf" }]
  });
}

export async function sendOrderStatusEmail(to, order) {
  const { id: orderId, status, explanation = "" } = order;
  const config = getMailConfig();
  const transporter = transporterFor(config);
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
  const helpfulMessage = {
    processing: "We are preparing your items for dispatch.",
    shipped: "Your order is on its way.",
    delivered: "Your order has been delivered. We hope you love it.",
    cancelled: "This order has been cancelled."
  }[status] || "We will keep you updated as your order progresses.";

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
        ...orderItemsText(order.items),
        `Order total: ${formatCurrency(order.totalAmount)}`,
        "",
        helpfulMessage,
        "You can view the latest status in your VASTRA order history."
      ].filter(Boolean).join("\n"),
      html: emailShell({
        title: `Order status: ${displayStatus}`,
        badge: displayStatus,
        order,
        body: `<p style="line-height:1.6">${escapeHtml(helpfulMessage)}</p>${explanation ? `<p style="line-height:1.6"><strong>Details:</strong> ${escapeHtml(explanation)}</p>` : ""}`
      })
    });
  } catch {
    throw new AppError("Could not send the order status email.", 502);
  }
}
