import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { serializeUser } from "../utils/serializers.js";

export async function authenticateUser(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.id]);

    if (!rows[0]) {
      throw new AppError("User no longer exists", 401);
    }

    if (rows[0].account_suspended) {
      throw new AppError("This account is currently unavailable. Please contact support.", 403);
    }

    req.user = serializeUser(rows[0]);
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      next(new AppError("Invalid or expired token", 401));
    } else {
      next(error);
    }
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Insufficient role", 403));
    }
    return next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireVendorOrAdmin = requireRole("vendor", "admin");
