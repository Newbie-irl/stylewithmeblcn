function logout() {
  console.log("Logout is a placeholder for this frontend milestone.");
}

function restockProduct(productName) {
  console.log(`Restock for "${productName}" will be connected to the inventory update flow in a later milestone.`);
}

const search = document.getElementById("searchInput");

if (search) {
  search.addEventListener("input", function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll("#productTable tbody tr").forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}