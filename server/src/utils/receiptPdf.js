import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { formatCurrency } from "../../../shared/currency.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(__dirname, "../../../vastra.png");
const left = 50;
const right = 545;
const ink = "#171717";
const muted = "#666666";
const rule = "#d9d9d9";

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function paymentMethodLabel(order) {
  if (order.paymentMethod === "card") {
    return order.maskedCardNumber ? `Card ${order.maskedCardNumber}` : "Card";
  }
  return "Cash on Delivery";
}

function drawDetail(doc, label, value, y) {
  doc.font("Helvetica").fontSize(9).fillColor(muted).text(label, left, y, { width: 105 });
  doc.font("Helvetica").fontSize(9).fillColor(ink).text(String(value || "Not available"), left + 110, y, { width: 285 });
}

function drawParty(doc, title, lines, x, y) {
  const body = lines.filter(Boolean).join("\n");
  doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(title, x, y);
  doc.font("Helvetica").fontSize(9).fillColor(muted).text(body, x, y + 18, {
    width: 220,
    lineGap: 3
  });
  return y + 18 + doc.heightOfString(body, { width: 220, lineGap: 3 });
}

function drawTableHeader(doc, y) {
  doc.moveTo(left, y).lineTo(right, y).strokeColor(rule).lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(muted);
  doc.text("DESCRIPTION", left, y + 10, { width: 255 });
  doc.text("QTY", 320, y + 10, { width: 45, align: "right" });
  doc.text("UNIT PRICE", 375, y + 10, { width: 78, align: "right" });
  doc.text("AMOUNT", 465, y + 10, { width: 80, align: "right" });
  doc.moveTo(left, y + 30).lineTo(right, y + 30).strokeColor(rule).stroke();
  return y + 42;
}

function drawMoneyLine(doc, label, value, y, bold = false) {
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  doc.font(font).fontSize(10).fillColor(ink).text(label, 365, y, { width: 90 });
  doc.font(font).text(formatCurrency(value), 460, y, { width: 85, align: "right" });
}

export function createOrderReceiptPdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `VASTRA receipt ${order.id}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const orderDate = formatReceiptDate(order.createdAt);
    const paid = order.paymentStatus === "paid";
    const invoiceNumber = order.invoiceNumber || order.id;
    const receiptNumber = order.receiptNumber || order.id;

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
    doc.font("Helvetica-Bold").fontSize(34).fillColor(ink).text("Receipt", left, 52);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 475, 42, { fit: [70, 70], align: "center", valign: "center" });
    } else {
      doc.font("Helvetica-Bold").fontSize(16).fillColor(ink).text("VASTRA", 455, 60, { width: 90, align: "right" });
    }

    drawDetail(doc, "Invoice number", invoiceNumber, 125);
    drawDetail(doc, "Receipt number", receiptNumber, 143);
    drawDetail(doc, paid ? "Date paid" : "Order date", orderDate, 161);
    drawDetail(doc, "Payment method", paymentMethodLabel(order), 179);

    const fromBottom = drawParty(doc, "FROM", [
      "VASTRA Fashion Marketplace",
      "Kathmandu, Nepal",
      process.env.EMAIL_USER || "support@vastra.example"
    ], left, 225);
    const billToBottom = drawParty(doc, "BILL TO", [
      order.customerName,
      order.customerEmail,
      order.phoneNumber,
      order.deliveryAddress
    ], 315, 225);

    const summary = paid
      ? `${formatCurrency(order.totalAmount)} paid on ${orderDate}`
      : `${formatCurrency(order.totalAmount)} due on delivery`;
    const summaryY = Math.max(330, fromBottom + 28, billToBottom + 28);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(ink).text(summary, left, summaryY, { width: right - left });

    let y = drawTableHeader(doc, summaryY + 45);
    order.items.forEach((item) => {
      const variation = [item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor && `Color ${item.selectedColor}`].filter(Boolean).join(" / ");
      const description = `${item.name}${variation ? `\n${variation}` : ""}`;
      const rowHeight = Math.max(34, doc.heightOfString(description, { width: 255, lineGap: 2 }) + 14);
      if (y + rowHeight > doc.page.height - 145) {
        doc.addPage({ size: "A4", margin: 0 });
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
        y = drawTableHeader(doc, 48);
      }

      doc.font("Helvetica").fontSize(9).fillColor(ink).text(description, left, y, { width: 255, lineGap: 2 });
      doc.text(String(item.quantity), 320, y, { width: 45, align: "right" });
      doc.text(formatCurrency(item.priceAtPurchase), 375, y, { width: 78, align: "right" });
      doc.text(formatCurrency(item.priceAtPurchase * item.quantity), 465, y, { width: 80, align: "right" });
      y += rowHeight;
      doc.moveTo(left, y - 8).lineTo(right, y - 8).strokeColor("#eeeeee").stroke();
    });

    if (y + 120 > doc.page.height - 45) {
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
      y = 70;
    } else {
      y += 10;
    }
    drawMoneyLine(doc, "Subtotal", order.totalAmount, y);
    drawMoneyLine(doc, "Total", order.totalAmount, y + 24, true);
    doc.moveTo(365, y + 49).lineTo(right, y + 49).strokeColor(rule).stroke();
    drawMoneyLine(doc, "Amount paid", paid ? order.totalAmount : 0, y + 62, true);

    const footerY = Math.min(doc.page.height - 62, y + 125);
    doc.font("Helvetica").fontSize(9).fillColor(muted).text(
      "Thank you for shopping with VASTRA.",
      left,
      footerY,
      { width: right - left, align: "center" }
    );
    doc.end();
  });
}
