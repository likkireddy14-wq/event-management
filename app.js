
const express = require("express");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, file.mimetype.startsWith("image/"));
    }
});

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Root",
    database: "likkis event management system",
    waitForConnections: true,
    connectionLimit: 10
});

function removeImage(image) {
    if (!image) return;
    const filename = path.basename(image);
    const imagePath = path.join(uploadDir, filename);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
}

// READ: list all events
app.get("/api/events", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM events ORDER BY event_date DESC, id DESC"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// READ: view one event
app.get("/api/events/:id", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM events WHERE id = ?", [req.params.id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE: add an event
app.post("/api/events", upload.single("image"), async (req, res) => {
    try {
        const { event_name, event_type, event_date, venue, description } = req.body;

        if (!event_name || !event_type || !event_date || !venue || !description) {
            return res.status(400).json({ error: "Please fill in all required fields." });
        }

        const image = req.file ? req.file.filename : null;

        const [result] = await pool.query(
            `INSERT INTO events
            (event_name, event_type, event_date, venue, description, image)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [event_name, event_type, event_date, venue, description, image]
        );

        res.status(201).json({
            message: "Event created successfully!",
            id: result.insertId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE: edit an event
app.put("/api/events/:id", upload.single("image"), async (req, res) => {
    try {
        const { event_name, event_type, event_date, venue, description } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM events WHERE id = ?", [req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Event not found" });
        }

        const oldEvent = rows[0];
        const image = req.file ? req.file.filename : oldEvent.image;

        await pool.query(
            `UPDATE events SET event_name=?, event_type=?, event_date=?,
             venue=?, description=?, image=? WHERE id=?`,
            [
                event_name, event_type, event_date,
                venue, description, image, req.params.id
            ]
        );

        if (req.file && oldEvent.image) removeImage(oldEvent.image);

        res.json({ message: "Event updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: remove an event
app.delete("/api/events/:id", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT image FROM events WHERE id = ?", [req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Event not found" });
        }

        await pool.query("DELETE FROM events WHERE id = ?", [req.params.id]);
        removeImage(rows[0].image);

        res.json({ message: "Event deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message || "Request failed" });
});

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("MySQL connected successfully");
        app.listen(PORT, () => {
            console.log(`Likki's Event Management: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("MySQL connection failed:", err.message);
    }
}

startServer();
