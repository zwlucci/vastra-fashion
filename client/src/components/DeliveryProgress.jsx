import React from "react";

const steps = ["pending", "processing", "shipped", "delivered"];

function labelFor(order) {
  if (order.status === "cancelled") return "Cancelled";
  if (order.returnStatus === "requested") return "Returning";
  if (order.returnStatus === "approved") return "Return Accepted";
  if (order.returnStatus === "rejected") return "Return Rejected";
  if (order.returnStatus === "completed") return "Returned";
  return order.status;
}

function timestampFor(order) {
  if (order.returnStatus === "requested") return order.returnRequestedAt;
  if (["approved", "rejected", "completed"].includes(order.returnStatus)) return order.returnDecidedAt || order.returnProcessedAt;
  if (order.status === "delivered") return order.deliveredAt;
  return order.createdAt;
}

export function DeliveryProgress({ order }) {
  const display = labelFor(order);
  const timestamp = timestampFor(order);

  if (order.status === "cancelled") {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-black">Cancelled</p>
      <p>This order will not continue through delivery.</p>
    </div>;
  }

  if (order.returnStatus && order.returnStatus !== "none") {
    return <div className="rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
      <p className="font-black">{display}</p>
      {timestamp && <p>{new Date(timestamp).toLocaleString()}</p>}
      <ReturnReason order={order} />
    </div>;
  }

  const activeIndex = Math.max(0, steps.indexOf(order.status));
  return (
    <div className="min-w-[220px] space-y-2">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;
          return <React.Fragment key={step}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete || current ? "bg-clay" : "bg-neutral-300 dark:bg-neutral-700"}`} />
            {index < steps.length - 1 && <span className={`h-0.5 flex-1 ${index < activeIndex ? "bg-clay" : "bg-neutral-300 dark:bg-neutral-700"}`} />}
          </React.Fragment>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-black capitalize text-clay">{display}</span>
        {timestamp && <span className="text-neutral-500">{new Date(timestamp).toLocaleString()}</span>}
      </div>
    </div>
  );
}

function ReturnReason({ order }) {
  if (order.returnReasonCategory) {
    return <div className="mt-1 text-neutral-700 dark:text-neutral-200">
      <p><span className="font-semibold text-clay">Reason:</span> {order.returnReasonCategory}</p>
      {order.returnReasonDetails && <p><span className="font-semibold text-clay">Details:</span> {order.returnReasonDetails}</p>}
    </div>;
  }
  if (order.returnReason) return <p className="mt-1 text-neutral-700 dark:text-neutral-200">{order.returnReason}</p>;
  return <p className="mt-1 text-neutral-700 dark:text-neutral-200">Reason not provided</p>;
}
