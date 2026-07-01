export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function notFound(message = "Resource not found") {
  return new AppError(message, 404);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return new AppError(message, 403);
}
