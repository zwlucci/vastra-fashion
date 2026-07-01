import { query } from "../config/db.js";
import { notFound } from "../utils/errors.js";

function mapReview(row) {
  return {
    id: row.id,
    body: row.body,
    rating: row.rating,
    pinned: row.pinned,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      profileImageUrl: row.profile_image_url || ""
    }
  };
}

export async function listReviews(_req, res) {
  const { rows } = await query(
    `SELECT reviews.*, users.name AS user_name, users.profile_image_url
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.pinned DESC, reviews.created_at DESC
     LIMIT 12`
  );
  res.json({ reviews: rows.map(mapReview) });
}

export async function createReview(req, res) {
  const { rows } = await query(
    `INSERT INTO reviews (user_id, body, rating)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user.id, req.body.body, req.body.rating || null]
  );
  const joined = await query(
    `SELECT reviews.*, users.name AS user_name, users.profile_image_url
     FROM reviews JOIN users ON users.id = reviews.user_id
     WHERE reviews.id = $1`,
    [rows[0].id]
  );
  res.status(201).json({ review: mapReview(joined.rows[0]) });
}

export async function setReviewPinned(req, res) {
  const { rows } = await query("UPDATE reviews SET pinned = $1 WHERE id = $2 RETURNING *", [req.body.pinned, req.params.id]);
  if (!rows[0]) throw notFound("Review not found");
  res.json({ review: rows[0] });
}

export async function listAdminReviews(_req, res) {
  const { rows } = await query(
    `SELECT reviews.*, users.name AS user_name, users.profile_image_url
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.pinned DESC, reviews.created_at DESC`
  );
  res.json({ reviews: rows.map(mapReview) });
}
