-- Update the products table to cascade on category deletion
-- This ensures if a category is deleted, all its products are removed automatically
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_category_id_fkey,
ADD CONSTRAINT products_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES categories(id)
ON DELETE CASCADE;
