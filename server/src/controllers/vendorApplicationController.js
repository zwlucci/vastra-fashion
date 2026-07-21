import { query, withTransaction } from "../config/db.js";
import { emitDashboardUpdated, emitUserRoleChanged } from "../socket.js";
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
    price: 2499,
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

function mapVendorApplication(row) {
  if (!row) return null;
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

async function adminIds(client) {
  const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin'");
  return rows.map((row) => row.id);
}

export async function createVendorApplicationForUser(client, user, payload) {
  const locked = await client.query("SELECT id, role FROM users WHERE id = $1 FOR UPDATE", [user.id]);
  const userRecord = locked.rows[0];
  if (!userRecord) throw notFound("User not found");
  if (userRecord.role !== "user") {
    throw new AppError("Only regular user accounts can submit a vendor application.", 403);
  }

  const pending = await client.query(
    "SELECT id FROM vendor_applications WHERE user_id = $1 AND status = 'pending' LIMIT 1",
    [user.id]
  );
  if (pending.rows[0]) {
    throw new AppError("You already have a pending vendor application.", 409);
  }

  const plan = vendorPlanFor(payload.subscriptionPlan);
  const supportingDocument = payload.supportingDocumentData
    ? await saveVendorApplicationDocument(payload.supportingDocumentData)
    : null;
  const { rows } = await client.query(
    `INSERT INTO vendor_applications
       (user_id, full_name, brand_name, contact_number, business_email, business_address, business_description,
        subscription_plan, subscription_price, supporting_document)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      supportingDocument
    ]
  );
  const application = rows[0];
  const notifications = await createOrderNotificationsInTransaction(client, await adminIds(client), {
    type: "vendor_application_submitted",
    title: "New vendor application",
    message: `${payload.brandName} applied for the ${plan.name}.`,
    metadata: {
      targetType: "vendor_application",
      targetId: application.id,
      targetUrl: `/admin/dashboard/vendor-applications?applicationId=${application.id}`
    }
  });

  return { application: mapVendorApplication(application), notifications };
}

export async function approveVendorApplicationForAdmin(client, applicationId, admin, adminMessage = "") {
  const existing = await client.query(
    `SELECT vendor_applications.*, users.role AS user_role, users.email AS user_email, users.name AS user_name
     FROM vendor_applications
     JOIN users ON users.id = vendor_applications.user_id
     WHERE vendor_applications.id = $1
     FOR UPDATE OF vendor_applications, users`,
    [applicationId]
  );
  const application = existing.rows[0];
  if (!application) throw notFound("Vendor application not found");
  if (application.status !== "pending") {
    throw new AppError("This vendor application has already been reviewed.", 409);
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
         subscription_status = 'pending_payment',
         payment_status = 'pending'
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
    message: `Your ${planLabel(application.subscription_plan)} application has been approved. Subscription payment activation is pending.`,
    metadata: {
      targetType: "vendor_application",
      targetId: applicationId,
      targetUrl: "/pricing"
    }
  });

  return {
    application: mapVendorApplication({ ...updated.rows[0], user_email: application.user_email, user_name: application.user_name }),
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
         subscription_status = 'rejected',
         payment_status = 'not_required'
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
      targetUrl: "/pricing"
    }
  });

  return {
    application: mapVendorApplication({ ...updated.rows[0], user_email: application.user_email, user_name: application.user_name }),
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
    `SELECT *
     FROM vendor_applications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id]
  );
  res.json({
    application: mapVendorApplication(rows[0]),
    accountRole: req.user.role
  });
}

export async function submitVendorApplication(req, res) {
  let result;
  try {
    result = await withTransaction((client) => createVendorApplicationForUser(client, req.user, req.body));
  } catch (error) {
    if (error.code === "23505" && String(error.constraint || "").includes("idx_vendor_applications_one_pending")) {
      throw new AppError("You already have a pending vendor application.", 409);
    }
    throw error;
  }
  emitDashboardUpdated("vendor-applications");
  await emitCreatedOrderNotifications(result.notifications);
  res.status(201).json({
    application: result.application,
    message: "Your vendor application has been submitted for admin review."
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
            reviewers.name AS reviewed_by_name
     FROM vendor_applications
     JOIN users AS applicants ON applicants.id = vendor_applications.user_id
     LEFT JOIN users AS reviewers ON reviewers.id = vendor_applications.reviewed_by
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
  const { rows } = await query(
    `SELECT vendor_applications.*,
            applicants.name AS applicant_name,
            applicants.email AS applicant_email,
            reviewers.name AS reviewed_by_name
     FROM vendor_applications
     JOIN users AS applicants ON applicants.id = vendor_applications.user_id
     LEFT JOIN users AS reviewers ON reviewers.id = vendor_applications.reviewed_by
     WHERE vendor_applications.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw notFound("Vendor application not found");
  res.json({ application: mapVendorApplication(rows[0]) });
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
    message: "Vendor application approved. The applicant is now a vendor; subscription payment activation remains pending."
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
