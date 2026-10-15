// ============================================================
// Auth guard — every page except login.html requires a session
// ============================================================
const LOGIN_PAGE = "login.html";
const CURRENT_PAGE = location.pathname.split("/").pop() || "index.html";

if (CURRENT_PAGE !== LOGIN_PAGE && localStorage.getItem("swm_loggedIn") !== "true") {
  location.href = LOGIN_PAGE;
}

// ============================================================
// Roles — "admin" has full access, "staff" is limited to
// viewing stock and updating quantities (no Manage Product).
// ============================================================
const CURRENT_ROLE = localStorage.getItem("swm_role") || "admin";
document.body.dataset.role = CURRENT_ROLE;

const STAFF_RESTRICTED_PAGES = ["products.html", "add-product.html"];

if (CURRENT_PAGE !== LOGIN_PAGE && CURRENT_ROLE === "staff" && STAFF_RESTRICTED_PAGES.includes(CURRENT_PAGE)) {
  sessionStorage.setItem("swm_accessDenied", "1");
  location.href = "index.html";
}

// Hides admin-only nav links/controls and updates the sidebar
// name/email for whoever is logged in. Called on every page.
function applyRoleUI() {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden-role", CURRENT_ROLE !== "admin");
  });
  const roleLabelEl = document.getElementById("userRoleLabel");
  const roleEmailEl = document.getElementById("userEmail");
  if (roleLabelEl) roleLabelEl.textContent = CURRENT_ROLE === "admin" ? "Admin User" : "Staff User";
  if (roleEmailEl) roleEmailEl.textContent = CURRENT_ROLE === "admin" ? "admin@gmail.com" : "staff@gmail.com";
  const welcomeEl = document.getElementById("welcomeHeading");
  if (welcomeEl) welcomeEl.textContent = CURRENT_ROLE === "admin" ? "Welcome back, admin!" : "Welcome back, staff!";
}
applyRoleUI();

// If staff just got redirected away from a restricted page, let
// them know why once the Dashboard finishes rendering.
if (sessionStorage.getItem("swm_accessDenied")) {
  sessionStorage.removeItem("swm_accessDenied");
  window.addEventListener("DOMContentLoaded", () => {
    showToast("Staff accounts don't have access to Manage Product.");
  });
}

// ============================================================
// Page transitions: the page content fades in on load (CSS) and
// fades out before we leave. Links and in-app redirects go through
// navigateTo(); the sidebar stays put so it feels like one app.
// ============================================================
(function () {
  const LEAVE_MS = 170;
  const LEAVE_FULL_MS = 380;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let leaving = false;

  // opts.full = fade the whole app (sidebar + top bar too), used for log out
  window.navigateTo = function (url, opts) {
    if (leaving) return;
    if (reduce) { location.href = url; return; }
    leaving = true;
    const full = Boolean(opts && opts.full);
    document.body.classList.add("page-leaving");
    if (full) document.body.classList.add("page-leaving-all");
    setTimeout(() => { location.href = url; }, full ? LEAVE_FULL_MS : LEAVE_MS);
  };

  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const raw = a.getAttribute("href");
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // same page
    e.preventDefault();
    window.navigateTo(a.href);
  });

  // Back/forward cache: make sure a restored page isn't stuck faded out
  window.addEventListener("pageshow", e => {
    if (e.persisted) { leaving = false; document.body.classList.remove("page-leaving", "page-leaving-all"); }
  });
})();

async function logout() {
  const confirmed = await showConfirmModal({
    title: "Log out?",
    message: "Are you sure you want to log out?",
    confirmLabel: "Log out",
    danger: false,
    iconName: "logout",
  });
  if (!confirmed) return;
  localStorage.removeItem("swm_loggedIn");
  localStorage.removeItem("swm_role");
  sessionStorage.removeItem("swm_stockAlertShown");
  navigateTo(LOGIN_PAGE, { full: true });
}

// ============================================================
// Shared popup system — confirmation modal, stock-update modal,
// and toast notifications. Injected once per page and reused by
// every action across Manage Product, Manage Inventory, Low
// Stock Alert, Out of Stock and the Dashboard.
// ============================================================
function ensurePopupRoot() {
  if (document.getElementById("confirmModal")) return;

  const confirmModal = document.createElement("div");
  confirmModal.id = "confirmModal";
  confirmModal.className = "modal-overlay";
  confirmModal.innerHTML = `
    <div class="modal modal-sm">
      <div id="confirmModalIcon" class="modal-icon"></div>
      <h3 id="confirmModalTitle">Are you sure?</h3>
      <p id="confirmModalMessage" class="modal-message"></p>
      <div class="modal-actions">
        <button type="button" id="confirmModalCancel" class="btn-secondary">Cancel</button>
        <button type="button" id="confirmModalOk" class="primary">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(confirmModal);

  const stockModal = document.createElement("div");
  stockModal.id = "stockModal";
  stockModal.className = "modal-overlay";
  stockModal.innerHTML = `
    <div class="modal modal-sm">
      <h3 id="stockModalTitle">Update Stock</h3>
      <form id="stockModalForm">
        <div class="form-group">
          <label for="stockModalInput">New stock quantity</label>
          <input type="number" id="stockModalInput" min="0" required>
        </div>
        <div class="modal-actions">
          <button type="button" id="stockModalCancel" class="btn-secondary">Cancel</button>
          <button type="submit" class="primary">Save</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(stockModal);

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "toast";
  document.body.appendChild(toast);
}

let toastTimer = null;
function showToast(message, duration = 2200) {
  ensurePopupRoot();
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

// Generic yes/no confirmation popup. Resolves true (confirmed) or
// false (cancelled/dismissed).
function showConfirmModal({ title = "Are you sure?", message = "", confirmLabel = "Confirm", danger = true, iconName = "" } = {}) {
  ensurePopupRoot();
  return new Promise(resolve => {
    const modal = document.getElementById("confirmModal");
    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalIcon").innerHTML = iconName ? icon(iconName) : "";
    document.getElementById("confirmModalMessage").textContent = message;
    const okBtn = document.getElementById("confirmModalOk");
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle("danger-btn", danger);
    const cancelBtn = document.getElementById("confirmModalCancel");

    function cleanup(result) {
      modal.classList.add("closing");
      clearTimeout(modal._closeTimer);
      modal._closeTimer = setTimeout(() => modal.classList.remove("open", "closing"), 160);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === modal) cleanup(false); }
    function onKey(e) { if (e.key === "Escape") cleanup(false); }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);

    clearTimeout(modal._closeTimer);
    modal.classList.remove("closing");
    modal.classList.add("open");
    okBtn.focus();
  });
}

// Stock-quantity popup, used by "Update Stock" and "Restock".
// Resolves the new stock number, or null if cancelled.
function showStockModal(product) {
  ensurePopupRoot();
  return new Promise(resolve => {
    const modal = document.getElementById("stockModal");
    document.getElementById("stockModalTitle").textContent = `Update Stock — ${product.name}`;
    const input = document.getElementById("stockModalInput");
    input.value = product.stock;
    const form = document.getElementById("stockModalForm");
    const cancelBtn = document.getElementById("stockModalCancel");

    function cleanup(result) {
      modal.classList.remove("open");
      form.removeEventListener("submit", onSubmit);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onSubmit(e) {
      e.preventDefault();
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) return;
      cleanup(val);
    }
    function onCancel() { cleanup(null); }
    function onOverlay(e) { if (e.target === modal) cleanup(null); }
    function onKey(e) { if (e.key === "Escape") cleanup(null); }

    form.addEventListener("submit", onSubmit);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);

    modal.classList.add("open");
    input.focus();
    input.select();
  });
}

// ============================================================
// Shared product data layer — every page reads/writes this,
// so Manage Product, Manage Inventory, Low Stock, Out of Stock
// and the Dashboard all stay in sync automatically.
// ============================================================
const STORAGE_KEY = "swm_products";

const seedProducts = [
  { id: 1, name: "Baggy Pants", code: "#0001", category: "Pants", stock: 5 },
  { id: 2, name: "Flared Jeans", code: "#0002", category: "Pants", stock: 8 },
  { id: 3, name: "Cargo Pants", code: "#0003", category: "Pants", stock: 12 },
  { id: 4, name: "Skinny Jeans", code: "#0004", category: "Pants", stock: 0 },
  { id: 5, name: "Denim Shorts", code: "#0005", category: "Jorts", stock: 0 },
  { id: 6, name: "Wide Leg Trousers", code: "#0006", category: "Pants", stock: 0 },
];

// The shop only sells these two categories.
const CATEGORIES = ["Pants", "Jorts"];
// Older saved data may still use categories that no longer exist.
const LEGACY_CATEGORY_MAP = { Jeans: "Pants", Trousers: "Pants", Shorts: "Jorts" };

function normalizeCategories(list) {
  let changed = false;
  list.forEach(p => {
    const mapped = LEGACY_CATEGORY_MAP[p.category];
    if (mapped) { p.category = mapped; changed = true; }
  });
  return changed;
}

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveProducts(seedProducts);
    return seedProducts.slice();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedProducts.slice();
    if (normalizeCategories(parsed)) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    saveProducts(seedProducts);
    return seedProducts.slice();
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  refreshNotifications(products);
}

function getStatus(stock) {
  if (stock === 0) return { cls: "out", label: "Out of Stock" };
  if (stock < 10) return { cls: "low", label: "Low Stock" };
  return { cls: "in", label: "In Stock" };
}

function nextCode(products) {
  const max = products.reduce((m, p) => {
    const n = parseInt(String(p.code).replace("#", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return "#" + String(max + 1).padStart(4, "0");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


// ============================================================
// Icons (Lucide-style line icons, matching the Figma design).
// Use <i data-icon="box"></i> in HTML; hydrateIcons() swaps it
// for an inline SVG that inherits the text colour.
// ============================================================
const ICONS = {
  command: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  uploadCloud: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  user: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"/>',
};

function icon(name, cls = "") {
  const d = ICONS[name];
  if (!d) return "";
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach(el => {
    el.outerHTML = icon(el.dataset.icon, el.dataset.class || "");
  });
}

// ============================================================
// Low stock notifications — bell with a count + dropdown in the
// top bar, live Low Stock / Out of Stock badges, and a warning
// toast. Works on every page and updates whenever stock changes.
// ============================================================
function getStockAlerts(products = loadProducts()) {
  // same thresholds as getStatus(): 0 = out of stock, under 10 = low
  const out = products.filter(p => Number(p.stock) === 0);
  const low = products
    .filter(p => Number(p.stock) > 0 && Number(p.stock) < 10)
    .sort((a, b) => Number(a.stock) - Number(b.stock));
  return { low, out, total: low.length + out.length };
}

function ensureNotificationBell() {
  const bar = document.querySelector(".top-actions");
  if (!bar) return null; // e.g. login page has no top bar

  let wrap = document.getElementById("notifWrap");
  if (wrap) return wrap;

  wrap = document.createElement("div");
  wrap.id = "notifWrap";
  wrap.className = "notif-wrap";
  wrap.innerHTML = `
    <button type="button" class="notif-btn" id="notifBtn" aria-haspopup="true" aria-expanded="false" aria-label="Stock notifications">
      <span class="notif-icon" aria-hidden="true">${icon("bell")}</span>
      <span class="notif-count" id="notifCount" hidden>0</span>
    </button>
    <div class="notif-panel" id="notifPanel" role="dialog" aria-label="Stock notifications"></div>`;
  bar.insertBefore(wrap, bar.querySelector(".admin"));

  const btn = wrap.querySelector("#notifBtn");
  const panel = wrap.querySelector("#notifPanel");
  const setOpen = open => {
    panel.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", e => {
    e.stopPropagation();
    setOpen(!panel.classList.contains("open"));
  });
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") setOpen(false);
  });

  return wrap;
}

function notificationSection(title, cls, items, href) {
  if (!items.length) return "";
  const shown = items.slice(0, 5).map(p => `
      <a class="notif-item" href="${href}">
        <span class="notif-name">${escapeHtml(p.name)} <small>${escapeHtml(p.code)}</small></span>
        <span class="status ${cls}">${Number(p.stock) === 0 ? "0 left" : p.stock + " left"}</span>
      </a>`).join("");
  const more = items.length > 5
    ? `<a class="notif-more" href="${href}">+${items.length - 5} more</a>`
    : "";
  return `
    <div class="notif-section">
      <div class="notif-section-head ${cls}"><span>${title} (${items.length})</span><a href="${href}">View all</a></div>
      ${shown}${more}
    </div>`;
}

function refreshNotifications(products) {
  const wrap = ensureNotificationBell();
  if (!wrap) return;

  const alerts = getStockAlerts(products || loadProducts());

  const count = document.getElementById("notifCount");
  count.textContent = alerts.total > 9 ? "9+" : alerts.total;
  count.hidden = alerts.total === 0;
  document.getElementById("notifBtn").classList.toggle("has-alerts", alerts.total > 0);

  document.getElementById("notifPanel").innerHTML = `
    <div class="notif-head"><strong>Stock Notifications</strong><span>${alerts.total}</span></div>
    ${alerts.total
      ? notificationSection("Out of Stock", "out", alerts.out, "out-of-stock.html") +
        notificationSection("Low Stock", "low", alerts.low, "low-stock.html")
      : `<div class="notif-empty">✓ All products are well stocked.</div>`}`;

  // make the static top-bar badges live + clickable
  const lowBadge = document.querySelector(".top-actions .badge.warning");
  const outBadge = document.querySelector(".top-actions .badge.danger");
  const setBadge = (el, text) => {
    const label = el.querySelector(".badge-label");
    if (label) label.textContent = text; else el.textContent = text;
  };
  if (lowBadge) {
    setBadge(lowBadge, `Low Stock (${alerts.low.length})`);
    makeBadgeLink(lowBadge, "low-stock.html");
  }
  if (outBadge) {
    setBadge(outBadge, `Out of Stock (${alerts.out.length})`);
    makeBadgeLink(outBadge, "out-of-stock.html");
  }
}

function makeBadgeLink(el, href) {
  if (el.dataset.linked) return;
  el.dataset.linked = "1";
  el.style.cursor = "pointer";
  el.setAttribute("role", "link");
  el.addEventListener("click", () => { navigateTo(href); });
}

// One-time heads-up after logging in (once per session).
function announceStockAlerts() {
  if (CURRENT_PAGE === LOGIN_PAGE || sessionStorage.getItem("swm_stockAlertShown")) return;
  sessionStorage.setItem("swm_stockAlertShown", "1");

  const { low, out } = getStockAlerts();
  if (!low.length && !out.length) return;

  const parts = [];
  if (low.length) parts.push(`${low.length} low on stock`);
  if (out.length) parts.push(`${out.length} out of stock`);
  const message = `⚠ Stock alert: ${parts.join(" and ")}. Tap the bell for details.`;

  const show = () => {
    const toast = document.getElementById("toast");
    // don't talk over another message that is already showing
    if (toast && toast.classList.contains("show")) setTimeout(show, 2400);
    else showToast(message, 5000);
  };
  setTimeout(show, 600);
}

// Toast text after a stock change, warning if it ended up low/out.
function stockChangeMessage(base, stock) {
  const status = getStatus(Number(stock));
  if (status.cls === "out") return { text: `${base} ⚠ Now out of stock.`, duration: 4500 };
  if (status.cls === "low") return { text: `${base} ⚠ Low stock: only ${stock} left.`, duration: 4500 };
  return { text: base, duration: 2200 };
}

// Shared "update stock" action used by Manage Inventory, Low Stock
// Alert, Out of Stock, and the Dashboard's low-stock table.
async function updateStock(productId) {
  const products = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const stock = await showStockModal(product);
  if (stock === null) return;

  product.stock = stock;
  product.updatedAt = Date.now();
  saveProducts(products);
  initPage(document.body.dataset.page);
  const msg = stockChangeMessage(`Stock updated for "${product.name}".`, stock);
  showToast(msg.text, msg.duration);
}

function restockProduct(productId) {
  updateStock(productId);
}

// ============================================================
// Per-page rendering, driven off the shared product data
// ============================================================
const DASH_PAGE_SIZE = 4;
let dashPage = 1;

function stockBar(stock) {
  const n = Number(stock);
  const pct = n <= 0 ? 4 : Math.min(100, n * 5);
  const color = n <= 0 ? "red" : n <= 5 ? "red" : n < 10 ? "orange" : "green";
  return `<span class="stock-cell"><span class="stock-num">${n}</span><span class="stock-bar"><span class="${color}" style="width:${pct}%"></span></span></span>`;
}

function renderDashboard(products) {
  const total = products.length;
  const inStock = products.filter(p => p.stock >= 10).length;
  const low = products.filter(p => p.stock > 0 && p.stock < 10).length;
  const out = products.filter(p => p.stock === 0).length;

  setText("statTotal", total);
  setText("statIn", inStock);
  setText("statLow", low);
  setText("statOut", out);

  // Recent low stock: low + out of stock items, lowest stock first
  const items = products
    .filter(p => Number(p.stock) < 10)
    .sort((a, b) => Number(b.stock) - Number(a.stock));
  const pages = Math.max(1, Math.ceil(items.length / DASH_PAGE_SIZE));
  dashPage = Math.min(Math.max(1, dashPage), pages);
  const startIdx = (dashPage - 1) * DASH_PAGE_SIZE;
  const view = items.slice(startIdx, startIdx + DASH_PAGE_SIZE);

  const body = document.getElementById("recentLowStockBody");
  if (body) {
    body.innerHTML = view.length
      ? view.map(p => {
          const st = getStatus(Number(p.stock));
          return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.code)}</td>
          <td>${stockBar(p.stock)}</td>
          <td><span class="status ${st.cls}">${st.label}</span></td>
          <td><button class="icon-btn" title="Review / update stock" aria-label="Review ${escapeHtml(p.name)}" onclick="updateStock(${p.id})">${icon("eye")}</button></td>
        </tr>`;
        }).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">No low stock items right now.</td></tr>`;
  }

  const countEl = document.getElementById("paginationCount");
  if (countEl) {
    countEl.textContent = items.length
      ? `Showing ${startIdx + 1}-${startIdx + view.length} of ${items.length} Products`
      : "Showing 0 of 0 Products";
  }

  const pager = document.getElementById("dashPager");
  if (pager) {
    let html = `<button type="button" data-go="${dashPage - 1}" aria-label="Previous page" ${dashPage === 1 ? "disabled" : ""}>${icon("chevronLeft")}</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button type="button" data-go="${i}" class="${i === dashPage ? "current" : ""}">${i}</button>`;
    }
    html += `<button type="button" data-go="${dashPage + 1}" aria-label="Next page" ${dashPage === pages ? "disabled" : ""}>${icon("chevronRight")}</button>`;
    pager.innerHTML = html;
    pager.onclick = e => {
      const b = e.target.closest("button[data-go]");
      if (!b || b.disabled) return;
      dashPage = Number(b.dataset.go);
      renderDashboard(loadProducts());
    };
  }
}

// ---- Manage Inventory (inventory.html) ----
const INV_PAGE_SIZE = 5;
const inv = { page: 1, wired: false };

function formatUpdated(ts) {
  if (!ts) return `<span class="muted">—</span>`;
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}<small>${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small>`;
}

function inventoryFiltered(products) {
  const q = (document.getElementById("inventorySearch")?.value || "").trim().toLowerCase();
  const cat = document.getElementById("inventoryCategory")?.value || "all";
  const st = document.getElementById("inventoryStatus")?.value || "all";
  return products.filter(p => {
    const text = [p.code, p.category, p.name].join(" ").toLowerCase();
    return (!q || text.includes(q)) &&
      (cat === "all" || p.category === cat) &&
      (st === "all" || getStatus(Number(p.stock)).cls === st);
  });
}

function renderInventoryTable(products) {
  const body = document.getElementById("inventoryBody");
  if (!body) return;

  const catSel = document.getElementById("inventoryCategory");

  if (!inv.wired) {
    inv.wired = true;
    const rerender = () => { inv.page = 1; renderInventoryTable(loadProducts()); };
    document.getElementById("inventorySearch").addEventListener("input", rerender);
    catSel.addEventListener("change", rerender);
    document.getElementById("inventoryStatus").addEventListener("change", rerender);
    document.getElementById("inventoryPager").addEventListener("click", e => {
      const b = e.target.closest("button[data-go]");
      if (!b || b.disabled) return;
      inv.page = Number(b.dataset.go);
      renderInventoryTable(loadProducts());
    });
  }

  const list = inventoryFiltered(products);
  const pages = Math.max(1, Math.ceil(list.length / INV_PAGE_SIZE));
  inv.page = Math.min(Math.max(1, inv.page), pages);
  const start = (inv.page - 1) * INV_PAGE_SIZE;
  const view = list.slice(start, start + INV_PAGE_SIZE);

  body.innerHTML = view.length
    ? view.map(p => {
        const st = getStatus(Number(p.stock));
        return `
        <tr>
          <td class="prod-col"><div class="prod-cell">${productThumb(p)}<span class="prod-code">${escapeHtml(p.code)}<small>${escapeHtml(p.name)}</small></span></div></td>
          <td>${escapeHtml(p.category)}</td>
          <td class="${Number(p.stock) < 10 ? "stk-low" : ""}">${Number(p.stock)}</td>
          <td>${Number(p.reorder ?? 10)}</td>
          <td><span class="status ${st.cls}">${st.label}</span></td>
          <td class="updated">${formatUpdated(p.updatedAt)}</td>
          <td><button type="button" class="view-btn upd-btn" onclick="updateStock(${p.id})">${icon("edit")} Update Stock</button></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="7" class="empty-row">${products.length ? "No products match your search or filter." : "No products yet."}</td></tr>`;

  const countEl = document.getElementById("inventoryCount");
  if (countEl) countEl.textContent = list.length ? `Showing ${start + 1} to ${start + view.length} of ${list.length} items` : "Showing 0 of 0 items";

  const pager = document.getElementById("inventoryPager");
  let html = `<button type="button" data-go="${inv.page - 1}" aria-label="Previous page" ${inv.page === 1 ? "disabled" : ""}>${icon("chevronLeft")}</button>`;
  pageItems(inv.page, pages).forEach(n => {
    html += n === "…"
      ? `<button type="button" disabled>…</button>`
      : `<button type="button" data-go="${n}" class="${n === inv.page ? "current" : ""}">${n}</button>`;
  });
  html += `<button type="button" data-go="${inv.page + 1}" aria-label="Next page" ${inv.page === pages ? "disabled" : ""}>${icon("chevronRight")}</button>`;
  pager.innerHTML = html;
}

// ---- Low Stock Alert + Out of Stock pages (shared) ----
const ALERT_PAGE_SIZE = 5;
const alertState = { page: 1, wired: false };

const ALERT_KINDS = {
  low: {
    title: "Low Stock Products",
    empty: "No low stock items right now.",
    action: "Update Stock",
    match: p => Number(p.stock) > 0 && Number(p.stock) < 10,
    sort: (a, b) => Number(a.stock) - Number(b.stock),
  },
  out: {
    title: "Out of Stock Products",
    empty: "Nothing out of stock right now.",
    action: "Restock",
    match: p => Number(p.stock) === 0,
    sort: (a, b) => String(a.name).localeCompare(String(b.name)),
  },
};

function pagerHTML(cur, pages) {
  let html = `<button type="button" data-go="${cur - 1}" aria-label="Previous page" ${cur === 1 ? "disabled" : ""}>${icon("chevronLeft")}</button>`;
  pageItems(cur, pages).forEach(n => {
    html += n === "…"
      ? `<button type="button" disabled>…</button>`
      : `<button type="button" data-go="${n}" class="${n === cur ? "current" : ""}">${n}</button>`;
  });
  return html + `<button type="button" data-go="${cur + 1}" aria-label="Next page" ${cur === pages ? "disabled" : ""}>${icon("chevronRight")}</button>`;
}

// Read-only product details popup with a stock action (used by the
// alert pages). Built on first use and reused afterwards.
function openProductPopup(p, actionLabel) {
  let overlay = document.getElementById("popupView");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "popupView";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal modal-view" role="dialog" aria-modal="true" aria-label="Product details"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => {
      if (e.target === overlay || e.target.closest("[data-close]")) overlay.classList.remove("open");
      const act = e.target.closest("[data-stock]");
      if (act) {
        overlay.classList.remove("open");
        updateStock(Number(act.dataset.stock));
      }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") overlay.classList.remove("open"); });
  }
  const st = getStatus(Number(p.stock));
  const imgs = Array.isArray(p.images) && p.images.length
    ? p.images.map(src => `<img src="${src}" alt="">`).join("")
    : `<span class="thumb empty big">${icon("image")}</span>`;
  overlay.firstElementChild.innerHTML = `
    <div class="view-head">
      <h3>${escapeHtml(p.name)}</h3>
      <button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button>
    </div>
    <div class="view-imgs">${imgs}</div>
    <dl class="view-grid">
      <div><dt>Product Code</dt><dd>${escapeHtml(p.code)}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(p.category)}</dd></div>
      <div><dt>Current Stock</dt><dd>${Number(p.stock)}</dd></div>
      <div><dt>Reorder Level</dt><dd>${Number(p.reorder ?? 10)}</dd></div>
      <div><dt>Status</dt><dd><span class="status ${st.cls}">${st.label}</span></dd></div>
    </dl>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Close</button>
      <button type="button" class="primary" data-stock="${p.id}">${icon("edit")} ${actionLabel}</button>
    </div>`;
  overlay.classList.add("open");
}

function renderAlertPage(kind, products) {
  const body = document.getElementById("alertBody");
  if (!body) return;
  const cfg = ALERT_KINDS[kind];
  const all = products.filter(cfg.match).sort(cfg.sort);

  setText("statAlert", all.length);

  if (!alertState.wired) {
    alertState.wired = true;
    document.getElementById("alertSearch").addEventListener("input", () => { alertState.page = 1; renderAlertPage(kind, loadProducts()); });
    document.getElementById("alertPager").addEventListener("click", e => {
      const b = e.target.closest("button[data-go]");
      if (!b || b.disabled) return;
      alertState.page = Number(b.dataset.go);
      renderAlertPage(kind, loadProducts());
    });
    body.addEventListener("click", e => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      const prod = loadProducts().find(x => x.id === Number(btn.dataset.view));
      if (prod) openProductPopup(prod, cfg.action);
    });
  }

  const q = document.getElementById("alertSearch").value.trim().toLowerCase();
  const list = q ? all.filter(p => [p.name, p.code, p.category].join(" ").toLowerCase().includes(q)) : all;
  const pages = Math.max(1, Math.ceil(list.length / ALERT_PAGE_SIZE));
  alertState.page = Math.min(Math.max(1, alertState.page), pages);
  const start = (alertState.page - 1) * ALERT_PAGE_SIZE;
  const view = list.slice(start, start + ALERT_PAGE_SIZE);

  body.innerHTML = view.length
    ? view.map(p => {
        const st = getStatus(Number(p.stock));
        return `
        <tr>
          <td class="prod-col"><div class="prod-cell">${productThumb(p)}<span class="prod-code">${escapeHtml(p.code)}<small>${escapeHtml(p.name)}</small></span></div></td>
          <td>${escapeHtml(p.category)}</td>
          <td class="stk-low">${Number(p.stock)}</td>
          <td>${Number(p.reorder ?? 10)}</td>
          <td><span class="status ${st.cls}">${st.label}</span></td>
          <td><button type="button" class="view-btn" data-view="${p.id}">View Product</button></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" class="empty-row">${all.length ? "No products match your search." : cfg.empty}</td></tr>`;

  document.getElementById("alertCount").textContent = list.length
    ? `Showing ${start + 1} to ${start + view.length} of ${list.length} items`
    : "Showing 0 of 0 items";
  document.getElementById("alertPager").innerHTML = pagerHTML(alertState.page, pages);
}

function renderLowStockTable(products) { renderAlertPage("low", products); }
function renderOutOfStockTable(products) { renderAlertPage("out", products); }

// Called from an inline <script> at the bottom of each page
// (except Manage Product, which manages its own render loop below).
function initPage(page) {
  document.body.dataset.page = page;
  hydrateIcons();
  const products = loadProducts();

  if (page === "dashboard") renderDashboard(products);
  else if (page === "inventory") renderInventoryTable(products);
  else if (page === "low-stock") renderLowStockTable(products);
  else if (page === "out-of-stock") renderOutOfStockTable(products);

  applyTableFilters();
}

// ============================================================
// Table search (all pages with #searchInput / #productTable)
// ============================================================
const search = document.getElementById("searchInput");

const statusFilter = document.getElementById("statusFilter");

// Applies the search text and (when present) the status dropdown
// to the rows currently in the table.
function applyTableFilters() {
  const q = search ? search.value.toLowerCase() : "";
  const status = statusFilter ? statusFilter.value : "all";
  let visible = 0;
  document.querySelectorAll("#productTable tbody tr").forEach(r => {
    if (r.classList.contains("no-results")) return;
    const matchesText = r.innerText.toLowerCase().includes(q);
    const badge = r.querySelector(".status");
    const matchesStatus = status === "all" || (badge && badge.classList.contains(status));
    const show = matchesText && matchesStatus;
    r.style.display = show ? "" : "none";
    if (show) visible++;
  });

  const body = document.querySelector("#productTable tbody");
  const existing = body && body.querySelector(".no-results");
  const hasRows = body && body.querySelector("tr:not(.no-results) .status");
  if (existing) existing.remove();
  if (body && hasRows && visible === 0) {
    const tr = document.createElement("tr");
    tr.className = "no-results";
    tr.innerHTML = `<td colspan="6" style="text-align:center;color:#aaa;padding:20px;">No products match your search or filter.</td>`;
    body.appendChild(tr);
  }
}

if (search) search.addEventListener("input", applyTableFilters);
if (statusFilter) statusFilter.addEventListener("change", applyTableFilters);

// ============================================================
// Login page
// ============================================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const DEMO_ACCOUNTS = {
    "admin@gmail.com": { password: "admin123", role: "admin" },
    "staff@gmail.com": { password: "staff123", role: "staff" },
  };

  const userInput = document.getElementById("loginEmail");
  const rememberBox = document.getElementById("rememberMe");
  const REMEMBER_KEY = "swm_rememberedUser";

  // Prefill when "Remember me" was ticked last time
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (remembered && userInput) {
    userInput.value = remembered;
    if (rememberBox) rememberBox.checked = true;
  }

  const forgot = document.getElementById("forgotLink");
  if (forgot) {
    forgot.addEventListener("click", e => {
      e.preventDefault();
      showToast("Please contact your administrator to reset your password.", 3500);
    });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    // Accept "admin" or "admin@gmail.com" (the design asks for a username)
    let user = userInput.value.trim().toLowerCase();
    if (user && !user.includes("@")) user += "@gmail.com";
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");
    const account = DEMO_ACCOUNTS[user];

    if (account && account.password === password) {
      if (rememberBox && rememberBox.checked) localStorage.setItem(REMEMBER_KEY, userInput.value.trim());
      else localStorage.removeItem(REMEMBER_KEY);
      localStorage.setItem("swm_loggedIn", "true");
      localStorage.setItem("swm_role", account.role);
      sessionStorage.removeItem("swm_stockAlertShown");
      navigateTo("index.html");
    } else {
      errorEl.textContent = "Invalid username or password. Please try again.";
      errorEl.style.display = "block";
    }
  });
}

// ============================================================
// Manage Product — list page (products.html): search, status
// filter, 8-per-page pagination and a View Product popup with
// Edit / Delete. Add & Edit live on add-product.html.
// ============================================================
function pageItems(cur, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = [...new Set([1, total, cur - 1, cur, cur + 1])].filter(n => n >= 1 && n <= total).sort((x, y) => x - y);
  const out = [];
  keep.forEach((n, i) => {
    if (i && n - keep[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

function productThumb(p) {
  const img = Array.isArray(p.images) && p.images[0];
  return img
    ? `<span class="thumb"><img src="${img}" alt=""></span>`
    : `<span class="thumb empty">${icon("image")}</span>`;
}

const productBody = document.getElementById("productBody");

if (productBody) {
  const PAGE_SIZE = 8;
  let page = 1;
  const qEl = document.getElementById("productSearch");
  const stEl = document.getElementById("productStatus");
  const viewModal = document.getElementById("viewModal");
  const viewBody = document.getElementById("viewModalBody");

  const flash = sessionStorage.getItem("swm_flash");
  if (flash) {
    sessionStorage.removeItem("swm_flash");
    try { const m = JSON.parse(flash); showToast(m.text, m.duration); } catch {}
  }

  function filteredProducts() {
    const q = qEl ? qEl.value.trim().toLowerCase() : "";
    const st = stEl ? stEl.value : "all";
    return loadProducts().filter(p => {
      const text = [p.name, p.code, p.category].join(" ").toLowerCase();
      return (!q || text.includes(q)) && (st === "all" || getStatus(Number(p.stock)).cls === st);
    });
  }

  function renderProducts() {
    const all = loadProducts();
    const list = filteredProducts();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);
    const start = (page - 1) * PAGE_SIZE;
    const view = list.slice(start, start + PAGE_SIZE);

    if (!view.length) {
      productBody.innerHTML = `<tr><td colspan="6" class="empty-row">${all.length ? "No products match your search or filter." : 'No products yet. Click "Add Product" to create one.'}</td></tr>`;
    } else {
      productBody.innerHTML = view.map(p => {
        const st = getStatus(Number(p.stock));
        return `
        <tr>
          <td class="prod-col"><div class="prod-cell">${productThumb(p)}<span class="prod-code">${escapeHtml(p.code)}<small>${escapeHtml(p.name)}</small></span></div></td>
          <td>${escapeHtml(p.category)}</td>
          <td class="${Number(p.stock) < 10 ? "stk-low" : ""}">${Number(p.stock)}</td>
          <td>${Number(p.reorder ?? 10)}</td>
          <td><span class="status ${st.cls}">${st.label}</span></td>
          <td><button type="button" class="view-btn" data-action="view" data-id="${p.id}">View Product</button></td>
        </tr>`;
      }).join("");
    }

    const countEl = document.getElementById("listCount");
    if (countEl) countEl.textContent = list.length ? `Showing ${start + 1} to ${start + view.length} of ${list.length} items` : "Showing 0 of 0 items";

    const pager = document.getElementById("listPager");
    if (pager) {
      let html = `<button type="button" data-go="${page - 1}" aria-label="Previous page" ${page === 1 ? "disabled" : ""}>${icon("chevronLeft")}</button>`;
      pageItems(page, pages).forEach(n => {
        html += n === "…"
          ? `<button type="button" disabled>…</button>`
          : `<button type="button" data-go="${n}" class="${n === page ? "current" : ""}">${n}</button>`;
      });
      html += `<button type="button" data-go="${page + 1}" aria-label="Next page" ${page === pages ? "disabled" : ""}>${icon("chevronRight")}</button>`;
      pager.innerHTML = html;
    }
  }

  document.getElementById("listPager").addEventListener("click", e => {
    const b = e.target.closest("button[data-go]");
    if (!b || b.disabled) return;
    page = Number(b.dataset.go);
    renderProducts();
  });
  if (qEl) qEl.addEventListener("input", () => { page = 1; renderProducts(); });
  if (stEl) stEl.addEventListener("change", () => { page = 1; renderProducts(); });

  // ---- View Product popup ----
  let viewingId = null;
  function openView(p) {
    viewingId = p.id;
    const st = getStatus(Number(p.stock));
    const imgs = Array.isArray(p.images) && p.images.length
      ? p.images.map(src => `<img src="${src}" alt="">`).join("")
      : `<span class="thumb empty big">${icon("image")}</span>`;
    viewBody.innerHTML = `
      <div class="view-head">
        <h3>${escapeHtml(p.name)}</h3>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button>
      </div>
      <div class="view-imgs">${imgs}</div>
      <dl class="view-grid">
        <div><dt>Product Code</dt><dd>${escapeHtml(p.code)}</dd></div>
        <div><dt>Category</dt><dd>${escapeHtml(p.category)}</dd></div>
        <div><dt>Current Stock</dt><dd>${Number(p.stock)}</dd></div>
        <div><dt>Reorder Level</dt><dd>${Number(p.reorder ?? 10)}</dd></div>
        <div><dt>Status</dt><dd><span class="status ${st.cls}">${st.label}</span></dd></div>
      </dl>
      <div class="modal-actions">
        <button type="button" class="btn-secondary danger-outline" data-delete>${icon("trash")} Delete</button>
        <a class="primary link-btn" href="add-product.html?id=${p.id}">${icon("edit")} Edit</a>
      </div>`;
    viewModal.classList.add("open");
  }
  function closeView() { viewModal.classList.remove("open"); viewingId = null; }

  productBody.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action='view']");
    if (!btn) return;
    const p = loadProducts().find(x => x.id === Number(btn.dataset.id));
    if (p) openView(p);
  });
  viewModal.addEventListener("click", async e => {
    if (e.target === viewModal || e.target.closest("[data-close]")) return closeView();
    if (e.target.closest("[data-delete]")) {
      const products = loadProducts();
      const product = products.find(p => p.id === viewingId);
      if (!product) return;
      const confirmed = await showConfirmModal({
        title: "Delete product?",
        message: `Delete "${product.name}"? This cannot be undone.`,
        confirmLabel: "Delete",
        danger: true,
        iconName: "trash",
      });
      if (confirmed) {
        saveProducts(products.filter(p => p.id !== product.id));
        closeView();
        renderProducts();
        showToast(`"${product.name}" deleted.`);
      }
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && viewModal.classList.contains("open")) closeView(); });

  renderProducts();
}

// ============================================================
// Add / Edit Product page (add-product.html?id=… for editing)
// ============================================================
const productForm = document.getElementById("productForm");

if (productForm) {
  const MAX_IMAGES = 2;
  const MAX_BYTES = 5 * 1024 * 1024;
  const editId = Number(new URLSearchParams(location.search).get("id")) || null;
  const products = loadProducts();
  const existing = editId ? products.find(p => p.id === editId) : null;
  let images = existing && Array.isArray(existing.images) ? existing.images.slice() : [];

  const $ = id => document.getElementById(id);
  const fields = {
    name: $("productName"), code: $("productCode"), category: $("productCategory"),
    stock: $("productStock"), reorder: $("productReorder"),
  };

  // Edit mode: relabel + prefill
  if (editId && !existing) {
    sessionStorage.setItem("swm_flash", JSON.stringify({ text: "That product no longer exists.", duration: 2800 }));
    location.href = "products.html";
  }
  if (existing) {
    document.title = "StyleWithMeBLCN | Edit Product";
    $("crumbCurrent").textContent = "Edit Product";
    $("formTitle").textContent = "Edit Product";
    $("formSubtitle").textContent = "Update the details below and save your changes.";
    fields.name.value = existing.name;
    fields.code.value = existing.code;
    if (![...fields.category.options].some(o => o.value === existing.category)) {
      fields.category.add(new Option(existing.category, existing.category));
    }
    fields.category.value = existing.category;
    fields.stock.value = existing.stock;
    fields.reorder.value = existing.reorder ?? 10;
  }

  // ---- images ----
  const zone = $("dropzone");
  const input = $("imageInput");
  const previews = $("imagePreviews");

  function renderPreviews() {
    previews.innerHTML = images.map((src, i) => `
      <div class="img-prev"><img src="${src}" alt="Product image ${i + 1}">
        <button type="button" data-rm="${i}" aria-label="Remove image ${i + 1}">${icon("x")}</button></div>`).join("");
    zone.classList.toggle("full", images.length >= MAX_IMAGES);
  }

  function fileToDataUrl(file, max = 480) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("img"));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    for (const file of fileList) {
      if (images.length >= MAX_IMAGES) { showToast(`You can upload up to ${MAX_IMAGES} images only.`); break; }
      if (!["image/png", "image/jpeg"].includes(file.type)) { showToast(`"${file.name}" isn't a PNG or JPG image.`, 3000); continue; }
      if (file.size > MAX_BYTES) { showToast(`"${file.name}" is over 5MB.`, 3000); continue; }
      try { images.push(await fileToDataUrl(file)); }
      catch { showToast(`Couldn't read "${file.name}".`, 3000); }
    }
    renderPreviews();
  }

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  previews.addEventListener("click", e => {
    const b = e.target.closest("button[data-rm]");
    if (!b) return;
    images.splice(Number(b.dataset.rm), 1);
    renderPreviews();
  });
  renderPreviews();

  // ---- validation + save ----
  function setError(key, msg) {
    const el = $("err-" + key);
    if (el) el.textContent = msg || "";
    fields[key].classList.toggle("invalid", Boolean(msg));
  }
  Object.keys(fields).forEach(k => fields[k].addEventListener("input", () => setError(k, "")));

  productForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = fields.name.value.trim();
    const code = fields.code.value.trim();
    const category = fields.category.value;
    const stock = parseInt(fields.stock.value, 10);
    const reorder = parseInt(fields.reorder.value, 10);

    let ok = true;
    const fail = (k, m) => { setError(k, m); ok = false; };
    ["name", "code", "category", "stock", "reorder"].forEach(k => setError(k, ""));
    if (!name) fail("name", "Product name is required.");
    if (!code) fail("code", "Product code is required.");
    else if (products.some(p => p.id !== editId && String(p.code).toLowerCase() === code.toLowerCase())) fail("code", "That product code is already in use.");
    if (!category) fail("category", "Please select a category.");
    if (isNaN(stock) || stock < 0) fail("stock", "Enter a stock quantity of 0 or more.");
    if (isNaN(reorder) || reorder < 0) fail("reorder", "Enter a reorder level of 0 or more.");
    if (!ok) {
      const firstBad = productForm.querySelector(".invalid");
      if (firstBad) firstBad.focus();
      return;
    }

    if (existing) {
      const stockChanged = Number(existing.stock) !== stock;
      Object.assign(existing, { name, code, category, stock, reorder, images });
      if (stockChanged) existing.updatedAt = Date.now();
    } else {
      products.push({ id: Date.now(), name, code, category, stock, reorder, images, updatedAt: Date.now() });
    }

    try {
      saveProducts(products);
    } catch {
      showToast("Couldn't save — browser storage is full. Try smaller images.", 4000);
      return;
    }
    const msg = stockChangeMessage(existing ? `"${name}" updated.` : `"${name}" added.`, stock);
    sessionStorage.setItem("swm_flash", JSON.stringify({ text: msg.text, duration: msg.duration }));
    navigateTo("products.html");
  });
}

// ============================================================
// Low stock notifications — start-up
// ============================================================
refreshNotifications();
announceStockAlerts();
window.addEventListener("storage", e => {
  if (e.key === STORAGE_KEY) refreshNotifications();
});