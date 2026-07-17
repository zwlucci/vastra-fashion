function redactSensitive(value) {
  return String(value || "")
    .replace(/(card(number)?|cvv|encryption[_-]?key|auth[_-]?tag|iv)(["'\s:=]+)[^"'\s,}]+/gi, "$1$3[REDACTED]")
    .replace(/\b\d{13,19}\b/g, "[REDACTED_CARD]");
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    console.error(redactSensitive(error.stack || error.message || error));
  }
  res.status(statusCode).json({
    message: statusCode >= 500 ? "Internal server error" : (error.message || "Internal server error")
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}
