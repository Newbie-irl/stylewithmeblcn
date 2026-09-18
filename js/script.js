// ============================================================
// Auth guard — every page except login.html requires a session
// ============================================================
const LOGIN_PAGE = "login.html";
const CURRENT_PAGE = location.pathname.split("/").pop() || "index.html";

if (CURRENT_PAGE !== LOGIN_PAGE && localStorage.getItem("swm_loggedIn") !== "true") {
  location.href = LOGIN_PAGE;
}

function logout() {
  localStorage.removeItem("swm_loggedIn");
  location.href = LOGIN_PAGE;
}

// ============================================================
// Shared product data layer — every page reads/writes this,
// so Manage Product, Manage Inventory, Low Stock, Out of Stock
// and the Dashboard all stay in sync automatically.
// ============================================================
const STORAGE_KEY = "swm_products";

const seedProducts = [
  { id: 1, name: "Baggy Pants", code: "#0001", category: "Pants", stock: 5 },
  { id: 2, name: "Flared Jeans", code: "#0002", category: "Jeans", stock: 8 },
  { id: 3, name: "Cargo Pants", code: "#0003", category: "Pants", stock: 12 },
  { id: 4, name: "Skinny Jeans", code: "#0004", category: "Jeans", stock: 0 },
  { id: 5, name: "Denim Shorts", code: "#0005", category: "Shorts", stock: 0 },
  { id: 6, name: "Wide Leg Trousers", code: "#0006", category: "Trousers", stock: 0 },
];

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveProducts(seedProducts);
    return seedProducts.slice();
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedProducts.slice();
  } catch {
    saveProducts(seedProducts);
    return seedProducts.slice();
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
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

// Shared "update stock" action used by Manage Inventory, Low Stock
// Alert, Out of Stock, and the Dashboard's low-stock table.
function updateStock(productId) {
  const products = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const input = prompt(`New stock quantity for "${product.name}":`, product.stock);
  if (input === null) return;
  const stock = parseInt(input, 10);
  if (isNaN(stock) || stock < 0) {
    alert("Please enter a valid, non-negative number.");
    return;
  }

  product.stock = stock;
  saveProducts(products);
  initPage(document.body.dataset.page);
}

function restockProduct(productId) {
  updateStock(productId);
}

function placeholderAction(label) {
  console.log(`"${label}" will be connected in a later milestone.`);
}

// ============================================================
// Per-page rendering, driven off the shared product data
// ============================================================
function renderDashboard(products) {
  const total = products.length;
  const inStock = products.filter(p => p.stock >= 10).length;
  const low = products.filter(p => p.stock > 0 && p.stock < 10).length;
  const out = products.filter(p => p.stock === 0).length;

  setText("statTotal", total);
  setText("statIn", inStock);
  setText("statLow", low);
  setText("statOut", out);

  const lowStockItems = products.filter(p => p.stock > 0 && p.stock < 10).slice(0, 5);
  const body = document.getElementById("recentLowStockBody");
  if (body) {
    body.innerHTML = lowStockItems.length
      ? lowStockItems.map(p => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.code)}</td>
          <td>${p.stock}</td>
          <td><span class="status low">Low Stock</span></td>
          <td><button class="text-btn" onclick="updateStock(${p.id})">Update</button></td>
        </tr>`).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">No low stock items right now.</td></tr>`;
  }

  const countEl = document.getElementById("paginationCount");
  if (countEl) countEl.textContent = `Showing ${lowStockItems.length} of ${low} Products`;
}

function renderInventoryTable(products) {
  const body = document.getElementById("inventoryBody");
  if (!body) return;
  body.innerHTML = products.length
    ? products.map(p => {
        const status = getStatus(Number(p.stock));
        return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.code)}</td>
          <td>${escapeHtml(p.category)}</td>
          <td>${p.stock}</td>
          <td><span class="status ${status.cls}">${status.label}</span></td>
          <td><button class="text-btn" onclick="updateStock(${p.id})">Update Stock</button></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">No products yet.</td></tr>`;
}

function renderLowStockTable(products) {
  const body = document.getElementById("lowStockBody");
  if (!body) return;
  const items = products.filter(p => p.stock > 0 && p.stock < 10);
  body.innerHTML = items.length
    ? items.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${p.stock}</td>
        <td><span class="status low">Low Stock</span></td>
        <td><button class="text-btn" onclick="updateStock(${p.id})">Update Stock</button></td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">No low stock items right now.</td></tr>`;
}

function renderOutOfStockTable(products) {
  const body = document.getElementById("outOfStockBody");
  if (!body) return;
  const items = products.filter(p => p.stock === 0);
  body.innerHTML = items.length
    ? items.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${p.stock}</td>
        <td><span class="status out">Out of Stock</span></td>
        <td><button class="text-btn" onclick="restockProduct(${p.id})">Restock</button></td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">Nothing out of stock right now.</td></tr>`;
}

// Called from an inline <script> at the bottom of each page
// (except Manage Product, which manages its own render loop below).
function initPage(page) {
  document.body.dataset.page = page;
  const products = loadProducts();

  if (page === "dashboard") renderDashboard(products);
  else if (page === "inventory") renderInventoryTable(products);
  else if (page === "low-stock") renderLowStockTable(products);
  else if (page === "out-of-stock") renderOutOfStockTable(products);

  if (search && search.value) search.dispatchEvent(new Event("input"));
}

// ============================================================
// Table search (all pages with #searchInput / #productTable)
// ============================================================
const search = document.getElementById("searchInput");

if (search) {
  search.addEventListener("input", function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll("#productTable tbody tr").forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// ============================================================
// Login page
// ============================================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const DEMO_EMAIL = "admin@gmail.com";
  const DEMO_PASSWORD = "admin123";

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");

    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      localStorage.setItem("swm_loggedIn", "true");
      location.href = "index.html";
    } else {
      errorEl.textContent = "Invalid email or password. Try admin@gmail.com / admin123.";
      errorEl.style.display = "block";
    }
  });
}

// ============================================================
// Manage Product page — full add / edit / delete, persisted
// to the shared product data layer above.
// ============================================================
const productBody = document.getElementById("productBody");

if (productBody) {
  function renderProducts() {
    const products = loadProducts();
    productBody.innerHTML = "";

    if (products.length === 0) {
      productBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">No products yet. Click "+ Add Product" to create one.</td></tr>`;
      return;
    }

    products.forEach(p => {
      const status = getStatus(Number(p.stock));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${p.stock}</td>
        <td><span class="status ${status.cls}">${status.label}</span></td>
        <td>
          <button class="text-btn" data-action="edit" data-id="${p.id}">Edit</button>
          <button class="text-btn danger-text" data-action="delete" data-id="${p.id}">Delete</button>
        </td>`;
      productBody.appendChild(tr);
    });

    if (search && search.value) {
      search.dispatchEvent(new Event("input"));
    }
  }

  // ---- Modal wiring ----
  const modal = document.getElementById("productModal");
  const form = document.getElementById("productForm");
  const modalTitle = document.getElementById("modalTitle");
  const addBtn = document.getElementById("addProductBtn");
  const cancelBtn = document.getElementById("cancelModalBtn");

  let editingId = null;

  function openModal(product) {
    editingId = product ? product.id : null;
    modalTitle.textContent = product ? "Edit Product" : "Add Product";
    document.getElementById("productName").value = product ? product.name : "";
    document.getElementById("productCategory").value = product ? product.category : "";
    document.getElementById("productStock").value = product ? product.stock : "";
    modal.classList.add("open");
    document.getElementById("productName").focus();
  }

  function closeModal() {
    modal.classList.remove("open");
    form.reset();
    editingId = null;
  }

  if (addBtn) addBtn.addEventListener("click", () => openModal(null));
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("open")) closeModal();
  });

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const products = loadProducts();
      const name = document.getElementById("productName").value.trim();
      const category = document.getElementById("productCategory").value.trim();
      const stock = parseInt(document.getElementById("productStock").value, 10);

      if (!name || !category || isNaN(stock) || stock < 0) return;

      if (editingId) {
        const p = products.find(p => p.id === editingId);
        if (p) {
          p.name = name;
          p.category = category;
          p.stock = stock;
        }
      } else {
        products.push({
          id: Date.now(),
          name,
          category,
          stock,
          code: nextCode(products),
        });
      }

      saveProducts(products);
      renderProducts();
      closeModal();
    });
  }

  productBody.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const products = loadProducts();
    const product = products.find(p => p.id === id);
    if (!product) return;

    if (btn.dataset.action === "edit") {
      openModal(product);
    } else if (btn.dataset.action === "delete") {
      if (confirm(`Delete "${product.name}"? This cannot be undone.`)) {
        saveProducts(products.filter(p => p.id !== id));
        renderProducts();
      }
    }
  });

  renderProducts();
}