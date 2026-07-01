DELETE FROM products
WHERE LOWER(COALESCE(brand, '')) = 'northloom'
   OR vendor_id IN (
     SELECT id FROM users
     WHERE LOWER(email) = 'northloom@example.com'
        OR LOWER(COALESCE(brand_name, '')) = 'northloom'
        OR LOWER(name) = 'northloom'
   );

DELETE FROM users
WHERE LOWER(email) = 'northloom@example.com'
   OR LOWER(COALESCE(brand_name, '')) = 'northloom'
   OR LOWER(name) = 'northloom';
