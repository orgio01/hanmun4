import {
  FIREBASE_READY, fetchAllProducts, fetchAllUsers, setBanUser,
  addProduct, updateProduct, deleteProduct, uploadProductImage,
} from "./firebase.js";
import { apiJson } from "./api.js";

// ── Config ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "blackzebra617@gmail.com";

// ── Helpers ───────────────────────────────────────────────────────────────
const qs  = (sel, r = document) => r.querySelector(sel);
const qsa = (sel, r = document) => [...r.querySelectorAll(sel)];
const fmt = (v) => `$${Number(v).toFixed(2)}`;
const setText = (sel, v, r = document) => { const el = qs(sel, r); if (el) el.textContent = v; };

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── Order status config ───────────────────────────────────────────────────
const ORDER_STATUSES = {
  awaiting_payment: { label: "Төлбөр хүлээж байна", color: "gray"   },
  processing:       { label: "Боловсруулж байна",    color: "blue"   },
  out_for_delivery: { label: "Хүргэлтэнд гарсан",   color: "orange" },
  delivered:        { label: "Хүргэгдсэн",           color: "green"  },
  cancelled:        { label: "Цуцлагдсан",           color: "red"    },
};

const NEXT_STATUS = {
  awaiting_payment: "processing",
  processing:       "out_for_delivery",
  out_for_delivery: "delivered",
};

const NEXT_LABEL = {
  awaiting_payment: "✓ Хүлээн авах",
  processing:       "🚚 Хүргэлтэнд гаргах",
  out_for_delivery: "🏠 Хүргэгдсэн",
};

function statusBadge(status) {
  const s = ORDER_STATUSES[status] || { label: status, color: "gray" };
  return `<span class="adminBadge adminBadge--${s.color}">${s.label}</span>`;
}

// ── Auth ──────────────────────────────────────────────────────────────────
let _currentUser = null;

async function checkAuth() {
  if (!FIREBASE_READY) { showApp({ email: ADMIN_EMAIL, displayName: "Admin" }, null); return; }
  const { onAuth } = await import("./auth.js");
  onAuth((user, profile) => {
    if (user && user.email === ADMIN_EMAIL) {
      _currentUser = user;
      showApp(user, profile);
    } else if (user) {
      showGate("Энэ и-мэйл admin эрхгүй.");
    } else {
      showGate("");
    }
  });
}

function showGate(err) {
  qs("[data-auth-gate]").hidden = false;
  qsa("[data-admin-page]").forEach(p => p.hidden = true);
  if (err) { const el = qs("[data-gate-error]"); el.textContent = err; el.hidden = false; }
}

function showApp(user, profile) {
  qs("[data-auth-gate]").hidden = true;
  setText("[data-admin-name]",  profile?.name || user.displayName || "Admin");
  setText("[data-admin-email]", user.email || "");
  const av = qs("[data-admin-avatar]");
  if (av) av.textContent = (profile?.name || "A")[0].toUpperCase();
  navigateTo("dashboard");
  loadDashboard();
}

qs("[data-gate-login]")?.addEventListener("click", async () => {
  const email = qs("#gateEmail")?.value.trim();
  const pw    = qs("#gatePass")?.value;
  const btn   = qs("[data-gate-login]");
  const err   = qs("[data-gate-error]");
  err.hidden = true; btn.disabled = true; btn.textContent = "Нэвтэрж байна…";
  try {
    if (FIREBASE_READY) { const { signIn } = await import("./auth.js"); await signIn(email, pw); }
    else { if (email !== ADMIN_EMAIL) throw new Error("Admin эрхгүй"); showApp({ email, displayName: "Admin" }, null); }
  } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "Нэвтрэх"; }
});

qs("[data-logout]")?.addEventListener("click", async () => {
  if (FIREBASE_READY) { const { logOut } = await import("./auth.js"); await logOut(); }
  window.location.reload();
});

// ── Navigation ────────────────────────────────────────────────────────────
const PAGE_TITLES = { dashboard: "Dashboard", products: "Бараа удирдлага", orders: "Захиалга удирдлага", users: "Хэрэглэгчид" };

function navigateTo(page) {
  qsa("[data-admin-page]").forEach(p => p.hidden = p.dataset.adminPage !== page);
  qsa("[data-nav]").forEach(a => a.classList.toggle("is-active", a.dataset.nav === page));
  setText("[data-page-title]", PAGE_TITLES[page] || page);
  qs("[data-open-add-product]").hidden = page !== "products";
  if (page === "products") loadProducts();
  if (page === "orders")   loadOrders();
  if (page === "users")    loadUsers();
}

qsa("[data-nav]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigateTo(a.dataset.nav); }));
qs("#menuToggle")?.addEventListener("click", () => qs("#adminSide")?.classList.toggle("is-open"));

// ── Dashboard ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const ps = await fetchAllProducts();
    setText("[data-stat-products]", ps.length);
    setText("[data-products-count]", ps.length);
    setText("[data-stat-lowstock]", ps.filter(p => p.stockQty <= 5).length);
  } catch {}
  try {
    const { orders } = await apiJson("/api/admin/orders");
    setText("[data-stat-orders]",  orders.length);
    setText("[data-orders-count]", orders.length);
    const revenue = orders.filter(o => o.paymentStatus === "paid").reduce((s, o) => s + o.totals.total, 0);
    setText("[data-stat-revenue]", fmt(revenue));
    const tbody = qs("[data-recent-orders-body]");
    if (tbody) {
      tbody.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
          <td><code>${o.orderNumber}</code></td>
          <td>${o.customer?.name || "—"}</td>
          <td>${fmt(o.totals?.total || 0)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${fmtDate(o.createdAt).slice(0,10)}</td>
        </tr>`).join("");
    }
  } catch {
    setText("[data-stat-orders]",  "—");
    setText("[data-stat-revenue]", "—");
    const tbody = qs("[data-recent-orders-body]");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="adminTable__empty">Сервер offline</td></tr>`;
  }
}

// ── Products ──────────────────────────────────────────────────────────────
let _allProducts = [], _filteredProducts = [];

async function loadProducts() {
  const tbody = qs("[data-products-tbody]");
  tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty">Уншиж байна…</td></tr>`;
  try {
    _allProducts = await fetchAllProducts();
    _filteredProducts = _allProducts;
    renderProductsTable(_allProducts);
    setText("[data-products-count]", _allProducts.length);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty adminTable__empty--error">${err.message}</td></tr>`;
  }
}

function renderProductsTable(products) {
  const tbody = qs("[data-products-tbody]");
  if (!products.length) { tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty">Бараа олдсонгүй</td></tr>`; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.imageUrl||''}" class="adminTable__thumb" onerror="this.style.display='none'" /></td>
      <td><div class="adminTable__productName">${p.name}</div><div class="adminTable__productDesc">${(p.description||'').slice(0,55)}</div></td>
      <td><span class="adminBadge adminBadge--gray">${p.category||'—'}</span></td>
      <td><strong>${fmt(p.price)}</strong>${p.priceWas?`<br><span class="adminTable__was">${fmt(p.priceWas)}</span>`:''}</td>
      <td><span class="${p.stockQty<=5?'adminBadge adminBadge--red':'adminBadge adminBadge--green'}">${p.stockQty}</span></td>
      <td><div class="adminTable__actions">
        <button class="adminTable__editBtn" data-edit="${p.id}" title="Засах">✏️</button>
        <button class="adminTable__delBtn"  data-del="${p.id}"  title="Устгах">🗑</button>
      </div></td>
    </tr>`).join("");
}

qs("[data-product-search]")?.addEventListener("input", filterProducts);
qs("[data-cat-filter]")?.addEventListener("change", filterProducts);
function filterProducts() {
  const q = (qs("[data-product-search]")?.value||"").toLowerCase();
  const cat = qs("[data-cat-filter]")?.value||"";
  _filteredProducts = _allProducts.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q)) &&
    (!cat || p.category === cat));
  renderProductsTable(_filteredProducts);
}

document.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn && qs("[data-products-tbody]")?.contains(editBtn)) {
    const p = _allProducts.find(x => x.id === editBtn.dataset.edit);
    if (p) openProductModal(p);
    return;
  }
  const delBtn = e.target.closest("[data-del]");
  if (delBtn && qs("[data-products-tbody]")?.contains(delBtn)) {
    const p = _allProducts.find(x => x.id === delBtn.dataset.del);
    if (!p || !confirm(`"${p.name}" устгах уу?`)) return;
    try { await deleteProduct(p.id); _allProducts = _allProducts.filter(x=>x.id!==p.id); filterProducts(); setText("[data-products-count]",_allProducts.length); }
    catch (err) { alert("Устгаж чадсангүй: "+err.message); }
  }
});

// Product modal
function openProductModal(product=null) {
  const modal=qs("[data-product-modal]"), form=qs("[data-product-form]"), err=qs("[data-form-error]");
  qs("[data-modal-title]").textContent = product?"Бараа засах":"Бараа нэмэх";
  err.hidden=true; form.reset();
  qs("[data-product-id]").value = product?.id||"";
  if (product) {
    const sv=(n,v)=>{const el=form.querySelector(`[name=${n}]`);if(el)el.value=v;};
    sv("name",product.name||""); sv("category",product.category||"");
    sv("price",product.price||""); sv("priceWas",product.priceWas||"");
    sv("stockQty",product.stockQty||0); sv("description",product.description||"");
    sv("imageUrl",product.imageUrl||""); sv("tags",(product.tags||[]).join(", "));
  }
  modal.hidden=false; document.body.style.overflow="hidden";
  form.querySelector("[name=name]")?.focus();

  // Image file upload
  const fileInput   = form.querySelector("[data-img-file]");
  const urlInput    = form.querySelector("[data-img-url-input]");
  const uploadLabel = form.querySelector("[data-img-upload-label-text]");
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    uploadLabel.textContent = "Uploading…";
    try {
      const url = await uploadProductImage(file, product?.id || `new_${Date.now()}`);
      if (urlInput) urlInput.value = url;
      uploadLabel.textContent = "✓ Upload амжилттай";
    } catch (e) {
      uploadLabel.textContent = "Upload алдаа: " + e.message;
    }
  });
}
function closeProductModal() { qs("[data-product-modal]").hidden=true; document.body.style.overflow=""; }
qsa("[data-modal-close]").forEach(el=>el.addEventListener("click",closeProductModal));
qs("[data-open-add-product]")?.addEventListener("click",()=>openProductModal(null));

qs("[data-product-form]")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form=e.target, saveBtn=qs("[data-save-btn]"), err=qs("[data-form-error]"), id=qs("[data-product-id]")?.value;
  err.hidden=true; saveBtn.disabled=true; saveBtn.textContent="Хадгалж байна…";
  const data={
    name:form.querySelector("[name=name]").value.trim(), category:form.querySelector("[name=category]").value,
    price:Number(form.querySelector("[name=price]").value), priceWas:Number(form.querySelector("[name=priceWas]").value)||null,
    stockQty:Number(form.querySelector("[name=stockQty]").value), description:form.querySelector("[name=description]").value.trim(),
    imageUrl:form.querySelector("[name=imageUrl]").value.trim(),
    tags:form.querySelector("[name=tags]").value.split(",").map(t=>t.trim()).filter(Boolean),
  };
  try {
    if (id) { await updateProduct(id,data); const idx=_allProducts.findIndex(p=>p.id===id); if(idx>=0)_allProducts[idx]={id,...data}; }
    else { const newId=await addProduct(data); _allProducts.unshift({id:newId,...data}); }
    filterProducts(); setText("[data-products-count]",_allProducts.length); closeProductModal();
  } catch(ex) { err.textContent=ex.message; err.hidden=false; }
  finally { saveBtn.disabled=false; saveBtn.textContent="Хадгалах"; }
});

// ══════════════════════════════════════════════════════════════════════════
// ORDERS with status control
// ══════════════════════════════════════════════════════════════════════════
let _allOrders = [], _filteredOrders = [];

async function loadOrders() {
  const tbody = qs("[data-orders-tbody]");
  tbody.innerHTML = `<tr><td colspan="7" class="adminTable__empty">Уншиж байна…</td></tr>`;
  try {
    const { orders } = await apiJson("/api/admin/orders");
    _allOrders = orders;
    _filteredOrders = orders;
    renderOrdersTable(orders);
    setText("[data-stat-orders]",  orders.length);
    setText("[data-orders-count]", orders.length);
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" class="adminTable__empty adminTable__empty--error">
      Сервер offline. <code>npm start</code> ажиллуулна уу.
    </td></tr>`;
  }
}

function renderOrdersTable(orders) {
  const tbody = qs("[data-orders-tbody]");
  if (!orders.length) { tbody.innerHTML = `<tr><td colspan="7" class="adminTable__empty">Захиалга байхгүй</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => {
    const nextStatus = NEXT_STATUS[o.status];
    const nextLabel  = NEXT_LABEL[o.status];
    return `<tr data-order-row="${o.orderNumber}">
      <td><code style="font-size:.8rem">${o.orderNumber}</code></td>
      <td>
        <div style="font-weight:800;font-size:.88rem">${o.customer?.name||"—"}</div>
        <div style="font-size:.76rem;color:rgba(16,16,16,.48)">${o.customer?.phone||""}</div>
      </td>
      <td><strong>${fmt(o.totals?.total||0)}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <div class="adminOrderTrack">
          ${["awaiting_payment","processing","out_for_delivery","delivered"].map(s=>`
            <div class="adminOrderTrack__step ${o.status===s?'is-current':''} ${isStepDone(o.status,s)?'is-done':''}">
              <div class="adminOrderTrack__dot"></div>
              <div class="adminOrderTrack__label">${ORDER_STATUSES[s]?.label?.split(" ")[0]||s}</div>
            </div>
          `).join('<div class="adminOrderTrack__line"></div>')}
        </div>
        ${nextStatus && o.paymentStatus!=="cancelled" ? `
          <button class="adminStatusBtn" data-next-status="${nextStatus}" data-order-num="${o.orderNumber}">
            ${nextLabel}
          </button>` : ""}
      </td>
      <td style="font-size:.8rem;color:rgba(16,16,16,.5)">${fmtDate(o.createdAt).slice(0,10)}</td>
      <td>
        <button class="adminTable__editBtn" onclick="openOrderDetail('${o.orderNumber}')" title="Харах">👁</button>
      </td>
    </tr>`;
  }).join("");
}

function isStepDone(currentStatus, step) {
  const order = ["awaiting_payment","processing","out_for_delivery","delivered"];
  return order.indexOf(currentStatus) > order.indexOf(step);
}

// Order search + filter
qs("[data-order-search]")?.addEventListener("input", filterOrders);
qs("[data-order-status-filter]")?.addEventListener("change", filterOrders);
qs("[data-refresh-orders]")?.addEventListener("click", loadOrders);

function filterOrders() {
  const q = (qs("[data-order-search]")?.value||"").toLowerCase();
  const st = qs("[data-order-status-filter]")?.value||"";
  _filteredOrders = _allOrders.filter(o =>
    (!q || o.orderNumber.toLowerCase().includes(q) || (o.customer?.name||"").toLowerCase().includes(q)) &&
    (!st || o.status === st));
  renderOrdersTable(_filteredOrders);
}

// Status update button
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-next-status]");
  if (!btn) return;
  const orderNum  = btn.dataset.orderNum;
  const newStatus = btn.dataset.nextStatus;
  const label     = ORDER_STATUSES[newStatus]?.label || newStatus;

  if (!confirm(`"${orderNum}" захиалгын байдлыг "${label}" болгох уу?`)) return;

  btn.disabled = true;
  btn.textContent = "Шинэчилж байна…";

  try {
    await apiJson(`/api/admin/orders/${encodeURIComponent(orderNum)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    // Update local cache
    const o = _allOrders.find(x => x.orderNumber === orderNum);
    if (o) o.status = newStatus;
    filterOrders();
    showAdminToast(`✓ ${label} болов`, "ok");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = NEXT_LABEL[ORDER_STATUSES[newStatus]?.prev || ""] || "Дахин оролдох";
    showAdminToast(err.message || "Алдаа гарлаа", "err");
  }
});

// Order detail modal
window.openOrderDetail = async function(orderNumber) {
  const modal = qs("[data-order-modal]");
  const body  = qs("[data-order-modal-body]");
  const title = qs("[data-order-modal-title]");
  title.textContent = `Захиалга: ${orderNumber}`;
  body.innerHTML = "Уншиж байна…";
  modal.hidden = false; document.body.style.overflow = "hidden";
  try {
    const o = await apiJson(`/api/orders/${encodeURIComponent(orderNumber)}`);
    body.innerHTML = `
      <div class="adminOrderDetail">
        <div class="adminOrderDetail__row"><b>Захиалга №</b><span>${o.orderNumber}</span></div>
        <div class="adminOrderDetail__row"><b>Хэрэглэгч</b><span>${o.customer?.name}</span></div>
        <div class="adminOrderDetail__row"><b>Утас</b><span>${o.customer?.phone}</span></div>
        <div class="adminOrderDetail__row"><b>Хаяг</b><span>${o.customer?.district}, ${o.customer?.addressLine}</span></div>
        ${o.customer?.notes?`<div class="adminOrderDetail__row"><b>Тэмдэглэл</b><span>${o.customer.notes}</span></div>`:""}
        <div class="adminOrderDetail__row"><b>Төлбөр</b><span>${o.paymentMethod} — ${o.paymentStatus==="paid"?"✓ Төлсөн":"Хүлээж байна"}</span></div>
        <div class="adminOrderDetail__row"><b>Байдал</b>${statusBadge(o.status)}</div>
        <div class="adminOrderDetail__row"><b>Бараанууд</b>
          <span>${(o.items||[]).map(i=>`${i.name} ×${i.qty} (${fmt(i.price)})`).join("<br>")}</span>
        </div>
        <div class="adminOrderDetail__row"><b>Барааны дүн</b><span>${fmt(o.totals?.subtotal)}</span></div>
        <div class="adminOrderDetail__row"><b>Хүргэлт</b><span>${fmt(o.totals?.deliveryFee)}</span></div>
        <div class="adminOrderDetail__row"><b>Нийт дүн</b><span><strong>${fmt(o.totals?.total)}</strong></span></div>
        <div class="adminOrderDetail__row"><b>Огноо</b><span>${fmtDate(o.createdAt)}</span></div>
      </div>`;
  } catch (err) { body.innerHTML = `<p style="color:red">Ачааллаж чадсангүй: ${err.message}</p>`; }
};

qsa("[data-order-modal-close]").forEach(el => el.addEventListener("click", () => {
  qs("[data-order-modal]").hidden = true; document.body.style.overflow = "";
}));

// ══════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════
let _allUsers = [], _filteredUsers = [];

async function loadUsers() {
  const tbody = qs("[data-users-tbody]");
  tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty">Уншиж байна…</td></tr>`;
  try {
    _allUsers = await fetchAllUsers();
    _filteredUsers = _allUsers;
    renderUsersTable(_allUsers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty adminTable__empty--error">
      Firebase холбогдохгүй байна: ${err.message}
    </td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = qs("[data-users-tbody]");
  if (!users.length) { tbody.innerHTML = `<tr><td colspan="6" class="adminTable__empty">Хэрэглэгч байхгүй</td></tr>`; return; }
  tbody.innerHTML = users.map(u => {
    const isBanned = u.banned === true;
    const initials = (u.name || u.email || "?")[0].toUpperCase();
    return `<tr class="${isBanned?'adminTable__row--banned':''}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="adminUserAvatar" style="background:${isBanned?'#dc2626':'#0074e9'}">${initials}</div>
          <div>
            <div style="font-weight:800;font-size:.88rem">${u.name||"Нэргүй"}</div>
            <div style="font-size:.76rem;color:rgba(16,16,16,.48)">${u.email||"—"}</div>
          </div>
        </div>
      </td>
      <td style="font-size:.86rem">${u.phone||"—"}</td>
      <td style="font-size:.82rem;color:rgba(16,16,16,.60)">${u.district?`${u.district}, ${(u.addressLine||"").slice(0,30)}`:"—"}</td>
      <td style="font-size:.78rem;color:rgba(16,16,16,.45)">${u.createdAt?u.createdAt.slice(0,10):"—"}</td>
      <td>${isBanned
        ? `<span class="adminBadge adminBadge--red">🚫 Хаагдсан</span>${u.bannedAt?`<div style="font-size:.72rem;color:rgba(16,16,16,.4);margin-top:2px">${u.bannedAt.slice(0,10)}</div>`:""}`
        : `<span class="adminBadge adminBadge--green">✓ Идэвхтэй</span>`}</td>
      <td>
        <div class="adminTable__actions">
          <button class="adminTable__editBtn" data-view-user="${u.uid}" title="Дэлгэрэнгүй">👁</button>
          ${isBanned
            ? `<button class="adminTable__editBtn" data-unban="${u.uid}" title="Нээх" style="background:rgba(25,179,122,.1);border-color:rgba(25,179,122,.3)">✓ Нээх</button>`
            : `<button class="adminTable__delBtn"  data-ban="${u.uid}"   title="Хаах">🚫 Хаах</button>`}
        </div>
      </td>
    </tr>`;
  }).join("");
}

// User search + filter
qs("[data-user-search]")?.addEventListener("input", filterUsers);
qs("[data-user-filter]")?.addEventListener("change", filterUsers);
function filterUsers() {
  const q  = (qs("[data-user-search]")?.value||"").toLowerCase();
  const ft = qs("[data-user-filter]")?.value||"";
  _filteredUsers = _allUsers.filter(u =>
    (!q || (u.name||"").toLowerCase().includes(q) || (u.email||"").toLowerCase().includes(q) || (u.phone||"").includes(q)) &&
    (!ft || (ft==="banned"?u.banned===true:u.banned!==true)));
  renderUsersTable(_filteredUsers);
}

// Ban / Unban / View delegation
document.addEventListener("click", async (e) => {
  // View user
  const viewBtn = e.target.closest("[data-view-user]");
  if (viewBtn) {
    const u = _allUsers.find(x => x.uid === viewBtn.dataset.viewUser);
    if (u) openUserDetail(u);
    return;
  }

  // Ban
  const banBtn = e.target.closest("[data-ban]");
  if (banBtn) {
    const uid = banBtn.dataset.ban;
    const u   = _allUsers.find(x => x.uid === uid);
    if (!u || !confirm(`"${u.name||u.email}" хэрэглэгчийг хаах уу?`)) return;
    banBtn.disabled = true; banBtn.textContent = "…";
    try {
      await setBanUser(uid, true);
      const idx = _allUsers.findIndex(x => x.uid === uid);
      if (idx >= 0) _allUsers[idx].banned = true;
      filterUsers();
      showAdminToast(`${u.name||u.email} хаагдлаа`, "warn");
    } catch (err) { showAdminToast(err.message, "err"); banBtn.disabled = false; banBtn.textContent = "🚫 Хаах"; }
    return;
  }

  // Unban
  const unbanBtn = e.target.closest("[data-unban]");
  if (unbanBtn) {
    const uid = unbanBtn.dataset.unban;
    const u   = _allUsers.find(x => x.uid === uid);
    if (!u) return;
    unbanBtn.disabled = true; unbanBtn.textContent = "…";
    try {
      await setBanUser(uid, false);
      const idx = _allUsers.findIndex(x => x.uid === uid);
      if (idx >= 0) _allUsers[idx].banned = false;
      filterUsers();
      showAdminToast(`${u.name||u.email} дахин нээгдлээ`, "ok");
    } catch (err) { showAdminToast(err.message, "err"); unbanBtn.disabled = false; unbanBtn.textContent = "✓ Нээх"; }
    return;
  }
});

function openUserDetail(u) {
  const modal = qs("[data-order-modal]");
  const body  = qs("[data-order-modal-body]");
  const title = qs("[data-order-modal-title]");
  title.textContent = `Хэрэглэгч: ${u.name || u.email}`;
  body.innerHTML = `
    <div class="adminOrderDetail">
      <div class="adminOrderDetail__row"><b>UID</b><code style="font-size:.8rem">${u.uid}</code></div>
      <div class="adminOrderDetail__row"><b>Нэр</b><span>${u.name||"—"}</span></div>
      <div class="adminOrderDetail__row"><b>И-мэйл</b><span>${u.email||"—"}</span></div>
      <div class="adminOrderDetail__row"><b>Утас</b><span>${u.phone||"—"}</span></div>
      <div class="adminOrderDetail__row"><b>Дүүрэг</b><span>${u.district||"—"}</span></div>
      <div class="adminOrderDetail__row"><b>Хаяг</b><span>${u.addressLine||"—"}</span></div>
      <div class="adminOrderDetail__row"><b>Байдал</b>${u.banned?`<span class="adminBadge adminBadge--red">🚫 Хаагдсан</span>`:`<span class="adminBadge adminBadge--green">✓ Идэвхтэй</span>`}</div>
      <div class="adminOrderDetail__row"><b>Бүртгүүлсэн</b><span>${u.createdAt?.slice(0,10)||"—"}</span></div>
    </div>`;
  modal.hidden = false; document.body.style.overflow = "hidden";
}

// ── Admin toast ───────────────────────────────────────────────────────────
function showAdminToast(msg, type = "ok") {
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;
    background:${type==="ok"?"#19b37a":type==="warn"?"#d97706":"#dc2626"};color:#fff;
    padding:10px 20px;font-weight:700;font-size:.88rem;box-shadow:0 4px 16px rgba(0,0,0,.2);
    animation:toastIn 220ms ease both`;
  wrap.textContent = msg;
  document.body.appendChild(wrap);
  setTimeout(() => { wrap.style.opacity="0"; wrap.style.transition="opacity 200ms ease"; setTimeout(()=>wrap.remove(),200); }, 2500);
}

// ── Init ──────────────────────────────────────────────────────────────────
checkAuth();
