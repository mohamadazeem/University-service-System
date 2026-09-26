const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const requestRoutes = require("./routes/requestRoutes");
const protect = require("./middleware/authMiddleware");

dotenv.config();
console.log("JWT SECRET:", process.env.JWT_SECRET);
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
//Request
app.use("/api/requests", requestRoutes);

app.get("/", (req, res) => {
    res.send("University Service Management API is running!");
});

// Protected route
app.get("/api/protected", protect, (req, res) => {
    res.json({
        message: "You accessed a protected route!",
        user: req.user
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});