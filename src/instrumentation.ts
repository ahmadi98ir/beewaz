/**
 * Next.js Instrumentation Hook — یک‌بار در server startup اجرا می‌شود
 * در standalone Docker: migrations در /app/migrations
 * در dev: migrations در src/lib/db/migrations
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator')
    const { drizzle } = await import('drizzle-orm/postgres-js')
    const postgres = (await import('postgres')).default
    const path = await import('path')
    const fs = await import('fs')

    const DATABASE_URL = process.env.DATABASE_URL
    if (!DATABASE_URL) {
      console.warn('[migration] DATABASE_URL not set — skipping')
      return
    }

    // standalone Docker: /app/migrations | dev: src/lib/db/migrations
    const candidates = [
      path.join(process.cwd(), 'migrations'),
      path.join(process.cwd(), 'src/lib/db/migrations'),
    ]
    const migrationsFolder = candidates.find((p) => fs.existsSync(p))
    if (!migrationsFolder) {
      console.warn('[migration] migrations folder not found — skipping')
      return
    }

    try {
      const sql = postgres(DATABASE_URL, { max: 1 })
      const db = drizzle(sql)
      await migrate(db, { migrationsFolder })
      console.log('[migration] ✅ DB migrations applied —', migrationsFolder)

      // safety-net: جداول ضروری را مستقیم می‌سازیم (در صورت خطای migration tracker)
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "phone_otps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "phone" varchar(15) NOT NULL,
          "code" varchar(6) NOT NULL,
          "expires_at" timestamp with time zone NOT NULL,
          "used_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'qualified';
        ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'proposal_sent';
        ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'won';
        ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'out_of_stock';
        ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'online';
        ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'card_to_card';
        ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'cash_on_delivery';
        ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'installment';
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rating_avg" numeric(3,2) DEFAULT '0';
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL;
        ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_amount" numeric(14,0) DEFAULT '0' NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" numeric(14,0) DEFAULT '0' NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "transaction_id" varchar(100);
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_code" varchar(100);
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_note" text;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "admin_note" text;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" timestamp with time zone;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
        ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_name" varchar(200) DEFAULT '' NOT NULL;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_name" varchar(128);
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sku" varchar(64);
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "total_price" numeric(14,0);
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
        CREATE TABLE IF NOT EXISTS "lead_notes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
          "note" text NOT NULL,
          "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "lead_activities" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
          "type" varchar(32) NOT NULL,
          "description" text NOT NULL,
          "metadata" jsonb DEFAULT '{}'::jsonb,
          "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "follow_ups" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "lead_id" uuid REFERENCES "leads"("id") ON DELETE CASCADE,
          "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
          "scheduled_at" timestamp with time zone NOT NULL,
          "note" text,
          "done_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "customer_notes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "note" text NOT NULL,
          "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "pages" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "slug" varchar(200) UNIQUE NOT NULL,
          "title_fa" varchar(300) NOT NULL,
          "status" varchar(16) DEFAULT 'draft' NOT NULL,
          "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "meta_title" text,
          "meta_desc" text,
          "og_image" text,
          "published_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "product_specs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
          "key_fa" varchar(100) NOT NULL,
          "value_fa" varchar(255) NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "banners" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" varchar(100) NOT NULL,
          "image" text NOT NULL,
          "link" text,
          "target" varchar(10) DEFAULT '_self' NOT NULL,
          "position" varchar(64) DEFAULT 'home_hero' NOT NULL,
          "order_idx" integer DEFAULT 0 NOT NULL,
          "active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        DO $$ BEGIN CREATE TYPE "public"."coupon_type" AS ENUM('percentage', 'fixed');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        CREATE TABLE IF NOT EXISTS "coupons" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "code" varchar(50) UNIQUE NOT NULL,
          "type" "coupon_type" NOT NULL,
          "value" numeric(10,2) NOT NULL,
          "min_order_amount" numeric(14,0),
          "max_discount_amount" numeric(14,0),
          "usage_limit" integer,
          "usage_count" integer DEFAULT 0 NOT NULL,
          "per_user_limit" integer DEFAULT 1,
          "expires_at" timestamp with time zone,
          "active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "coupon_usages" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
          "discount_amount" numeric(14,0) NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(50);

        -- ── فاز ۱: نقش‌های data-driven ──
        -- تبدیل users.role از enum به varchar (غیرتخریبی)
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='users' AND column_name='role' AND udt_name='user_role'
          ) THEN
            ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(30) USING "role"::text;
            ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS "roles" (
          "name" varchar(30) PRIMARY KEY,
          "label_fa" varchar(60) NOT NULL,
          "color" varchar(60),
          "is_system" boolean DEFAULT false NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );

        INSERT INTO "roles" ("name","label_fa","color","is_system","sort_order") VALUES
          ('customer',    'مشتری',        'bg-surface-100 text-surface-700 border-surface-200', true,  0),
          ('admin',       'مدیر کل',      'bg-red-100 text-red-700 border-red-200',             true,  10),
          ('sales_agent', 'کارشناس فروش', 'bg-blue-100 text-blue-700 border-blue-200',          false, 20),
          ('warehouse',   'انباردار',     'bg-amber-100 text-amber-700 border-amber-200',       false, 30),
          ('installer',   'نصاب',         'bg-green-100 text-green-700 border-green-200',        false, 40)
        ON CONFLICT ("name") DO NOTHING;

        -- permission keys جدید (انبار + نصب)
        INSERT INTO "permissions" ("key","label","group_name","sort_order") VALUES
          ('inventory:manage',   'مدیریت موجودی انبار', 'انبار', 10),
          ('installation:read',  'مشاهده سفارش‌های نصب', 'نصب',  10),
          ('installation:write', 'ثبت گزارش نصب',        'نصب',  20)
        ON CONFLICT ("key") DO NOTHING;

        -- مجوزهای پیش‌فرض انباردار
        INSERT INTO "role_permissions" ("role","permission") VALUES
          ('warehouse','dashboard:view'),
          ('warehouse','orders:read'),
          ('warehouse','orders:write'),
          ('warehouse','products:read'),
          ('warehouse','inventory:manage')
        ON CONFLICT DO NOTHING;

        -- مجوزهای پیش‌فرض نصاب
        INSERT INTO "role_permissions" ("role","permission") VALUES
          ('installer','dashboard:view'),
          ('installer','orders:read'),
          ('installer','installation:read'),
          ('installer','installation:write')
        ON CONFLICT DO NOTHING;

        -- admin همه مجوزها را دارد (شامل مجوزهای جدید)
        INSERT INTO "role_permissions" ("role","permission")
          SELECT 'admin', key FROM "permissions"
        ON CONFLICT DO NOTHING;

        -- ── فاز ۲: فاکتور رسمی / حقوقی / مالیات ──
        ALTER TABLE "users"  ADD COLUMN IF NOT EXISTS "billing_info" jsonb;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(14,0) DEFAULT '0' NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "official_invoice" boolean DEFAULT false NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoice_number" bigint;
        CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;
        CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_idx ON "orders" ("invoice_number") WHERE "invoice_number" IS NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billing_snapshot" jsonb;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "needs_installation" boolean DEFAULT false NOT NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assigned_installer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "installation_note" text;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "installed_at" timestamp with time zone;

        -- ── منوی هدر و فوتر (CMS) ──
        CREATE TABLE IF NOT EXISTS "menu_items" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "location" varchar(32) NOT NULL,
          "parent_id" uuid,
          "label" varchar(200) NOT NULL,
          "href" varchar(300) NOT NULL,
          "description" text,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );

        -- ── دفترچه آدرس چندتایی کاربر ──
        CREATE TABLE IF NOT EXISTS "user_addresses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "title" varchar(50),
          "full_name" varchar(100),
          "province" varchar(50),
          "city" varchar(50),
          "street" varchar(255),
          "alley" varchar(255),
          "plaque" varchar(20),
          "unit" varchar(20),
          "postal_code" varchar(10),
          "is_default" boolean DEFAULT false NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "user_addresses_user_idx" ON "user_addresses" ("user_id");
      `)
      console.log('[migration] ✅ all tables ensured')

      // seed تنظیمات مالیات و فاکتور (اگر وجود نداشته باشند)
      try {
        await sql.unsafe(`
          INSERT INTO "site_settings" ("key","value","type","label","group","hint","is_editable","is_required")
          VALUES
            ('vat_rate','10','number','نرخ مالیات بر ارزش افزوده (٪)','commerce','مثال: 10',true,false),
            ('tax_code','','text','کد مالیاتی فروشگاه','commerce','شناسه مالیاتی برای فاکتور رسمی',true,false),
            ('invoice_seller_name','','text','نام فروشنده در فاکتور','commerce',NULL,true,false),
            ('invoice_economic_code','','text','کد اقتصادی فروشنده','commerce',NULL,true,false)
          ON CONFLICT ("key") DO NOTHING;
        `)
      } catch { /* جدول site_settings هنوز ایجاد نشده */ }

      // seed تنظیمات پرداخت کارت به کارت (اگر وجود نداشته باشند)
      try {
        await sql.unsafe(`
          INSERT INTO "site_settings" ("key","value","type","label","group","hint","is_editable","is_required")
          VALUES
            ('bank_card_enabled','false','boolean','فعال‌سازی پرداخت کارت به کارت','commerce',NULL,true,false),
            ('bank_card_number','','text','شماره کارت بانکی','commerce','16 رقم بدون فاصله',true,false),
            ('bank_card_holder','','text','نام صاحب حساب','commerce',NULL,true,false),
            ('bank_card_bank','','text','نام بانک','commerce','مثال: بانک ملت',true,false)
          ON CONFLICT ("key") DO NOTHING;
        `)
      } catch { /* جدول site_settings هنوز ایجاد نشده */ }

      await sql.end()
    } catch (err) {
      // Fail closed: اگر migration یا safety-net DDL شکست بخورد، schema در
      // وضعیت نامعلوم/ناقص است — سرور نباید روی آن ترافیک سرو کند.
      console.error('[migration] ❌ Failed — refusing to serve traffic against a schema in an unknown state:', err)
      process.exit(1)
    }
  }
}
