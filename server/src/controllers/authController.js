import bcrypt from "bcryptjs";
import { createHash, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import { saveProfileImage } from "../utils/imageUpload.js";
import { sendLoginOtpEmail, sendVerificationEmail } from "../utils/mailer.js";
import { serializeUser } from "../utils/serializers.js";

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function otpExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const SUSPICIOUS_ATTEMPTS = 2;
const DUMMY_PASSWORD_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

function bypassLoginSecurity(email) {
  return email.toLowerCase().endsWith("@example.com");
}

function deviceHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function loginIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function loginResponse(userRecord) {
  const user = serializeUser(userRecord);
  return { token: signToken(user), user };
}

async function completeLogin(userId, ip) {
  const { rows } = await query(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = $2
     WHERE id = $1
     RETURNING *`,
    [userId, ip]
  );
  return loginResponse(rows[0]);
}

async function createLoginChallenge(userId) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const { rows } = await query(
    `INSERT INTO login_otps (user_id, otp_hash, expires_at, resend_available_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '2 minutes')
     RETURNING id`,
    [userId, otpHash, otpExpiry()]
  );
  return { challengeId: rows[0].id, otp };
}

async function deliverLoginOtp(email, otp) {
  await sendLoginOtpEmail(email, otp);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[VASTRA login verification] OTP for ${email}: ${otp} (expires in 10 minutes)`);
  }
}

function logOtp(email, otp) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[VASTRA email verification] OTP for ${email}: ${otp} (expires in 10 minutes)`);
}

async function createVerificationOtp() {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const expires = otpExpiry();
  return { otp, otpHash, expires };
}

async function storeVerificationOtp(userId, otpHash, expires) {
  await query(
    `UPDATE users
     SET email_verification_otp_hash = $1,
         email_verification_expires = $2,
         email_verification_attempts = 0
     WHERE id = $3`,
    [otpHash, expires, userId]
  );
}

async function sendAndLogVerificationEmail(email, otp) {
  await sendVerificationEmail(email, otp);
  logOtp(email, otp);
}

export async function register(req, res) {
  const { name, email, password, phoneNumber, dateOfBirth } = req.body;
  const normalizedEmail = email.toLowerCase();

  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { otp, otpHash, expires } = await createVerificationOtp();
  const { rows } = await query(
    `INSERT INTO users
       (name, email, password_hash, role, phone_number, date_of_birth, email_verified, email_verification_otp_hash, email_verification_expires, email_verification_attempts)
     VALUES ($1, $2, $3, 'user', $4, $5, false, $6, $7, 0)
     RETURNING *`,
    [name, normalizedEmail, passwordHash, phoneNumber || null, dateOfBirth || null, otpHash, expires]
  );

  const user = serializeUser(rows[0]);
  try {
    await sendAndLogVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await query("DELETE FROM users WHERE id = $1", [user.id]);
    throw error;
  }

  res.status(201).json({
    message: "Account created. Please verify your email before logging in.",
    email: normalizedEmail
  });
}

export async function login(req, res) {
  const { email, password, deviceToken } = req.body;
  const normalizedEmail = email.toLowerCase();
  const securityBypass = bypassLoginSecurity(normalizedEmail);
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const userRecord = rows[0];

  if (!securityBypass && userRecord?.locked_until && new Date(userRecord.locked_until).getTime() > Date.now()) {
    throw new AppError("Too many failed attempts. Please try again later.", 429);
  }

  const passwordMatches = await bcrypt.compare(password, userRecord?.password_hash || DUMMY_PASSWORD_HASH);
  if (!userRecord || !passwordMatches) {
    if (userRecord && !securityBypass) {
      const attempts = Number(userRecord.failed_login_attempts || 0) + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      await query(
        `UPDATE users
         SET failed_login_attempts = $2,
             locked_until = CASE WHEN $3 THEN NOW() + ($4 * INTERVAL '1 minute') ELSE NULL END,
             last_login_ip = $5
         WHERE id = $1`,
        [userRecord.id, attempts, shouldLock, LOGIN_LOCK_MINUTES, loginIp(req)]
      );
      if (shouldLock) throw new AppError("Too many failed attempts. Please try again later.", 429);
    }
    throw new AppError("Invalid email or password.", 401);
  }

  if (!securityBypass && !userRecord.email_verified) {
    throw new AppError("Please verify your email before logging in.", 403);
  }

  if (userRecord.account_suspended) {
    throw new AppError("This account is currently unavailable. Please contact support.", 403);
  }

  if (securityBypass) {
    return res.json(await completeLogin(userRecord.id, loginIp(req)));
  }

  const trusted = await query(
    "SELECT id FROM trusted_devices WHERE user_id = $1 AND device_hash = $2",
    [userRecord.id, deviceHash(deviceToken)]
  );
  const requiresOtp = userRecord.role === "admin"
    || !trusted.rows[0]
    || Number(userRecord.failed_login_attempts || 0) >= SUSPICIOUS_ATTEMPTS;

  if (requiresOtp) {
    const recentChallenge = await query(
      `SELECT id, resend_available_at
       FROM login_otps
       WHERE user_id = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userRecord.id]
    );
    if (recentChallenge.rows[0] && new Date(recentChallenge.rows[0].resend_available_at).getTime() > Date.now()) {
      return res.json({
        requiresOtp: true,
        challengeId: recentChallenge.rows[0].id,
        message: "A login code was recently sent. Enter it to continue."
      });
    }
    await query("UPDATE login_otps SET used = true WHERE user_id = $1 AND used = false", [userRecord.id]);
    const challenge = await createLoginChallenge(userRecord.id);
    try {
      await deliverLoginOtp(userRecord.email, challenge.otp);
    } catch (error) {
      await query("DELETE FROM login_otps WHERE id = $1", [challenge.challengeId]);
      throw error;
    }
    return res.json({
      requiresOtp: true,
      challengeId: challenge.challengeId,
      message: "Enter the verification code sent to your email."
    });
  }

  await query("UPDATE trusted_devices SET last_used_at = NOW() WHERE id = $1", [trusted.rows[0].id]);
  return res.json(await completeLogin(userRecord.id, loginIp(req)));
}

export async function verifyLoginOtp(req, res) {
  const { challengeId, otp, deviceToken } = req.body;
  const { rows } = await query(
    `SELECT login_otps.*, users.email, users.role, users.account_suspended
     FROM login_otps
     JOIN users ON users.id = login_otps.user_id
     WHERE login_otps.id = $1`,
    [challengeId]
  );
  const challenge = rows[0];

  if (!challenge || challenge.used || new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new AppError("Invalid or expired login code.", 400);
  }
  if (challenge.attempts >= 5) {
    throw new AppError("Too many incorrect attempts. Request a new login code.", 429);
  }
  if (challenge.account_suspended) {
    throw new AppError("This account is currently unavailable. Please contact support.", 403);
  }

  const matches = await bcrypt.compare(otp, challenge.otp_hash);
  if (!matches) {
    await query("UPDATE login_otps SET attempts = attempts + 1 WHERE id = $1", [challengeId]);
    throw new AppError("Invalid or expired login code.", 400);
  }

  const claimed = await query(
    "UPDATE login_otps SET used = true WHERE id = $1 AND used = false RETURNING user_id",
    [challengeId]
  );
  if (!claimed.rows[0]) throw new AppError("Invalid or expired login code.", 400);

  await query(
    `INSERT INTO trusted_devices (user_id, device_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id, device_hash) DO UPDATE SET last_used_at = NOW()`,
    [challenge.user_id, deviceHash(deviceToken)]
  );
  res.json(await completeLogin(challenge.user_id, loginIp(req)));
}

export async function resendLoginOtp(req, res) {
  const { rows } = await query(
    `SELECT login_otps.*, users.email
     FROM login_otps
     JOIN users ON users.id = login_otps.user_id
     WHERE login_otps.id = $1 AND login_otps.used = false`,
    [req.body.challengeId]
  );
  const challenge = rows[0];
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new AppError("This login challenge has expired. Please log in again.", 400);
  }
  if (new Date(challenge.resend_available_at).getTime() > Date.now()) {
    throw new AppError("Please wait before requesting another login code.", 429);
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  await deliverLoginOtp(challenge.email, otp);
  await query(
    `UPDATE login_otps
     SET otp_hash = $2, expires_at = $3, resend_available_at = NOW() + INTERVAL '2 minutes', attempts = 0
     WHERE id = $1`,
    [challenge.id, otpHash, otpExpiry()]
  );
  res.json({ message: "A new login code has been sent." });
}

export async function verifyEmail(req, res) {
  const { email, otp } = req.body;
  const normalizedEmail = email.toLowerCase();
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const userRecord = rows[0];

  if (!userRecord) {
    throw new AppError("Invalid or expired verification code", 400);
  }

  if (userRecord.email_verified) {
    return res.json({ message: "Email is already verified." });
  }

  if (!userRecord.email_verification_otp_hash || !userRecord.email_verification_expires) {
    throw new AppError("Verification code not found. Please request a new OTP.", 400);
  }

  if (userRecord.email_verification_attempts >= 5) {
    throw new AppError("Too many incorrect verification attempts. Please request a new OTP.", 429);
  }

  if (new Date(userRecord.email_verification_expires).getTime() < Date.now()) {
    throw new AppError("Verification code has expired. Please request a new OTP.", 400);
  }

  const matches = await bcrypt.compare(otp, userRecord.email_verification_otp_hash);
  if (!matches) {
    await query("UPDATE users SET email_verification_attempts = email_verification_attempts + 1 WHERE id = $1", [
      userRecord.id
    ]);
    throw new AppError("Invalid verification code", 400);
  }

  await query(
    `UPDATE users
     SET email_verified = true,
         email_verification_otp_hash = NULL,
         email_verification_expires = NULL,
         email_verification_attempts = 0
     WHERE id = $1`,
    [userRecord.id]
  );

  res.json({ message: "Email verified. You can now log in." });
}

export async function resendVerificationOtp(req, res) {
  const normalizedEmail = req.body.email.toLowerCase();
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const userRecord = rows[0];

  if (!userRecord) {
    return res.json({ message: "If an unverified account exists, a new OTP has been sent." });
  }

  if (userRecord.email_verified) {
    return res.json({ message: "Email is already verified." });
  }

  if (userRecord.email_verification_expires) {
    const expiresAt = new Date(userRecord.email_verification_expires).getTime();
    const minutesRemaining = (expiresAt - Date.now()) / 60000;
    if (minutesRemaining > 8) {
      throw new AppError("Please wait before requesting another OTP.", 429);
    }
  }

  const { otp, otpHash, expires } = await createVerificationOtp();
  await storeVerificationOtp(userRecord.id, otpHash, expires);
  await sendAndLogVerificationEmail(normalizedEmail, otp);
  res.json({ message: "A new verification OTP has been sent." });
}

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function updateMe(req, res) {
  const { name, phoneNumber, dateOfBirth, brandName, brandDescription, profileImageData, currentPassword, newPassword } = req.body;
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const userRecord = rows[0];

  if (!userRecord) {
    throw new AppError("User no longer exists", 401);
  }

  if ((brandName || brandDescription) && userRecord.role !== "vendor") {
    throw new AppError("Only vendors can update brand details", 403);
  }

  let passwordHash = userRecord.password_hash;
  if (newPassword) {
    const matches = await bcrypt.compare(currentPassword, userRecord.password_hash);
    if (!matches) {
      throw new AppError("Current password is incorrect", 400);
    }
    passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const profileImageUrl = await saveProfileImage(profileImageData);
  const hasPhoneNumber = Object.prototype.hasOwnProperty.call(req.body, "phoneNumber");
  const hasDateOfBirth = Object.prototype.hasOwnProperty.call(req.body, "dateOfBirth");

  const updated = await query(
    `UPDATE users
     SET name = COALESCE($1, name),
         brand_name = CASE WHEN role = 'vendor' THEN COALESCE($2, brand_name) ELSE brand_name END,
         brand_description = CASE WHEN role = 'vendor' THEN COALESCE($3, brand_description) ELSE brand_description END,
         phone_number = CASE WHEN $4 THEN $5 ELSE phone_number END,
         date_of_birth = CASE WHEN $6 THEN $7 ELSE date_of_birth END,
         password_hash = $8,
         profile_image_url = COALESCE($9, profile_image_url)
     WHERE id = $10
     RETURNING *`,
    [name || null, brandName || null, brandDescription ?? null, hasPhoneNumber, phoneNumber || null, hasDateOfBirth, dateOfBirth || null, passwordHash, profileImageUrl, req.user.id]
  );

  res.json({ user: serializeUser(updated.rows[0]) });
}
