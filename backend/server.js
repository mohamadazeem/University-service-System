require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
const connectDB = require("./config/db");
const startupError = require("./utils/startupError");
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  await connectDB();
  // Do not accept bookings before the database uniqueness guards are ready.
  await Promise.all([
    require("./models/user").init(),
    require("./models/Appointment").init(),
    require("./models/AppointmentSlot").init(),
    require("./models/Notification").init(),
    require("./models/Complaint").init(),
  ]);
  const app = require("./app");
  const port = process.env.PORT || 5000;
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, (error) => {
      if (error) reject(error);
      else resolve(listener);
    });
  });
  console.log(`University Service System API started on port ${port}; MongoDB connected`);
  const shutdown = () =>
    server.close(async () => {
      await require("mongoose").disconnect();
      process.exit(0);
    });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
start().catch(async (error) => {
  console.error(startupError(error));
  await require("mongoose").disconnect();
  process.exitCode = 1;
});
