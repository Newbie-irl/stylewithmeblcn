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

function restockProduct(productName) {
  console.log(`Restock for "${productName}" will be connected to the inventory update flow in a later milestone.`);
}

function placeholderAction(label) {
  console.log(`"${label}" will be connected in a later milestone.`);
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
// to localStorage as a stand-in for the future backend.
// ============================================================
const productBody = document.getElementById("productBody");

if (productBody) {
  const STORAGE_KEY = "swm_products";

  const seedProducts = [
    { id: 1, name: "Baggy Pants", code: "#0001", category: "Pants", stock: 5 },
    { id: 2, name: "Flared Jeans", code: "#0002", category: "Jeans", stock: 8 },
    { id: 3, name: "Cargo Pants", code: "#0003", category: "Pants", stock: 12 },
    { id: 4, name: "Skinny Jeans", code: "#0004", category: "Jeans", stock: 0 },
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
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