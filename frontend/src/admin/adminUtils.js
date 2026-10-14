export const dateTime = (value) =>
  value ? new Date(value).toLocaleString() : "—";
export const listUrl = (path, filters, page) =>
  path +
  "?" +
  new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== ""),
    ),
    page,
    limit: 10,
  });
