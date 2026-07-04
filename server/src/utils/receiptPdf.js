import PDFDocument from "pdfkit";
import { formatCurrency } from "../../../shared/currency.mjs";

function detailLine(doc, label, value) {
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value || "Not provided");
}

export function createOrderReceiptPdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `VASTRA receipt ${order.id}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#9b5f43").font("Helvetica-Bold").fontSize(26).text("VASTRA");
    doc.fillColor("#171717").fontSize(16).text("Order receipt", { align: "right" });
    doc.moveDown(1.5);
    detailLine(doc, "Order ID", order.id);
    detailLine(doc, "Order date", new Date(order.createdAt).toLocaleString("en-NP"));
    detailLine(doc, "Customer", order.customerName);
    detailLine(doc, "Email", order.customerEmail);
    detailLine(doc, "Phone", order.phoneNumber);
    detailLine(doc, "Delivery address", order.deliveryAddress);
    detailLine(doc, "Payment", `${order.paymentMethod === "card" ? "Card" : "Cash on Delivery"} - ${order.paymentStatus}`);
    detailLine(doc, "Delivery status", order.status);

    doc.moveDown().strokeColor("#d4d4d4").moveTo(48, doc.y).lineTo(547, doc.y).stroke().moveDown();
    doc.font("Helvetica-Bold").fontSize(15).text("Products").moveDown(0.5);
    order.items.forEach((item, index) => {
      const variation = [item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor && `Color ${item.selectedColor}`].filter(Boolean).join(" / ");
      doc.font("Helvetica-Bold").fontSize(11).text(`${index + 1}. ${item.name}`);
      doc.font("Helvetica").fontSize(10).fillColor("#525252").text([
        variation,
        `Quantity ${item.quantity}`,
        `Unit price ${formatCurrency(item.priceAtPurchase)}`,
        `Line total ${formatCurrency(item.priceAtPurchase * item.quantity)}`
      ].filter(Boolean).join("  |  "));
      doc.fillColor("#171717").moveDown(0.7);
    });

    doc.moveDown().font("Helvetica-Bold").fontSize(15).text(`Grand total: ${formatCurrency(order.totalAmount)}`, { align: "right" });
    doc.moveDown(2).font("Helvetica").fontSize(10).fillColor("#525252").text("Thank you for shopping with VASTRA. Keep this receipt for your records.", { align: "center" });
    doc.end();
  });
}
