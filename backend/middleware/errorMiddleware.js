module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000)
    return res
      .status(409)
      .json({ message: "A record with these details already exists" });
  if (
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.type === "entity.parse.failed"
  )
    return res.status(400).json({ message: "Invalid request data" });
  const status =
    error.status || (error.name === "MongooseServerSelectionError" ? 503 : 500);
  res
    .status(status)
    .json({
      message:
        status < 500
          ? error.message
          : "The service is temporarily unavailable. Please try again.",
    });
};
