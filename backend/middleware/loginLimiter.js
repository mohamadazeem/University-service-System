// Single-server limiter; use a shared store when deploying multiple servers.
const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const timer = setInterval(() => {
  for (const [key, value] of attempts)
    if (value.until <= Date.now()) attempts.delete(key);
}, windowMs);
timer.unref();
module.exports = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const record = attempts.get(key);
  const value =
    record && record.until > now ? record : { count: 0, until: now + windowMs };
  value.count++;
  attempts.set(key, value);
  if (value.count > 30) {
    res.set("Retry-After", String(Math.ceil((value.until - now) / 1000)));
    return res
      .status(429)
      .json({ message: "Too many attempts. Try again in 15 minutes." });
  }
  next();
};
