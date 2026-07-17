CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'vendor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  brand_name TEXT,
  brand_description TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  profile_image_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_otp_hash TEXT,
  email_verification_expires TIMESTAMPTZ,
  email_verification_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Unisex',
  brand TEXT NOT NULL,
  sizes TEXT[] NOT NULL DEFAULT '{}',
  size_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  colors TEXT[] NOT NULL DEFAULT '{}',
  color_stock_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT NOT NULL,
  product_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_type TEXT NOT NULL DEFAULT 'normal' CHECK (product_type IN ('normal', 'bundle')),
  bundle_original_price NUMERIC(10, 2),
  bundle_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (bundle_discount_percentage >= 0 AND bundle_discount_percentage <= 100),
  custom_bundle_image_url TEXT,
  status product_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  low_stock_alert_sent BOOLEAN NOT NULL DEFAULT false,
  out_of_stock_alert_sent BOOLEAN NOT NULL DEFAULT false,
  wardrobe_enabled BOOLEAN NOT NULL DEFAULT false,
  wardrobe_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  selected_size TEXT NOT NULL DEFAULT '',
  selected_color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id, selected_size)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_bundle_items (
  bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bundle_product_id, component_product_id),
  CHECK (bundle_product_id <> component_product_id)
);

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS home_collection_products (
  collection_key TEXT PRIMARY KEY CHECK (collection_key IN ('Men', 'Women', 'Unisex')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  selected_size TEXT NOT NULL DEFAULT '',
  selected_color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase NUMERIC(10, 2) NOT NULL CHECK (price_at_purchase >= 0)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_message_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'vendor', 'admin', 'system-admin')),
  body TEXT NOT NULL,
  image_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  read_by_user BOOLEAN NOT NULL DEFAULT false,
  read_by_vendor BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, vendor_id)
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_alert_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_stock_alert_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS size_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS color_stock_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS bundle_original_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bundle_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_bundle_image_url TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS wardrobe_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wardrobe_image_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS selected_color TEXT NOT NULL DEFAULT '';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_color TEXT NOT NULL DEFAULT '';

ALTER TABLE message_conversations
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS read_by_vendor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cart_items_set_updated_at ON cart_items;
CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS message_conversations_set_updated_at ON message_conversations;
CREATE TRIGGER message_conversations_set_updated_at BEFORE UPDATE ON message_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS reviews_set_updated_at ON reviews;
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS product_reviews_set_updated_at ON product_reviews;
CREATE TRIGGER product_reviews_set_updated_at BEFORE UPDATE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS vendor_reviews_set_updated_at ON vendor_reviews;
CREATE TRIGGER vendor_reviews_set_updated_at BEFORE UPDATE ON vendor_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_component ON product_bundle_items(component_product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_id ON wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_product_id ON wardrobe_items(product_id);
CREATE INDEX IF NOT EXISTS idx_home_collection_products_product_id ON home_collection_products(product_id);
DROP INDEX IF EXISTS idx_message_conversations_contact_message_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_conversations_contact_message_id ON message_conversations(contact_message_id);
CREATE INDEX IF NOT EXISTS idx_message_conversations_user_id ON message_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_message_conversations_vendor_id ON message_conversations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_message_conversations_order_id ON message_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pinned_created_at ON reviews(pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_id ON vendor_reviews(vendor_id, created_at DESC);
