-- شماره فاکتور ترتیبی و یکتا
-- اگر column قبلاً به عنوان varchar اضافه شده باشد، تبدیل به bigint می‌کنیم
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

DO $$
BEGIN
  -- اگر column وجود ندارد، اضافه کن
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN invoice_number bigint;
  ELSIF (
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'invoice_number'
  ) != 'bigint' THEN
    -- اگر varchar بود، مقادیر عددی معتبر را حفظ کن؛ فقط مقادیر واقعاً
    -- غیرعددی (legacy/corrupt) به NULL تبدیل می‌شوند — بدون از دست دادن داده
    ALTER TABLE orders ALTER COLUMN invoice_number TYPE bigint
      USING (
        CASE
          WHEN invoice_number::text ~ '^[0-9]+$' THEN invoice_number::text::bigint
          ELSE NULL
        END
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_idx ON orders (invoice_number) WHERE invoice_number IS NOT NULL;
