// Read-only preflight: never rewrites accounts, drops indexes or prints identities.
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { normalize } = require("../utils/staffId");
async function audit() {
  await require("../config/db")();
  const users = mongoose.connection.collection("users");
  const rows = await users.find({}, { projection: { staffId: 1, role: 1 } }).toArray();
  const groups = new Map();
  let missingStaffIds = 0, nonCanonicalIds = 0, invalidIds = 0;
  for (const row of rows) {
    if (row.staffId === undefined) { if (row.role === "staff") missingStaffIds++; continue; }
    const id = normalize(row.staffId);
    if (typeof id !== "string" || !id || id.length > 50) { invalidIds++; continue; }
    if (id !== row.staffId) nonCanonicalIds++;
    groups.set(id, (groups.get(id) || 0) + 1);
  }
  const duplicates = [...groups.values()].filter((count) => count > 1).length;
  const indexes = await users.indexes();
  const uniqueIndex = indexes.some((index) => index.key.staffId === 1 && Object.keys(index.key).length === 1 && index.unique && index.sparse);
  console.log(JSON.stringify({ staffAccounts: rows.filter((row) => row.role === "staff").length, existingStaffWithoutId: missingStaffIds, nonCanonicalIds, invalidIds, duplicateNormalizedIdGroups: duplicates, sparseUniqueStaffIdIndex: uniqueIndex }, null, 2));
  if (duplicates || nonCanonicalIds || invalidIds) {
    console.error("Staff ID audit requires administrator review. No accounts or indexes were modified. See docs/STAFF-WORKFLOW.md.");
    process.exitCode = 1;
  }
}
audit().catch((error) => {
  console.error(require("../utils/startupError")(error));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
