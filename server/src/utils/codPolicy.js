export const COD_REFUSAL_LIMIT = 3;

export const COD_REFUSAL_REASONS = [
  "Customer refused to accept the package",
  "Customer refused to pay",
  "Customer was repeatedly unavailable and later refused",
  "Customer said they no longer wanted the order after shipment",
  "Other"
];

export const COD_DISABLED_MESSAGE = "Cash on Delivery is unavailable for your account because three previous COD orders were refused during delivery. Please use an online payment method or contact support if you believe this is incorrect.";

export function buildCodPolicy(refusalCount = 0) {
  const activeRefusalCount = Math.max(0, Number(refusalCount || 0));
  const codAvailable = activeRefusalCount < COD_REFUSAL_LIMIT;
  let status = "available";
  let statusLabel = "Available";
  let warning = "";

  if (activeRefusalCount === 1) {
    status = "warning";
    statusLabel = "Available - Warning";
    warning = "You have 1 recorded COD delivery refusal. Repeated refusal of COD orders may result in COD being disabled for your account.";
  } else if (activeRefusalCount === 2) {
    status = "final_warning";
    statusLabel = "Available - Final Warning";
    warning = "Final warning: You have 2 recorded COD delivery refusals. One more confirmed refusal will disable Cash on Delivery for your account.";
  } else if (activeRefusalCount >= COD_REFUSAL_LIMIT) {
    status = "restricted";
    statusLabel = "Restricted";
    warning = "Cash on Delivery is unavailable for your account because three previous COD orders were refused during delivery. Please use card or another online payment method.";
  }

  return {
    activeRefusalCount,
    refusalLimit: COD_REFUSAL_LIMIT,
    codAvailable,
    status,
    statusLabel,
    warning
  };
}

export async function activeCodRefusalCount(client, userId) {
  const runQuery = typeof client === "function" ? client : client.query.bind(client);
  const { rows } = await runQuery(
    `SELECT COUNT(*)::int AS count
     FROM cod_refusal_records
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
  return rows[0]?.count || 0;
}

export async function getCodPolicyForUser(client, userId) {
  return buildCodPolicy(await activeCodRefusalCount(client, userId));
}

export function codRefusalNotificationMessage(activeRefusalCount) {
  if (activeRefusalCount >= COD_REFUSAL_LIMIT) {
    return "Cash on Delivery has been disabled for your account after three confirmed delivery refusals. Other payment methods remain available.";
  }
  return `A Cash on Delivery order was marked as refused during delivery. You currently have ${activeRefusalCount} of ${COD_REFUSAL_LIMIT} COD refusal records. Reaching ${COD_REFUSAL_LIMIT} will disable COD for your account.`;
}
