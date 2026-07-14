import { PRODUCT_CATEGORIES } from "../../../shared/productCategories.mjs";
import { query } from "../config/db.js";
import { AppError, notFound } from "../utils/errors.js";
import { saveHomepageCategoryIcon } from "../utils/imageUpload.js";
import { emitDashboardUpdated } from "../socket.js";

const SETTING_KEY = "homepage_categories_visible";

function slugify(value) {
  return value
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serializeShortcut(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    iconUrl: row.icon_url,
    mappedCategory: row.mapped_category,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getHomepageCategoryVisibility() {
  const { rows } = await query("SELECT value FROM app_settings WHERE key = $1", [SETTING_KEY]);
  return rows[0]?.value?.enabled !== false;
}

async function setHomepageCategoryVisibility(enabled) {
  await query(
    `INSERT INTO app_settings (key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [SETTING_KEY, JSON.stringify({ enabled })]
  );
}

export async function listHomepageCategoryShortcuts(_req, res) {
  const visible = await getHomepageCategoryVisibility();
  if (!visible) {
    return res.json({ visible, shortcuts: [] });
  }

  const { rows } = await query(
    `SELECT *
     FROM homepage_category_shortcuts
     WHERE is_active = true
     ORDER BY display_order ASC, display_name ASC`
  );

  return res.json({ visible, shortcuts: rows.map(serializeShortcut) });
}

export async function getHomepageCategoryShortcut(req, res) {
  const { rows } = await query(
    `SELECT *
     FROM homepage_category_shortcuts
     WHERE slug = $1 AND is_active = true`,
    [req.params.slug]
  );
  if (!rows[0]) throw notFound("Category shortcut not found");
  res.json({ shortcut: serializeShortcut(rows[0]) });
}

export async function listAdminHomepageCategoryShortcuts(_req, res) {
  const [visible, shortcuts] = await Promise.all([
    getHomepageCategoryVisibility(),
    query("SELECT * FROM homepage_category_shortcuts ORDER BY display_order ASC, display_name ASC")
  ]);

  res.json({ visible, shortcuts: shortcuts.rows.map(serializeShortcut), productCategories: PRODUCT_CATEGORIES });
}

export async function updateAdminHomepageCategoryVisibility(req, res) {
  await setHomepageCategoryVisibility(req.body.visible);
  emitDashboardUpdated("homepage-categories");
  res.json({ visible: req.body.visible });
}

async function assertMappedCategoryAvailable(mappedCategory, currentId = null) {
  const params = [mappedCategory];
  let sql = "SELECT id FROM homepage_category_shortcuts WHERE mapped_category = $1";
  if (currentId) {
    params.push(currentId);
    sql += " AND id <> $2";
  }
  const { rows } = await query(sql, params);
  if (rows[0]) {
    throw new AppError("A shortcut for this mapped category already exists", 409);
  }
}

export async function createAdminHomepageCategoryShortcut(req, res) {
  const { displayName, mappedCategory, iconData, isActive, displayOrder } = req.body;
  if (!iconData) throw new AppError("Icon is required when creating a shortcut", 400);
  await assertMappedCategoryAvailable(mappedCategory);
  const iconUrl = await saveHomepageCategoryIcon(iconData);
  const slug = slugify(mappedCategory);
  const { rows } = await query(
    `INSERT INTO homepage_category_shortcuts (display_name, slug, icon_url, mapped_category, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [displayName, slug, iconUrl, mappedCategory, isActive, displayOrder]
  );
  emitDashboardUpdated("homepage-categories");
  res.status(201).json({ shortcut: serializeShortcut(rows[0]) });
}

export async function updateAdminHomepageCategoryShortcut(req, res) {
  const existing = await query("SELECT * FROM homepage_category_shortcuts WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) throw notFound("Homepage category shortcut not found");

  const { displayName, mappedCategory, iconData, isActive, displayOrder } = req.body;
  await assertMappedCategoryAvailable(mappedCategory, req.params.id);
  const iconUrl = iconData ? await saveHomepageCategoryIcon(iconData) : existing.rows[0].icon_url;
  const slug = slugify(mappedCategory);

  const { rows } = await query(
    `UPDATE homepage_category_shortcuts
     SET display_name = $2,
         slug = $3,
         icon_url = $4,
         mapped_category = $5,
         is_active = $6,
         display_order = $7
     WHERE id = $1
     RETURNING *`,
    [req.params.id, displayName, slug, iconUrl, mappedCategory, isActive, displayOrder]
  );
  emitDashboardUpdated("homepage-categories");
  res.json({ shortcut: serializeShortcut(rows[0]) });
}

export async function deleteAdminHomepageCategoryShortcut(req, res) {
  const { rows } = await query("DELETE FROM homepage_category_shortcuts WHERE id = $1 RETURNING id", [req.params.id]);
  if (!rows[0]) throw notFound("Homepage category shortcut not found");
  emitDashboardUpdated("homepage-categories");
  res.status(204).send();
}
