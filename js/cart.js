import { apiJson }     from "./api.js";
import { getCartId }   from "./storage.js";
import { updateCartBadge, showToast, initSearchNav } from "./common.js";

const fmt = (v) => `$${Number(v).toFixed(2)}`;
const clamp = (n, lo, hi) => (Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo);

// ── API calls (unchanged) ─────────────────────────────────────────────────
async function apiSetQty(cartItemId, qty) {
  await apiJson(`/api/cart/items/${cartItemId}`, {
    method: "PATCH",
    body: JSON.stringify({ cartId: getCartId(), qty }),
  });
}
async function apiRemove(cartItemId) {
  await apiJson(`/api/cart/items/${cartItemId}?cartId=${encodeURIComponent(getCartId())}`, {
    method: "DELETE",
  });
}

// ── Totals update ─────────────────────────────────────────────────────────
function updateTotals(items) {
  const sub = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const subEl   = document.querySelector("[data-subtotal]");
  const totalEl = document.querySelector("[data-total]");
  if (subEl)   subEl.textContent   = fmt(sub);
  if (totalEl) totalEl.textContent = fmt(sub);          // delivery TBD at checkout

  const countEl = document.querySelector("[data-cart-count]");
  if (countEl) {
    const n = items.reduce((s, i) => s + i.qty, 0);
    countEl.textContent = n ? `${n} бараа` : "";
  }

  const checkoutBtn = document.querySelector("[data-checkout-btn]");
  if (checkoutBtn) checkoutBtn.style.pointerEvents = items.length ? "" : "none";
}

// ── Build one cart item card ──────────────────────────────────────────────
function buildItem(item) {
  const card = document.createElement("div");
  card.className = "cartItem";
  card.dataset.cartItemId = item.id;

  card.innerHTML = `
    <a class="cartItem__imgLink" href="/product/${encodeURIComponent(item.product.id)}" tabindex="-1" aria-hidden="true">
      <img class="cartItem__img" src="${item.product.imageUrl}" alt="${item.product.name}" loading="lazy" />
    </a>

    <div class="cartItem__body">
      <div class="cartItem__meta">
        <a class="cartItem__name" href="/product/${encodeURIComponent(item.product.id)}">${item.product.name}</a>
        ${item.product.category ? `<span class="cartItem__cat">${item.product.category}</span>` : ""}
        <div class="cartItem__price">${fmt(item.product.price)}</div>
      </div>

      <div class="cartItem__controls">
        <div class="cartItem__qtyWrap">
          <button class="cartItem__qtyBtn" type="button" data-qty-dec aria-label="Бага болгох">−</button>
          <input class="cartItem__qtyInput" type="number" inputmode="numeric"
            value="${item.qty}" min="1" max="99" aria-label="Тоо ширхэг" data-qty-input />
          <button class="cartItem__qtyBtn" type="button" data-qty-inc aria-label="Их болгох">+</button>
        </div>
        <button class="cartItem__remove" type="button" data-remove aria-label="Устгах">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `.trim();

  return card;
}

// ── Show empty state ──────────────────────────────────────────────────────
function showEmpty() {
  const list  = document.querySelector("[data-cart-list]");
  const empty = document.querySelector("[data-cart-empty]");
  if (list)  list.replaceChildren();
  if (empty) empty.hidden = false;
  updateTotals([]);

  const checkoutBtn = document.querySelector("[data-checkout-btn]");
  if (checkoutBtn) checkoutBtn.style.opacity = "0.45";
}

// ── Load & render ─────────────────────────────────────────────────────────
let _items = [];   // in-memory cache for optimistic updates

async function load() {
  const list  = document.querySelector("[data-cart-list]");
  const empty = document.querySelector("[data-cart-empty]");
  if (!list) return;

  const data = await apiJson(`/api/cart?cartId=${encodeURIComponent(getCartId())}`);
  _items = data.items || [];

  if (!_items.length) {
    showEmpty();
    return;
  }

  if (empty) empty.hidden = true;
  list.replaceChildren(..._items.map(buildItem));
  updateTotals(_items);
}

// ── Event delegation ──────────────────────────────────────────────────────
function wire() {
  document.addEventListener("click", async (e) => {
    const card = e.target.closest(".cartItem");
    if (!card) return;
    const id = card.dataset.cartItemId;
    if (!id) return;

    // Remove
    if (e.target.closest("[data-remove]")) {
      card.style.opacity = "0.4";
      card.style.pointerEvents = "none";
      try {
        await apiRemove(id);
        await load();
        updateCartBadge();
        showToast("Сагснаас хаслаа");
      } catch {
        card.style.opacity = "";
        card.style.pointerEvents = "";
        showToast("Устгаж чадсангүй", "warn");
      }
      return;
    }

    const input   = card.querySelector("[data-qty-input]");
    const current = clamp(Number(input?.value), 1, 99);

    if (e.target.closest("[data-qty-inc]")) {
      const next = Math.min(99, current + 1);
      if (input) input.value = next;
      try {
        await apiSetQty(id, next);
        // update in-memory & totals without full re-render
        const item = _items.find((x) => String(x.id) === String(id));
        if (item) { item.qty = next; updateTotals(_items); updateCartBadge(); }
      } catch { await load(); }
    }

    if (e.target.closest("[data-qty-dec]")) {
      const next = Math.max(1, current - 1);
      if (input) input.value = next;
      try {
        await apiSetQty(id, next);
        const item = _items.find((x) => String(x.id) === String(id));
        if (item) { item.qty = next; updateTotals(_items); updateCartBadge(); }
      } catch { await load(); }
    }
  });

  // Direct input change
  document.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-qty-input]");
    if (!input) return;
    const card = input.closest(".cartItem");
    const id   = card?.dataset?.cartItemId;
    if (!id) return;
    const qty = clamp(Number(input.value), 1, 99);
    input.value = qty;
    try {
      await apiSetQty(id, qty);
      const item = _items.find((x) => String(x.id) === String(id));
      if (item) { item.qty = qty; updateTotals(_items); updateCartBadge(); }
    } catch { await load(); }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
wire();
load().then(() => updateCartBadge());
initSearchNav();
