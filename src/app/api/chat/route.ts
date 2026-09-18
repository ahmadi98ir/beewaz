import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/gemini'
import { db } from '@/lib/db'
import { products, categories } from '@/lib/db/schema'
import { chatSessions, chatMessages } from '@/lib/db/schema/chat'
import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import {
  findMentionedProducts,
  productAvailabilityLabel,
  type GroundedProduct,
} from '@/lib/chat/product-grounding'

// ── Product context for system prompt ─────────────────────────────────────────

interface ProductSnapshot extends GroundedProduct {
  slug: string
  price: number
  category: string | null
  categorySlug: string | null
  warrantyDays: number
}

function productUrl(product: ProductSnapshot): string {
  return product.categorySlug
    ? `https://beewaz.ir/shop/${product.categorySlug}/${product.slug}`
    : `https://beewaz.ir/shop/${product.slug}`
}

function productFactLine(product: ProductSnapshot): string {
  const price = Math.floor(product.price / 10).toLocaleString('fa-IR')
  const warranty = product.warrantyDays > 0
    ? ` | گارانتی ثبت‌شده: ${Math.round(product.warrantyDays / 30)} ماه`
    : ''

  return [
    `- ${product.name}`,
    `مدل/SKU: ${product.sku}`,
    `دسته: ${product.category ?? 'عمومی'}`,
    `قیمت: ${price} تومان`,
    `وضعیت: ${productAvailabilityLabel(product)}`,
    `لینک: ${productUrl(product)}${warranty}`,
  ].join(' | ')
}

async function getProductContext(lastUserText: string): Promise<{
  catalogContext: string
  mentionedContext: string
}> {
  try {
    const rows = await db
      .select({
        name: products.nameFa,
        sku: products.sku,
        slug: products.slug,
        price: products.price,
        stock: products.stock,
        status: products.status,
        warrantyDays: products.warrantyDays,
        category: categories.nameFa,
        categorySlug: categories.slug,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        inArray(products.status, ['active', 'out_of_stock']),
        isNull(products.deletedAt),
      ))
      .orderBy(desc(products.isFeatured), desc(products.createdAt))
      .limit(120)

    const snapshots: ProductSnapshot[] = rows.map((row) => ({
      name: row.name,
      sku: row.sku,
      slug: row.slug,
      price: row.price,
      stock: row.stock,
      status: row.status === 'out_of_stock' ? 'out_of_stock' : 'active',
      warrantyDays: row.warrantyDays,
      category: row.category,
      categorySlug: row.categorySlug,
    }))

    if (snapshots.length === 0) {
      return {
        catalogContext: 'دادهٔ محصولی از فروشگاه دریافت نشد؛ درباره موجودی یا قیمت حدس نزن.',
        mentionedContext: '',
      }
    }

    const mentioned = findMentionedProducts(lastUserText, snapshots)
    return {
      catalogContext: [
        'کاتالوگ فعلی فروشگاه (دادهٔ مستقیم از دیتابیس همین سایت):',
        ...snapshots.map(productFactLine),
      ].join('\n'),
      mentionedContext: mentioned.length > 0
        ? [
            'محصول/مدل‌هایی که در آخرین پیام مشتری به‌طور مستقیم تشخیص داده شدند:',
            ...mentioned.map(productFactLine),
            'این بخش برای پاسخ درباره همان مدل‌ها اولویت بالاتری از برداشت آزاد مدل دارد.',
          ].join('\n')
        : '',
    }
  } catch (error) {
    console.error('[chat] product context failed', error)
    return {
      catalogContext: 'دادهٔ محصولی از فروشگاه دریافت نشد؛ درباره موجودی یا قیمت حدس نزن.',
      mentionedContext: '',
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(catalogContext: string, mentionedContext: string): string {
  return `تو BEE، دستیار فروش هوشمند رسمی سایت بیواز هستی. الان داخل وب‌سایت رسمی https://beewaz.ir با مشتری صحبت می‌کنی. بیواز فروشگاه تخصصی سیستم‌های امنیتی، دزدگیر، حسگر و تجهیزات هوشمند در ایران است.

وظیفه‌ات:
۱. مشاوره صادقانه و دقیق برای انتخاب سیستم امنیتی مناسب
۲. معرفی فقط محصولاتی که با دادهٔ واقعی فروشگاه سازگارند
۳. پاسخ به سؤال‌های فنی و سؤال‌های مربوط به خود سایت بیواز
۴. دریافت شماره تماس فقط وقتی مشتری واقعاً درخواست خرید/پیگیری انسانی دارد

قوانین قطعی درباره داده و موجودی:
- کاتالوگ زیر مستقیم از دیتابیس همان سایتی آمده که مشتری در آن است؛ آن را منبع حقیقت قیمت، مدل و موجودی بدان.
- status=active به معنی فعال/قابل‌نمایش بودن محصول در سایت است؛ موجودی خرید را فقط stock تعیین می‌کند.
- محصول active با stock=0 ممکن است هنوز صفحه یا کارت محصول داشته باشد، اما موجودی انبارش صفر است. این دو مفهوم را با هم قاطی نکن.
- محصول out_of_stock را «ناموجود» بدان.
- برای پیشنهاد خرید، فقط محصول active با stock>0 را پیشنهاد بده؛ مگر اینکه مشتری مشخصاً درباره محصول ناموجود سؤال کرده باشد.
- هرگز موجود یا ناموجود بودن، قیمت، مدل، قابلیت یا مشخصات فنی را از خودت حدس نزن.
- اگر مشتری گفت «روی سایت هست/موجوده»، نگو اطلاعاتی درباره سایت نداری؛ تو دستیار خود beewaz.ir هستی. وضعیت همان محصول را از دادهٔ زیر توضیح بده.
- اگر دادهٔ محصول در دسترس نبود، صریح بگو امکان تأیید موجودی لحظه‌ای نداری و حدس نزن.
- اگر بخش «محصول‌های تشخیص‌داده‌شده» وجود دارد، حقایق آن بخش بر هر برداشت قبلی یا حدس اولویت دارند.

سبک پاسخ:
- همیشه فارسی طبیعی و محاوره‌ایِ محترمانه پاسخ بده.
- پاسخ را معمولاً کوتاه و روشن نگه دار؛ اگر مشتری مقایسه یا توضیح کامل خواست، جزئیات کافی بده.
- قیمت‌ها را به تومان بگو.
- ایموجی کم و هدفمند استفاده کن.
- شماره تماس را در هر پاسخ تکرار نکن و برای گرفتن لید عجله نکن.

اطلاعات رسمی فعلی:
- سایت رسمی: https://beewaz.ir
- تلفن: ۰۲۱-۴۷۹۵۶
- ایمیل: info@beewaz.ir
- گارانتی طلایی اعلام‌شده در سایت: ۲۴ ماه
- پشتیبانی: ۲۴/۷

${mentionedContext ? `${mentionedContext}\n\n` : ''}${catalogContext}

وقتی مشتری شماره تماسش را برای پیگیری داد، پیامت را با این متن دقیق شروع کن:
"✅ شماره [شماره] ثبت شد."`
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function getOrCreateSession(
  sessionId: string | undefined,
  visitorToken: string | undefined,
): Promise<string> {
  if (sessionId) {
    const [existing] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1)
    if (existing) return existing.id
  }

  const [created] = await db
    .insert(chatSessions)
    .values({
      visitorToken: visitorToken ?? null,
      status: 'active',
    })
    .returning({ id: chatSessions.id })

  return created!.id
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface ChatRequest {
  messages: { role: 'user' | 'model'; text: string }[]
  session_id?: string
  visitorToken?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ChatRequest

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json({ error: 'پیامی ارسال نشده' }, { status: 400 })
    }

    // ── 1. Session management ─────────────────────────────────────────────────
    const sessionId = await getOrCreateSession(body.session_id, body.visitorToken)

    // ── 2. Persist user message ───────────────────────────────────────────────
    const lastUserMsg = body.messages.findLast((m) => m.role === 'user')
    if (lastUserMsg) {
      await db.insert(chatMessages).values({
        sessionId,
        role: 'user',
        content: lastUserMsg.text,
      })
    }

    // ── 3. Build context and call AI ─────────────────────────────────────────
    const { catalogContext, mentionedContext } = await getProductContext(lastUserMsg?.text ?? '')
    const systemPrompt = buildSystemPrompt(catalogContext, mentionedContext)
    const reply = await chat(body.messages, systemPrompt)

    // ── 4. Persist assistant response ─────────────────────────────────────────
    await db.insert(chatMessages).values({
      sessionId,
      role: 'assistant',
      content: reply,
    })

    // ── 5. Detect lead (phone number) ─────────────────────────────────────────
    const lastUserText = lastUserMsg?.text ?? ''
    const phoneMatch = lastUserText.match(/(\+98|0)?9\d{9}/)
    const leadCaptured = !!phoneMatch && reply.includes('✅')

    return NextResponse.json({
      message: reply,
      session_id: sessionId,
      leadCaptured,
      phone: leadCaptured ? phoneMatch![0] : undefined,
    })
  } catch (err) {
    console.error('[chat]', err)
    return NextResponse.json(
      { error: 'سرویس مشاوره موقتاً در دسترس نیست. لطفاً با شماره مستقیم تماس بگیرید.' },
      { status: 500 },
    )
  }
}
