UPDATE products
SET gender = CASE
  WHEN name IN ('Rib Knit Column Dress', 'Linen Hour Blazer', 'Cropped Wool Coat') THEN 'Women'
  WHEN name = 'Tailored Wide-Leg Trouser' THEN 'Men'
  ELSE gender
END
WHERE name IN ('Rib Knit Column Dress', 'Linen Hour Blazer', 'Cropped Wool Coat', 'Tailored Wide-Leg Trouser');
