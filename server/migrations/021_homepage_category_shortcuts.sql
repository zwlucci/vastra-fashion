CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homepage_category_shortcuts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_url TEXT NOT NULL,
  mapped_category TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('homepage_categories_visible', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON app_settings;
CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS homepage_category_shortcuts_set_updated_at ON homepage_category_shortcuts;
CREATE TRIGGER homepage_category_shortcuts_set_updated_at BEFORE UPDATE ON homepage_category_shortcuts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_homepage_category_shortcuts_active_order
ON homepage_category_shortcuts(is_active, display_order, display_name);
