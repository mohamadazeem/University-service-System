require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/user");
const v = require("../utils/validation");
async function provision() {
  const name = v.text(process.env.ADMIN_NAME, "ADMIN_NAME", 100);
  const email = v.email(process.env.ADMIN_EMAIL);
  const password = v.password(process.env.ADMIN_PASSWORD);
  await connectDB();
  if (await User.exists({ email })) throw new Error("Existing account");
  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "admin",
  });
  console.log(
    "Administrator created. Remove ADMIN_PASSWORD from your environment.",
  );
}
provision()
  .catch((error) => {
    console.error(
      error instanceof v.HttpError
        ? error.message
        : "Provisioning failed. Check configuration, connectivity, and that the email is unused.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
