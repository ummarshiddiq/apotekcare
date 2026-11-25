const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "database.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Membuat database otomatis jika belum tersedia
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(
        dbFile,
        JSON.stringify({ medicines: [], purchases: [] }, null, 2)
    );
}

function readDB() {
    return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

function saveDB(data) {
    const tempFile = dbFile + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, dbFile);
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

// Dashboard
app.get("/api/dashboard", (req, res) => {
    const db = readDB();

    const totalStock = db.medicines.reduce(
        (total, item) => total + item.stock, 0
    );

    const lowStock = db.medicines.filter(
        item => item.stock <= item.minStock
    );

    const totalPurchases = db.purchases.reduce(
        (total, item) => total + item.total, 0
    );

    res.json({
        totalMedicines: db.medicines.length,
        totalStock,
        lowStock: lowStock.length,
        totalTransactions: db.purchases.length,
        totalPurchases,
        lowStockItems: lowStock
    });
});

// Mengambil semua obat
app.get("/api/medicines", (req, res) => {
    const db = readDB();
    res.json(db.medicines);
});

// Menambah obat
app.post("/api/medicines", (req, res) => {
    const { name, category, unit, price, stock, minStock, expiry } = req.body;

    if (
        typeof name !== "string" || !name.trim() ||
        typeof category !== "string" || !category.trim() ||
        typeof unit !== "string" || !unit.trim() ||
        !expiry ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(stock) || stock < 0 ||
        !Number.isInteger(minStock) || minStock < 0
    ) {
        return res.status(400).json({
            message: "Data obat tidak valid."
        });
    }

    const db = readDB();

    const medicine = {
        id: nextId(db.medicines),
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        price,
        stock,
        minStock,
        expiry
    };

    db.medicines.push(medicine);
    saveDB(db);

    res.status(201).json({
        message: "Obat berhasil ditambahkan.",
        medicine
    });
});

// Mengedit data obat
app.put("/api/medicines/:id", (req, res) => {
    const db = readDB();
    const id = Number(req.params.id);

    const medicine = db.medicines.find(item => item.id === id);

    if (!medicine) {
        return res.status(404).json({
            message: "Obat tidak ditemukan."
        });
    }

    const { name, category, unit, price, stock, minStock, expiry } = req.body;

    if (
        typeof name !== "string" || !name.trim() ||
        typeof category !== "string" || !category.trim() ||
        typeof unit !== "string" || !unit.trim() ||
        !expiry ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(stock) || stock < 0 ||
        !Number.isInteger(minStock) || minStock < 0
    ) {
        return res.status(400).json({
            message: "Data obat tidak valid."
        });
    }

    Object.assign(medicine, {
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        price,
        stock,
        minStock,
        expiry
    });

    saveDB(db);

    res.json({
        message: "Data obat berhasil diperbarui.",
        medicine
    });
});

// Menghapus obat
app.delete("/api/medicines/:id", (req, res) => {
    const db = readDB();
    const id = Number(req.params.id);

    const exists = db.medicines.some(item => item.id === id);

    if (!exists) {
        return res.status(404).json({
            message: "Obat tidak ditemukan."
        });
    }

    db.medicines = db.medicines.filter(item => item.id !== id);

    saveDB(db);

    res.json({
        message: "Obat berhasil dihapus."
    });
});

// Mencatat pembelian dan menambah stok
app.post("/api/purchases", (req, res) => {
    const { medicineId, quantity, supplier } = req.body;

    if (
        !Number.isInteger(medicineId) ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        typeof supplier !== "string" ||
        !supplier.trim()
    ) {
        return res.status(400).json({
            message: "Data pembelian tidak valid."
        });
    }

    const db = readDB();

    const medicine = db.medicines.find(
        item => item.id === medicineId
    );

    if (!medicine) {
        return res.status(404).json({
            message: "Obat tidak ditemukan."
        });
    }

    const total = medicine.price * quantity;

    medicine.stock += quantity;

    const purchase = {
        id: nextId(db.purchases),
        medicineId,
        medicineName: medicine.name,
        quantity,
        supplier: supplier.trim(),
        price: medicine.price,
        total,
        date: new Date().toISOString()
    };

    db.purchases.push(purchase);
    saveDB(db);

    res.status(201).json({
        message: "Pembelian berhasil disimpan dan stok diperbarui.",
        purchase
    });
});

// Riwayat pembelian
app.get("/api/purchases", (req, res) => {
    const db = readDB();

    res.json(
        [...db.purchases].reverse()
    );
});

// Menjalankan server
app.listen(PORT, () => {
    console.log("----------------------------------");
    console.log("   APOTEKCARE BERHASIL DIJALANKAN");
    console.log("----------------------------------");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("Status: Aktif");
});