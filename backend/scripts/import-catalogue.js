require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Service = require("../models/service");
const connectDB = require("../config/db");
const { escapeRegex } = require("../utils/validation");
// The six services previously displayed in the student portal, now stored persistently.
const catalogue = [
  {
    name: "Transcript Request",
    description: "Request an official academic transcript from the university.",
    department: "Registry",
  },
  {
    name: "Certificate Request",
    description: "Request official university certificates and documents.",
    department: "Registry",
  },
  {
    name: "Student ID Request",
    description: "Request a new or replacement student identification card.",
    department: "Student Services",
  },
  {
    name: "Letter Request",
    description:
      "Request official letters required for academic or other purposes.",
    department: "Registry",
  },
  {
    name: "Library Service",
    description: "Request assistance related to university library services.",
    department: "Library",
  },
  {
    name: "Other Service",
    description: "Submit a request for another university service.",
    department: "Student Services",
  },
];
async function importCatalogue() {
  await connectDB();
  await Service.init();
  let created = 0;
  for (const item of catalogue) {
    const exists = await Service.exists({
      name: { $regex: "^" + escapeRegex(item.name) + "$", $options: "i" },
    });
    if (!exists) {
      await Service.create({
        ...item,
        nameKey: item.name.toLowerCase(),
        active: true,
      });
      created++;
    }
  }
  console.log(
    `Imported ${created} missing services. Existing services were not changed.`,
  );
}
importCatalogue()
  .catch(() => {
    console.error(
      "Catalogue import failed. Check connectivity and service names.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
