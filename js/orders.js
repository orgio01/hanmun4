import { apiJson } from "./api.js";
import { getLastOrderNumber } from "./storage.js";
import { initSearchNav, updateCartBadge } from "./common.js";

function formatMoney(value) {
  return `$${Number(value).toFixed(2)}`;
}

function setError(msg) {
  const el = document.querySelector("[data-error]");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

function setText(sel, value) {
  const el = document.querySelector(sel);
  if (el) el.textContent = value;
}

function statusLabel(order) {
  const s = order.status;
  const ps = order.paymentStatus;
  if (ps !== "paid") return "Awaiting payment";
  if (s === "processing") return "Processing";
  if (s === "out_for_delivery") return "Out for delivery";
  if (s === "delivered") return "Delivered";
  if (s === "cancelled") return "Cancelled";
  return s;
}

function updateProgress(order) {
  const root = document.querySelector("[data-progress]");
  if (!root) return;

  const stepIndex = (key) => ["paid", "processing", "out_for_delivery", "delivered"].indexOf(key);

  let current = -1;
  if (order.paymentStatus === "paid") current = stepIndex("paid");
  if (order.status === "processing") current = stepIndex("processing");
  if (order.status === "out_for_delivery") current = stepIndex("out_for_delivery");
  if (order.status === "delivered") current = stepIndex("delivered");

  const steps = [...root.querySelectorAll(".progress__step")];
  steps.forEach((s) => {
    const k = s.getAttribute("data-step");
    const i = stepIndex(k);
    s.classList.toggle("is-done", i <= current && current >= 0);
    s.classList.toggle("is-current", i === current && current >= 0);
  });

  const lines = [...root.querySelectorAll(".progress__line")];
  lines.forEach((line, i) => {
    line.classList.toggle("is-done", i < current);
  });
}

function renderItems(root, items) {
  root.innerHTML = items
    .map(
      (i) => `
      <div class="orderItem">
        <div class="orderItem__name">${i.name}</div>
        <div class="orderItem__meta">
          <span class="pill">${i.qty} × ${formatMoney(i.price)}</span>
          <a class="link" href="./product.html?id=${encodeURIComponent(i.productId)}">View</a>
        </div>
      </div>
    `.trim(),
    )
    .join("");
}

async function track(orderNumber, silent = false) {
  if (!silent) setError("");
  const panel = document.querySelector("[data-order]");
  if (!panel) return;

  const out = await apiJson(`/api/orders/${encodeURIComponent(orderNumber)}`);
  panel.hidden = false;

  setText("[data-order-number]", out.orderNumber);
  setText("[data-order-status]", statusLabel(out));
  setText(
    "[data-order-meta]",
    `Payment: ${out.paymentStatus} • Delivery: ${out.shipment?.status || "—"}`,
  );
  updateProgress(out);

  setText("[data-t-sub]", formatMoney(out.totals.subtotal));
  setText("[data-t-del]", formatMoney(out.totals.deliveryFee));
  setText("[data-t-total]", formatMoney(out.totals.total));

  setText("[data-ship-status]", out.shipment?.status || "—");
  setText("[data-ship-eta]", out.shipment?.eta || "—");

  const itemsRoot = document.querySelector("[data-order-items]");
  if (itemsRoot) renderItems(itemsRoot, out.items || []);
}

let _trackingOrder = "";
let _pollTimer = null;

function startPolling(orderNumber) {
  stopPolling();
  // Auto-refresh every 20 seconds to catch admin status updates
  _pollTimer = setInterval(() => {
    track(orderNumber, true).catch(() => {});
  }, 20000);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function main() {
  const form  = document.querySelector("[data-track-form]");
  const input = document.querySelector("#order");
  if (!form || !input) return;

  const params = new URLSearchParams(window.location.search);
  const preset = params.get("order") || getLastOrderNumber();
  if (preset) {
    input.value = preset;
    _trackingOrder = preset;
    track(preset).then(() => startPolling(preset))
      .catch((e) => setError(e?.message || "Захиалга олдсонгүй"));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const order = input.value.trim();
    if (!order) return;
    stopPolling();
    _trackingOrder = order;
    track(order).then(() => startPolling(order))
      .catch((err) => setError(err?.message || "Захиалга олдсонгүй"));
  });

  // Stop polling when page is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPolling();
    else if (_trackingOrder) startPolling(_trackingOrder);
  });
}

main();
initSearchNav();
updateCartBadge();

