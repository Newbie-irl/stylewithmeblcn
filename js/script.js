function logout() { alert("Logout is a placeholder for this frontend milestone."); }
const search = document.getElementById("searchInput");
if (search) { search.addEventListener("input", function () { const q = this.value.toLowerCase(); document.querySelectorAll("#productTable tbody tr").forEach(r => { r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none" }) }); }