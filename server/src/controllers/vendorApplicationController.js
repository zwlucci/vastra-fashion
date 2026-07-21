import crypto from "node:crypto";
import { query, withTransaction } from "../config/db.js";
import { emitDashboardUpdated, emitUserRoleChanged } from "../socket.js";
import {
  assertSavedPaymentOwner,
  saveDemoPaymentMethodInTransaction
} from "./checkoutDetailsController.js";
import {
  assertApprovedDemoCard,
  assertSavedDemoCardForCheckout,
  cardBrandFromNumber,
  demoSavedCardsEnabled
} from "../utils/demoSavedCards.js";
import { AppError, notFound } from "../utils/errors.js";
import { saveVendorApplicationDocument } from "../utils/imageUpload.js";
import { sendVendorApplicationDecisionEmail } from "../utils/mailer.js";
import { createOrderNotificationsInTransaction, emitCreatedOrderNotifications } from "../utils/orderNotifications.js";
import { serializeUser } from "../utils/serializers.js";

export const VENDOR_SUBSCRIPTION_PLANS = {
  monthly: {
    id: "monthly",
    name: "Monthly Plan",
    price: 299,
    currency: "NPR",
    billingPeriod: "Monthly",
    benefits: [
      "Apply for a verified VASTRA vendor storefront",
      "Access vendor dashboard tools after approval",
      "Submit products for marketplace review",
      "Receive customer messages and order management access"
    ]
  },
  annual: {
    id: "annual",
    name: "Annual Plan",
    price: 24999,
    currency: "NPR",
    billingPeriod: "Annual",
    benefits: [
      "Apply for a verified VASTRA vendor storefront",
      "Access vendor dashboard tools after approval",
      "Submit products for marketplace review",
      "Receive customer messages and order management access",
      "Reduced renewal effort for long-term sellers"
    ]
  }
};

export function vendorPlanFor(subscriptionPlan) {
  const plan = VENDOR_SUBSCRIPTION_PLANS[subscriptionPlan];
  if (!plan) throw new AppError("Choose a valid vendor subscription plan.", 400);
  return plan;
}

function mapVendorPayment(row, prefix = "payment_") {
  const id = row[`${prefix}id`];
  if (!id) return null;
  return {
    id,
    amount: Number(row[`${prefix}amount`]),
    paymentMethod: row[`${prefix}payment_method`],
    paymentStatus: row[`${prefix}payment_status`],
    transactionReference: row[`${prefix}transaction_reference`] || "",
    paymentDate: row[`${prefix}payment_date`],
    subscriptionPlan: row[`${prefix}subscription_plan`],
    billingPeriod: row[`${prefix}billing_period`],
    subscriptionStartDate: row[`${prefix}subscription_start_date`],
    subscriptionExpiryDate: row[`${prefix}subscription_expiry_date`],
    cardholderName: row[`${prefix}cardholder_name`] || "",
    cardBrand: row[`${prefix}card_brand`] || "",
    cardLast4: row[`${prefix}card_last4`] || ""
  };
}

function mapVendorApplication(row) {
  if (!row) return null;
  const payment = mapVendorPayment(row);
  return {
    id: row.id,
    userId: row.user_id,
    applicantName: row.applicant_name || row.user_name || row.full_name,
    applicantEmail: row.applicant_email || row.user_email || row.business_email,
    fullName: row.full_name,
    brandName: row.brand_name,
    contactNumber: row.contact_number,
    businessEmail: row.business_email,
    businessAddress: row.business_address,
    businessDescription: row.business_description,
    subscriptionPlan: row.subscription_plan,
    subscriptionPrice: Number(row.subscription_price),
    status: row.status,
    adminMessage: row.admin_message || "",
    supportingDocument: row.supporting_document || "",
    paymentStatus: row.payment_status,
    subscriptionStatus: row.subscription_status,
    subscriptionStartDate: row.subscription_start_date,
    subscriptionExpiryDate: row.subscription_expiry_date,
    vendorPaymentId: row.vendor_payment_id || "",
    payment,
    amountPaid: payment?.amount ?? null,
    paymentMethod: payment?.paymentMethod || "",
    transactionReference: payment?.transactionReference || "",
    paymentDate: payment?.paymentDate || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by || "",
    reviewedByName: row.reviewed_by_name || ""
  };
}

function planLabel(planId) {
  const plan = vendorPlanFor(planId);
  return `${plan.name} - ${plan.currency} ${plan.price.toLocaleString("en-NP")} ${plan.billingPeriod}`;
}

function subscriptionDates(planId, start = new Date()) {
  const expiry = new Date(start);
  if (planId === "annual") expiry.setFullYear(expiry.getFullYear() + 1);
  else expiry.setMonth(expiry.getMonth() + 1);
  return { start, expiry };
}

function transactionReference() {
  return `VENDOR-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function adminIds(client) {
  const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin'");
  return rows.map((row) => row.id);
}

async function getApplicationWithPayment(client, applicationId) {
  const runQuery = typeof client === "function" ? client : client.query.bind(client);
  const { rows } = await runQuery(
    `SELECT vendor_applications.*,
            applicants.name AS applicant_name,
            applicants.email AS applicant_email,
            reviewers.name AS reviewed_by_name,
            payments.id AS payment_id,
            payments.amount AS payment_amount,
            payments.payment_method AS payment_payment_method,
            payments.payment_status AS payment_payment_status,
            payments.transaction_reference AS payment_transaction_reference,
            payments.payment_date AS payment_payment_date,
            payments.subscription_plan AS payment_subscription_plan,
            payments.billing_period AS payment_billing_period,
            payments.subscription_start_date AS payment_subscription_start_date,
            payments.subscription_expiry_date AS payment_subscription_expiry_date,
            payments.cardholder_name AS payment_cardholder_name,
            payments.card_brand AS payment_card_brand,
            payments.card_last4 AS payment_card_last4
     FROM vendor_applications
     JOIN users AS applicants ON applicants.id = vendor_applications.user_id
     LEFT JOIN users AS reviewers ON reviewers.id = vendor_applications.reviewed_by
     LEFT JOIN vendor_subscription_payments AS payments ON payments.id = vendor_applications.vendor_payment_id
     WHERE vendor_applications.id = $1`,
    [applicationId]
  );
  return rows[0] || null;
}

async function getIdempotentPaidApplication(client, userId, idempotencyKey) {
  const { rows } = await client.query(
    `SELECT vendor_applications.*,
            payments.id AS payment_id,
            payments.amount AS payment_amount,
            payments.payment_method AS payment_payment_method,
            payments.payment_status AS payment_payment_status,
            payments.transaction_reference AS payment_transaction_reference,
            payments.payment_date AS payment_payment_date,
            payments.subscription_plan AS payment_subscription_plan,
            payments.billing_period AS payment_billing_period,
            payments.subscription_start_date AS payment_subscription_start_date,
            payments.subscription_expiry_date AS payment_subscription_expiry_date,
            payments.cardholder_name AS payment_cardholder_name,
            payments.card_brand AS payment_card_brand,
            payments.card_last4 AS payment_card_last4
     FROM vendor_subscription_payments AS payments
     JOIN vendor_applications ON vendor_applications.id = payments.vendor_application_id
     WHERE payments.user_id = $1
       AND payments.idempotency_key = $2`,
    [userId, idempotencyKey]
  );
  return rows[0] || null;
}

export async function createPaidVendorApplicationForUser(client, user, payload) {
  const locked = await client.query("SELECT id, role, email, name FROM users WHERE id = $1 FOR UPDATE", [user.id]);
  const userRecord = locked.rows[0];
  if (!userRecord) throw notFound("User not found");
  if (userRecord.role !== "user") {
    throw new AppError("Only regular user accounts can submit a vendor application.", 403);
  }

  const duplicatePayment = await getIdempotentPaidApplication(client, user.id, payload.idempotencyKey);
  if (duplicatePayment) {
    return { application: mapVendorApplication(duplicatePayment), notifications: [], duplicate: true };
  }

  const pending = await client.query(
    "SELECT id FROM vendor_applications WHERE user_id = $1 AND status IN ('pending', 'approved') LIMIT 1",
    [user.id]
  );
  if (pending.rows[0]) {
    throw new AppError("You already have an active vendor application.", 409);
  }

  const plan = vendorPlanFor(payload.subscriptionPlan);
  const savedPayment = await assertSavedPaymentOwner(client, user.id, payload.paymentPreferenceId);
  if (savedPayment && savedPayment.method !== payload.paymentMethod) {
    throw new AppError("Saved payment preference does not match the selected payment method.", 400);
  }

  const savedDemoCard = payload.savedPaymentMethodId
    ? await assertSavedDemoCardForCheckout(client, user.id, payload.savedPaymentMethodId, payload.savedCardCvv)
    : null;
  const paymentCard = savedDemoCard || payload.card;
  if (!paymentCard) throw new AppError("Card details are required", 400);
  if (!savedDemoCard && demoSavedCardsEnabled()) {
    assertApprovedDemoCard(paymentCard.cardNumber);
  }

  const dates = subscriptionDates(plan.id);
  const supportingDocument = payload.supportingDocumentData
    ? await saveVendorApplicationDocument(payload.supportingDocumentData)
    : null;
  const insertedApplication = await client.query(
    `INSERT INTO vendor_applications
       (user_id, full_name, brand_name, contact_number, business_email, business_address, business_description,
        subscription_plan, subscription_price, supporting_document, payment_status, subscription_status,
        subscription_start_date, subscription_expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'paid', 'pending_admin_review', $11, $12)
     RETURNING *`,
    [
      user.id,
      payload.fullName,
      payload.brandName,
      payload.contactNumber,
      payload.businessEmail,
      payload.businessAddress,
      payload.businessDescription,
      plan.id,
      plan.price,
      supportingDocument,
      dates.start,
      dates.expiry
    ]
  );
  const application = insertedApplication.rows[0];
  const reference = transactionReference();
  const brand = paymentCard.cardBrand || cardBrandFromNumber(paymentCard.cardNumber);
  const last4 = paymentCard.cardLastFour || paymentCard.cardNumber.slice(-4);
  const insertedPayment = await client.query(
    `INSERT INTO vendor_subscription_payments
       (user_id, vendor_application_id, subscription_plan, billing_period, amount, payment_method, payment_status,
        transaction_reference, idempotency_key, payment_date, subscription_start_date, subscription_expiry_date,
        cardholder_name, card_brand, card_last4, metadata)
     VALUES ($1, $2, $3, $4, $5, 'card', 'paid', $6, $7, NOW(), $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      user.id,
      application.id,
      plan.id,
      plan.id,
      plan.price,
      reference,
      payload.idempotencyKey,
      dates.start,
      dates.expiry,
      paymentCard.cardholderName,
      brand,
      last4,
      {
        source: "vendor_application",
        savedPaymentMethodId: savedDemoCard?.id || null,
        savedPaymentPreferenceId: savedPayment?.id || null
      }
    ]
  );
  await client.query("UPDATE vendor_applications SET vendor_payment_id = $1 WHERE id = $2", [insertedPayment.rows[0].id, application.id]);

  if (!savedDemoCard && (payload.saveCardDetails || payload.savePaymentPreference) && payload.card) {
    const [expiryMonth, expiryYearShort] = payload.card.expiryDate.split("/").map(Number);
    await saveDemoPaymentMethodInTransaction(client, user.id, {
      nickname: payload.savedCard?.nickname || `${paymentCard.cardholderName}'s ${last4}`,
      cardholderName: paymentCard.cardholderName,
      cardNumber: paymentCard.cardNumber,
      expiryMonth,
      expiryYear: 2000 + expiryYearShort,
      billingAddress: payload.savedCard?.billingAddress || payload.businessAddress,
      billingCity: payload.savedCard?.billingCity || "N/A",
      billingState: payload.savedCard?.billingState || "",
      billingCountry: payload.savedCard?.billingCountry || "Nepal",
      postalCode: payload.savedCard?.postalCode || "N/A",
      isDefault: Boolean(payload.saveCardAsDefault || payload.saveCardDetails || payload.savePaymentPreference)
    });
  }

  const hydrated = await getApplicationWithPayment(client, application.id);
  const notifications = await createOrderNotificationsInTransaction(client, await adminIds(client), {
    type: "vendor_application_submitted",
    title: "Paid vendor application",
    message: `${payload.brandName} paid ${plan.currency} ${plan.price.toLocaleString("en-NP")} for the ${plan.name} and requires review.`,
    metadata: {
      targetType: "vendor_application",
      targetId: application.id,
      targetUrl: `/admin/dashboard/vendor-applications?applicationId=${application.id}`,
      paymentStatus: "paid",
      transactionReference: reference
    }
  });

  return { application: mapVendorApplication(hydrated), notifications, duplicate: false };
}

export async function approveVendorApplicationForAdmin(client, applicationId, admin, adminMessage = "") {
  const existing = await client.query(
    `SELECT vendor_applications.*, users.role AS user_role, users.email AS user_email, users.name AS user_name,
            payments.id AS payment_id, payments.payment_status AS linked_payment_status
     FROM vendor_applications
     JOIN users ON users.id = vendor_applications.user_id
     LEFT JOIN vendor_subscription_payments AS payments ON payments.id = vendor_applications.vendor_payment_id
     WHERE vendor_applications.id = $1
     FOR UPDATE OF vendor_applications, users`,
    [applicationId]
  );
  const application = existing.rows[0];
  if (!application) throw notFound("Vendor application not found");
  if (application.status !== "pending") {
    throw new AppError("This vendor application has already been reviewed.", 409);
  }
  if (application.payment_status !== "paid" || !application.payment_id || application.linked_payment_status !== "paid") {
    throw new AppError("Vendor access can only be approved after a confirmed paid subscription payment.", 409);
  }
  if (application.user_role !== "user") {
    throw new AppError("Only regular user accounts can be approved for vendor access.", 409);
  }

  const updated = await client.query(
    `UPDATE vendor_applications
     SET status = 'approved',
         admin_message = NULLIF($2, ''),
         reviewed_at = NOW(),
         reviewed_by = $3,
         subscription_status = 'active',
         payment_status = 'paid'
     WHERE id = $1
       AND status = 'pending'
     RETURNING *`,
    [applicationId, adminMessage, admin.id]
  );
  if (!updated.rows[0]) throw new AppError("This vendor application has already been reviewed.", 409);

  const promoted = await client.query(
    `UPDATE users
     SET role = 'vendor',
         brand_name = $2,
         brand_description = $3
     WHERE id = $1
       AND role = 'user'
     RETURNING *`,
    [application.user_id, application.brand_name, application.business_description]
  );
  if (!promoted.rows[0]) throw new AppError("Only regular user accounts can be approved for vendor access.", 409);

  const notifications = await createOrderNotificationsInTransaction(client, [application.user_id], {
    type: "vendor_application_approved",
    title: "Vendor application approved",
    message: `Your paid ${planLabel(application.subscription_plan)} application has been approved. Vendor access is active.`,
    metadata: {
      targetType: "vendor_application",
      targetId: applicationId,
      targetUrl: "/vendor/dashboard"
    }
  });

  const hydrated = await getApplicationWithPayment(client, applicationId);
  return {
    application: mapVendorApplication(hydrated || { ...updated.rows[0], user_email: application.user_email, user_name: application.user_name }),
    user: serializeUser(promoted.rows[0]),
    notifications,
    email: {
      to: application.user_email,
      approved: true,
      brandName: application.brand_name,
      planLabel: planLabel(application.subscription_plan),
      adminMessage
    }
  };
}

export async function rejectVendorApplicationForAdmin(client, applicationId, admin, adminMessage) {
  const existing = await client.query(
    `SELECT vendor_applications.*, users.email AS user_email, users.name AS user_name
     FROM vendor_applications
     JOIN users ON users.id = vendor_applications.user_id
     WHERE vendor_applications.id = $1
     FOR UPDATE OF vendor_applications`,
    [applicationId]
  );
  const application = existing.rows[0];
  if (!application) throw notFound("Vendor application not found");
  if (application.status !== "pending") {
    throw new AppError("This vendor application has already been reviewed.", 409);
  }

  const updated = await client.query(
    `UPDATE vendor_applications
     SET status = 'rejected',
         admin_message = $2,
         reviewed_at = NOW(),
         reviewed_by = $3,
         subscription_status = 'rejected'
     WHERE id = $1
       AND status = 'pending'
     RETURNING *`,
    [applicationId, adminMessage, admin.id]
  );
  if (!updated.rows[0]) throw new AppError("This vendor application has already been reviewed.", 409);

  const notifications = await createOrderNotificationsInTransaction(client, [application.user_id], {
    type: "vendor_application_rejected",
    title: "Vendor application rejected",
    message: `Your ${planLabel(application.subscription_plan)} application was rejected. Review the reason before applying again.`,
    metadata: {
      targetType: "vendor_application",
      targetId: applicationId,
      targetUrl: "/vendor-application/status"
    }
  });

  const hydrated = await getApplicationWithPayment(client, applicationId);
  return {
    application: mapVendorApplication(hydrated || { ...updated.rows[0], user_email: application.user_email, user_name: application.user_name }),
    notifications,
    email: {
      to: application.user_email,
      approved: false,
      brandName: application.brand_name,
      planLabel: planLabel(application.subscription_plan),
      adminMessage
    }
  };
}

async function sendDecisionEmailBestEffort(payload) {
  try {
    await sendVendorApplicationDecisionEmail(payload.to, payload);
  } catch (error) {
    console.warn(`[VASTRA vendor application email] ${error.message}`);
  }
}

export async function listVendorPlans(_req, res) {
  res.json({ plans: Object.values(VENDOR_SUBSCRIPTION_PLANS) });
}

export async function myVendorApplication(req, res) {
  const { rows } = await query(
    `SELECT vendor_applications.*,
            payments.id AS payment_id,
            payments.amount AS payment_amount,
            payments.payment_method AS payment_payment_method,
            payments.payment_status AS payment_payment_status,
            payments.transaction_reference AS payment_transaction_reference,
            payments.payment_date AS payment_payment_date,
            payments.subscription_plan AS payment_subscription_plan,
            payments.billing_period AS payment_billing_period,
            payments.subscription_start_date AS payment_subscription_start_date,
            payments.subscription_expiry_date AS payment_subscription_expiry_date,
            payments.cardholder_name AS payment_cardholder_name,
            payments.card_brand AS payment_card_brand,
            payments.card_last4 AS payment_card_last4
     FROM vendor_applications
     LEFT JOIN vendor_subscription_payments AS payments ON payments.id = vendor_applications.vendor_payment_id
     WHERE vendor_applications.user_id = $1
     ORDER BY vendor_applications.created_at DESC
     LIMIT 1`,
    [req.user.id]
  );
  res.json({
    application: mapVendorApplication(rows[0]),
    accountRole: req.user.role
  });
}

export async function submitVendorApplicationPayment(req, res) {
  let result;
  try {
    result = await withTransaction((client) => createPaidVendorApplicationForUser(client, req.user, req.body));
  } catch (error) {
    if (error.code === "23505") {
      const constraint = String(error.constraint || "");
      if (constraint.includes("vendor_subscription_payments_user_id_idempotency_key_key")) {
        throw new AppError("This payment has already been submitted. Refresh your application status.", 409);
      }
      if (constraint.includes("idx_vendor_applications_one_open")) {
        throw new AppError("You already have an active vendor application.", 409);
      }
    }
    throw error;
  }
  emitDashboardUpdated("vendor-applications");
  await emitCreatedOrderNotifications(result.notifications);
  res.status(result.duplicate ? 200 : 201).json({
    application: result.application,
    message: result.duplicate
      ? "This vendor subscription payment was already completed."
      : "Vendor subscription payment successful. Your application is pending admin review."
  });
}

export async function listVendorApplications(req, res) {
  const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "";
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const params = [];
  const where = status ? "WHERE vendor_applications.status = $1" : "";
  if (status) params.push(status);
  const count = await query(`SELECT COUNT(*)::int AS total FROM vendor_applications ${where}`, params);
  params.push(limit, offset);
  const limitParam = `$${params.length - 1}`;
  const offsetParam = `$${params.length}`;
  const { rows } = await query(
    `SELECT vendor_applications.*,
            applicants.name AS applicant_name,
            applicants.email AS applicant_email,
            reviewers.name AS reviewed_by_name,
            payments.id AS payment_id,
            payments.amount AS payment_amount,
            payments.payment_method AS payment_payment_method,
            payments.payment_status AS payment_payment_status,
            payments.transaction_reference AS payment_transaction_reference,
            payments.payment_date AS payment_payment_date,
            payments.subscription_plan AS payment_subscription_plan,
            payments.billing_period AS payment_billing_period,
            payments.subscription_start_date AS payment_subscription_start_date,
            payments.subscription_expiry_date AS payment_subscription_expiry_date,
            payments.cardholder_name AS payment_cardholder_name,
            payments.card_brand AS payment_card_brand,
            payments.card_last4 AS payment_card_last4
     FROM vendor_applications
     JOIN users AS applicants ON applicants.id = vendor_applications.user_id
     LEFT JOIN users AS reviewers ON reviewers.id = vendor_applications.reviewed_by
     LEFT JOIN vendor_subscription_payments AS payments ON payments.id = vendor_applications.vendor_payment_id
     ${where}
     ORDER BY vendor_applications.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );
  res.json({
    applications: rows.map(mapVendorApplication),
    meta: { page, limit, total: count.rows[0].total, totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

export async function getVendorApplication(req, res) {
  const application = await getApplicationWithPayment(query, req.params.id);
  if (!application) throw notFound("Vendor application not found");
  res.json({ application: mapVendorApplication(application) });
}

export async function approveVendorApplication(req, res) {
  const result = await withTransaction((client) => approveVendorApplicationForAdmin(client, req.params.id, req.user, req.body.adminMessage));
  emitDashboardUpdated("vendor-applications");
  emitDashboardUpdated("vendors");
  emitDashboardUpdated("users");
  emitUserRoleChanged(result.user);
  await emitCreatedOrderNotifications(result.notifications);
  await sendDecisionEmailBestEffort(result.email);
  res.json({
    application: result.application,
    user: result.user,
    message: "Vendor application approved. The applicant is now a vendor."
  });
}

export async function rejectVendorApplication(req, res) {
  const result = await withTransaction((client) => rejectVendorApplicationForAdmin(client, req.params.id, req.user, req.body.adminMessage));
  emitDashboardUpdated("vendor-applications");
  await emitCreatedOrderNotifications(result.notifications);
  await sendDecisionEmailBestEffort(result.email);
  res.json({
    application: result.application,
    message: "Vendor application rejected."
  });
}
