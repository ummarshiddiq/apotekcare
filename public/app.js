const API = "/api";

const $ = id => document.getElementById(id);

let medicines = [];

function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(value);
}

function showMessage(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Terjadi kesalahan.");
    }

    return data;
}

async function loadDashboard() {
    const data = await request(`${API}/dashboard`);

    $("totalMedicines").textContent = data.totalMedicines;
    $("totalStock").textContent = data.totalStock;
    $("lowStock").textContent = data.lowStock;
    $("totalTransactions").textContent = data.totalTransactions;

    $("lowStockTable").innerHTML =
        data.lowStockItems.length
            ? data.lowStockItems.map(item => `
                <tr>
                    <td>${escapeHTML(item.name)}</td>
                    <td class="low">${item.stock}</td>
                    <td>${item.minStock}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="3">Tidak ada stok menipis.</td></tr>`;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function loadMedicines() {
    medicines = await request(`${API}/medicines`);

    renderMedicines();
    renderMedicineOptions();
}

function renderMedicines() {
    const keyword = $("searchMedicine").value.toLowerCase();

    const filtered = medicines.filter(item =>
        item.name.toLowerCase().includes(keyword)
    );

    $("medicineTable").innerHTML = filtered.length
        ? filtered.map(item => {
            const expired = item.expiry < new Date().toISOString().slice(0, 10);
            const status = expired
                ? "Kedaluwarsa"
                : item.stock <= item.minStock
                    ? "Stok Menipis"
                    : "Tersedia";

            return `
                <tr>
                    <td>${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(item.category)}</td>
                    <td>${rupiah(item.price)}</td>
                    <td>${item.stock} ${escapeHTML(item.unit)}</td>
                    <td>${escapeHTML(item.expiry)}</td>
                    <td class="${expired || item.stock <= item.minStock ? "low" : "normal"}">
                        ${status}
                    </td>
                    <td>
                        <button class="edit" data-edit="${item.id}">Edit</button>
                        <button class="danger" data-delete="${item.id}">Hapus</button>
                    </td>
                </tr>
            `;
        }).join("")
        : `<tr><td colspan="7">Data obat tidak ditemukan.</td></tr>`;
}

function renderMedicineOptions() {
    $("purchaseMedicine").innerHTML =
        `<option value="">Pilih obat</option>` +
        medicines
            .filter(item => item.expiry >= new Date().toISOString().slice(0, 10))
            .map(item => `
                <option value="${item.id}">
                    ${escapeHTML(item.name)} - Stok: ${item.stock}
                </option>
            `).join("");
}

function resetMedicineForm() {
    $("medicineForm").reset();
    $("medicineId").value = "";
    $("medicineSubmit").textContent = "Simpan Data Obat";
}

$("medicineForm").addEventListener("submit", async event => {
    event.preventDefault();

    const id = $("medicineId").value;

    const data = {
        name: $("name").value,
        category: $("category").value,
        unit: $("unit").value,
        price: Number($("price").value),
        stock: Number($("stock").value),
        minStock: Number($("minStock").value),
        expiry: $("expiry").value
    };

    try {
        if (id) {
            await request(`${API}/medicines/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            });

            showMessage("Data obat berhasil diperbarui.");
        } else {
            await request(`${API}/medicines`, {
                method: "POST",
                body: JSON.stringify(data)
            });

            showMessage("Obat berhasil ditambahkan.");
        }

        resetMedicineForm();
        await refreshAll();
    } catch (error) {
        showMessage(error.message);
    }
});

$("medicineTable").addEventListener("click", async event => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;

    if (editId) {
        const item = medicines.find(m => m.id === Number(editId));

        if (!item) return;

        $("medicineId").value = item.id;
        $("name").value = item.name;
        $("category").value = item.category;
        $("unit").value = item.unit;
        $("price").value = item.price;
        $("stock").value = item.stock;
        $("minStock").value = item.minStock;
        $("expiry").value = item.expiry;
        $("medicineSubmit").textContent = "Perbarui Obat";

        $("medicines").scrollIntoView({ behavior: "smooth" });
    }

    if (deleteId) {
        if (!confirm("Apakah kamu yakin ingin menghapus obat ini?")) {
            return;
        }

        try {
            await request(`${API}/medicines/${deleteId}`, {
                method: "DELETE"
            });

            showMessage("Obat berhasil dihapus.");
            await refreshAll();
        } catch (error) {
            showMessage(error.message);
        }
    }
});

$("cancelEdit").addEventListener("click", resetMedicineForm);

$("searchMedicine").addEventListener("input", renderMedicines);

$("purchaseForm").addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        medicineId: Number($("purchaseMedicine").value),
        supplier: $("supplier").value,
        quantity: Number($("quantity").value)
    };

    try {
        const result = await request(`${API}/purchases`, {
            method: "POST",
            body: JSON.stringify(data)
        });

        showMessage(result.message);

        $("purchaseForm").reset();

        await refreshAll();
    } catch (error) {
        showMessage(error.message);
    }
});

async function loadPurchases() {
    const purchases = await request(`${API}/purchases`);

    $("purchaseTable").innerHTML = purchases.length
        ? purchases.map(item => `
            <tr>
                <td>${new Date(item.date).toLocaleString("id-ID")}</td>
                <td>${escapeHTML(item.medicineName)}</td>
                <td>${escapeHTML(item.supplier)}</td>
                <td>${item.quantity}</td>
                <td>${rupiah(item.total)}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="5">Belum ada transaksi pembelian.</td></tr>`;
}

async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadMedicines(),
        loadPurchases()
    ]);
}

async function initializeApp() {
    try {
        await refreshAll();
        console.log("ApotekCare berhasil terhubung dengan backend.");
    } catch (error) {
        console.error(error);
        showMessage("Gagal memuat data. Periksa server.");
    }
}

initializeApp();