// Use fixed messages: driver errors may contain credentials or connection URIs.
module.exports = (error) => {
  if (error.code === "EADDRINUSE")
    return "Startup failed: port is already in use. Choose another PORT or stop the previous server.";
  if (error.message === "MONGO_URI is required")
    return "Startup failed: MONGO_URI is missing. Configure backend/.env.";
  if (error.message === "JWT_SECRET must contain at least 32 characters")
    return "Startup failed: JWT_SECRET must contain at least 32 characters. Configure backend/.env.";
  if ([error.code, error.cause?.code].some((code) => [18, "AuthenticationFailed"].includes(code)))
    return "Startup failed: MongoDB authentication failed. Check the database username and password in MONGO_URI.";
  if (
    [error.syscall, error.cause?.syscall].some((call) => /querySrv|queryTxt|getaddrinfo/.test(call || ""))
  )
    return "Startup failed: MongoDB DNS lookup failed. Check your internet connection, DNS and Atlas cluster address. Run npm.cmd run test:db from backend for diagnostics.";
  if (["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError"].includes(error.name))
    return "Startup failed: cannot connect to MongoDB. Check your internet connection, Atlas Network Access IP allowlist and cluster availability. Run npm.cmd run test:db from backend for diagnostics.";
  return "Startup failed. Run npm.cmd run test:db from backend and check required environment variables.";
};
