ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS return_reason_category TEXT,
  ADD COLUMN IF NOT EXISTS return_reason_details TEXT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS return_reason_category TEXT,
  ADD COLUMN IF NOT EXISTS return_reason_details TEXT;

ALTER TABLE order_item_return_requests
  ADD COLUMN IF NOT EXISTS customer_reason_category TEXT,
  ADD COLUMN IF NOT EXISTS customer_reason_details TEXT;

UPDATE orders
SET
  return_reason_category = CASE
    WHEN NULLIF(TRIM(return_reason), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(return_reason_category, '')), '') IS NULL
    THEN 'Other'
    ELSE return_reason_category
  END,
  return_reason_details = CASE
    WHEN NULLIF(TRIM(COALESCE(return_reason_details, '')), '') IS NULL
    THEN NULLIF(TRIM(return_reason), '')
    ELSE return_reason_details
  END
WHERE NULLIF(TRIM(return_reason), '') IS NOT NULL;

UPDATE order_items
SET
  return_reason_category = CASE
    WHEN NULLIF(TRIM(return_reason), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(return_reason_category, '')), '') IS NULL
    THEN 'Other'
    ELSE return_reason_category
  END,
  return_reason_details = CASE
    WHEN NULLIF(TRIM(COALESCE(return_reason_details, '')), '') IS NULL
    THEN NULLIF(TRIM(return_reason), '')
    ELSE return_reason_details
  END
WHERE NULLIF(TRIM(return_reason), '') IS NOT NULL;

UPDATE order_item_return_requests
SET
  customer_reason_category = CASE
    WHEN NULLIF(TRIM(customer_reason), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(customer_reason_category, '')), '') IS NULL
    THEN 'Other'
    ELSE customer_reason_category
  END,
  customer_reason_details = CASE
    WHEN NULLIF(TRIM(COALESCE(customer_reason_details, '')), '') IS NULL
    THEN NULLIF(TRIM(customer_reason), '')
    ELSE customer_reason_details
  END
WHERE NULLIF(TRIM(customer_reason), '') IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_return_reason_category_check') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_return_reason_category_check
      CHECK (
        return_reason_category IS NULL OR
        return_reason_category IN (
          'Size does not fit',
          'Item arrived damaged',
          'Received the wrong item',
          'Item does not match the description',
          'Colour or appearance is different',
          'Quality was not as expected',
          'Item arrived too late',
          'Changed my mind',
          'Other'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_return_reason_category_check') THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_return_reason_category_check
      CHECK (
        return_reason_category IS NULL OR
        return_reason_category IN (
          'Size does not fit',
          'Item arrived damaged',
          'Received the wrong item',
          'Item does not match the description',
          'Colour or appearance is different',
          'Quality was not as expected',
          'Item arrived too late',
          'Changed my mind',
          'Other'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'return_requests_customer_reason_category_check') THEN
    ALTER TABLE order_item_return_requests
      ADD CONSTRAINT return_requests_customer_reason_category_check
      CHECK (
        customer_reason_category IS NULL OR
        customer_reason_category IN (
          'Size does not fit',
          'Item arrived damaged',
          'Received the wrong item',
          'Item does not match the description',
          'Colour or appearance is different',
          'Quality was not as expected',
          'Item arrived too late',
          'Changed my mind',
          'Other'
        )
      );
  END IF;
END $$;
