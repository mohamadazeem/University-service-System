const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorMiddleware");
const protect = require("./middleware/authMiddleware");
const app = express();
app.disable("x-powered-by");
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }),
);
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/requests", require("./routes/RequestRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/services", require("./routes/serviceRoutes"));
app.get("/api/protected", protect, (req, res) =>
  res.json({ message: "Authenticated", user: req.user }),
);
app.get("/", (req, res) =>
  res.json({ message: "University Service System API" }),
);
app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use(errorHandler);
module.exports = app;
