import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/gemini'
import { db } from '@/lib/db'
import { products, categories, productSpecs } from '@/lib/db/schema'
import { chatSessions, chatMessages } from '@/lib/db/schema/chat'
import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import {
  buildStructuredSpecComparison,
  extractCartDirective,
  findMentionedProducts,
  productAvailabilityLabel,
  type GroundedProduct,
} from '@/lib/chat/product-grounding'
import {
  assessSecurityCart,
  classifySecurityProduct,
  securityCartGuardMessage,
  shouldEnforceSystemCompleteness,
} from '@/lib/chat/security-system-builder'

// ── Product context for system prompt ─────────────────────────────────────────

interface ProductSnapshot extends GroundedProduct {
  id: string
  slug: string
  description: string | null
  price: number
  comparePrice: number | null
  category: string | null
  categorySlug: string | null
  warrantyDays: number
}

interface ProductSpecSnapshot {
  productId: string
  key: string
  value: string
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

function productDetailBlock(
  product: ProductSnapshot,
  specs: readonly ProductSpecSnapshot[],
): string {
  const productSpecsForItem = specs.filter((spec) => spec.productId === product.id)
  const technicalFacts = productSpecsForItem.length > 0
    ? productSpecsForItem.map((spec) => `  • ${spec.key}: ${spec.value}`)
    : ['  • مشخصات فنی ساختاریافته‌ای برای این محصول در دیتابیس ثبت نشده است.']

  const description = product.description?.trim()
    ? product.description.trim().slice(0, 1200)
    : 'توضیحات تکمیلی ثبت نشده است.'

  return [
    productFactLine(product),
    `توضیحات ثبت‌شده: ${description}`,
    'مشخصات فنی ثبت‌شده:',
    ...technicalFacts,
  ].join('\n')
}

async function getProductContext(lastUserText: string): Promise<{
  catalogContext: string
  mentionedContext: string
  products: ProductSnapshot[]
}> {
  try {
    const rows = await db
      .select({
        id: products.id,
        name: products.nameFa,
        sku: products.sku,
        slug: products.slug,
        description: products.descriptionFa,
        price: products.price,
        comparePrice: products.comparePrice,
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
      id: row.id,
      name: row.name,
      sku: row.sku,
      slug: row.slug,
      description: row.description,
      price: row.price,
      comparePrice: row.comparePrice,
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
        products: [],
      }
    }

    const mentioned = findMentionedProducts(lastUserText, snapshots)

    let mentionedSpecs: ProductSpecSnapshot[] = []
    if (mentioned.length > 0) {
      mentionedSpecs = await db
        .select({
          productId: productSpecs.productId,
          key: productSpecs.keyFa,
          value: productSpecs.valueFa,
        })
        .from(productSpecs)
        .where(inArray(productSpecs.productId, mentioned.map((product) => product.id)))
        .orderBy(productSpecs.sortOrder)
    }

    const structuredComparison = buildStructuredSpecComparison(mentioned, mentionedSpecs)

    return {
      catalogContext: [
        'کاتالوگ فعلی فروشگاه (دادهٔ مستقیم از دیتابیس همین سایت):',
        ...snapshots.map(productFactLine),
      ].join('\n'),
      mentionedContext: mentioned.length > 0
        ? [
            'محصول/مدل‌هایی که در چند پیام اخیر مشتری تشخیص داده شدند:',
            ...mentioned.map((product) => productDetailBlock(product, mentionedSpecs)),
            ...(mentioned.length >= 2
              ? [
                  'تفاوت‌های ساختاریافته و قطعی بین مدل‌های اشاره‌شده:',
                  ...(structuredComparison.length > 0
                    ? structuredComparison
                    : ['- در product_specs تفاوت ساختاریافته‌ای ثبت نشده است.']),
                  'برای مقایسه بین مدل‌ها، این بخش مرجع اصلی است. توضیحات آزاد هر محصول را فقط برای همان محصول به‌کار ببر و رابطه بین دو مدل را وارونه یا استنباط نکن.',
                ]
              : []),
          ].join('\n\n')
        : '',
      products: snapshots,
    }
  } catch (error) {
    console.error('[chat] product context failed', error)
    return {
      catalogContext: 'دادهٔ محصولی از فروشگاه دریافت نشد؛ درباره موجودی یا قیمت حدس نزن.',
      mentionedContext: '',
      products: [],
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  catalogContext: string,
  mentionedContext: string,
  cartContext: string,
): string {
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
- اگر مشتری دو مدل را مقایسه کرد، «تفاوت‌های ساختاریافته و قطعی» مرجع اصلی پاسخ است و فقط همان تفاوت‌ها را با قیمت/موجودی قطعی ترکیب کن.
- رابطه‌های نسلی را معکوس نکن: اگر توضیح محصول A می‌گوید «A نسخه‌ای از B است»، حق نداری نتیجه بگیری «B نسخه‌ای از A است».
- توضیحات آزاد یک محصول را به محصول دیگر نسبت نده و از آن‌ها رابطه دوطرفه نساز.
- جمله‌های مبهمی مثل «این مدل پیشرفته‌تر است»، «امکانات بیشتری دارد» یا «نسخه ضعیف‌تر است» بدون شاهد مشخص از دیتابیس ممنوع است.
- اگر برای یک محور مقایسه داده کافی نداری، صریحاً بگو «برای این مورد اطلاعات کافی در دیتابیس ثبت نشده» و حدس نزن.
- اگر مشتری گفت «روی سایت هست/موجوده»، نگو اطلاعاتی درباره سایت نداری؛ تو دستیار خود beewaz.ir هستی. وضعیت همان محصول را از دادهٔ زیر توضیح بده.
- اگر دادهٔ محصول در دسترس نبود، صریح بگو امکان تأیید موجودی لحظه‌ای نداری و حدس نزن.
- اگر بخش «محصول‌های تشخیص‌داده‌شده» وجود دارد، حقایق آن بخش بر هر برداشت قبلی یا حدس اولویت دارند.
- اگر کاربر بعد از مقایسه می‌پرسد «خودت کدومو پیشنهاد میدی؟»، فقط با تکیه بر نیازهای گفته‌شده و تفاوت‌های مستند پیشنهاد بده.
- اگر اطلاعات لازم برای انتخاب قطعی کم است، به‌جای انتخاب سلیقه‌ای حداکثر دو سؤال تعیین‌کننده بپرس (مثلاً تعداد نقاط/زون موردنیاز، نیاز به نوع ارتباط خاص، یا محدودیت بودجه).
- در پیشنهاد نهایی، دقیقاً توضیح بده کدام نیاز کاربر به کدام مشخصهٔ ثبت‌شده وصل شده است؛ از «بهتر/حرفه‌ای‌تر/پیشرفته‌تر» بدون معیار مشخص استفاده نکن.
- اگر کاربر می‌گوید «اونی که بهتره»، «بهتر» را مطلق تفسیر نکن. فقط مدلی را انتخاب کن که برای نیازهای همین مشتری با یک یا چند تفاوت مستند مناسب‌تر باشد و همان معیارها را نام ببر.
- قبل از نهایی‌کردن پنل، نوع اتصال سنسورهای پیشنهادی (سیمی/بی‌سیم) را با ظرفیت زون‌های ثبت‌شده پنل تطبیق بده. اگر تعداد حسگرهای سیمی از تعداد زون‌های سیمی بیشتر است، بدون توضیح درباره طراحی زون/گروه‌بندی یا جایگزین بی‌سیم ادعای «کامل و آماده نصب» نکن.
- متراژ خانه به‌تنهایی برای انتخاب پنل کافی نیست. اگر کاربر مبتدی است، با زبان ساده از تعداد درهای ورودی، پنجره‌های قابل‌دسترسی، اتاق‌ها/فضاهای اصلی و ترجیح نصب سیمی/بی‌سیم کمک بگیر؛ اگر خودش نمی‌داند، توضیح بده هرکدام چه اثری در تعداد زون و سنسور دارد.
- موجودی عددی دقیق انبار را فقط وقتی مشتری مشخصاً درباره تعداد موجودی پرسید بیان کن؛ در حالت عادی فقط «موجود» یا «ناموجود» بگو.

نقش متخصص طراحی سیستم:
- تو فقط «فروشنده یک دستگاه» نیستی؛ برای مشتری مبتدی باید یک سیستم حفاظتی کامل طراحی کنی.
- پنل مرکزی به‌تنهایی سیستم دزدگیر کامل نیست. برای یک راهکار حفاظتی واقعی باید لایه‌های لازم را بررسی کنی: پنل مرکزی، حسگرهای تشخیص نفوذ، حفاظت در/پنجره در صورت نیاز، هشدار صوتی محلی در صورت نیاز، و اقلام کنترلی/تغذیه/آنتن فقط وقتی نیاز یا سازگاری آن‌ها از داده محصول مشخص است.
- برای حسگرها، تعداد را از نقاط حفاظتی تعیین کن نه فقط متراژ: هر در/پنجره‌ای که قرار است حفاظت شود معمولاً به یک مگنت مستقل نیاز دارد و چشمی حرکتی باید بر اساس فضاهای اصلی/مسیرهای عبور انتخاب شود.
- وقتی مشتری می‌گوید «هیچی از دزدگیر سر درنمیارم»، خودت ساختار را توضیح بده و او را مجبور نکن اسم قطعه یا نوع سنسور را از قبل بداند.
- در پیشنهاد نهایی، اقلام را در سه گروه ذهنی مدیریت کن: «ضروری برای کارکرد سیستم»، «پیشنهادی برای پوشش بهتر»، «اختیاری/وابسته به شرایط». این تفکیک را در صورت نیاز به زبان ساده برای مشتری بگو.
- هرگز یک پنل تنها را به‌عنوان «سیستم کامل» معرفی یا برای یک درخواست سیستم کامل به‌تنهایی به سبد اضافه نکن.
- اگر تعداد دقیق سنسورها هنوز معلوم نیست، قبل از افزودن نهایی به سبد سؤال کوتاه لازم را بپرس یا یک «پکیج پایه با فرض مشخص» ارائه کن و فرض را صریح بگو.
- سازگاری محصول را حدس نزن. اگر از داده‌های محصول نتوانستی بفهمی یک آژیر/منبع تغذیه/آنتن برای پنل لازم یا سازگار است، آن را خودسرانه به سبد اضافه نکن و فقط بگو نیاز به تأیید دارد.

اقدام سبد خرید:
- تو می‌توانی با درخواست صریح مشتری، محصول را به سبد خرید همین مرورگر اضافه کنی؛ دیگر نگو «نمی‌توانم مستقیم به سبد اضافه کنم».
- فقط وقتی آخرین پیام مشتری صریحاً درخواست افزودن/گذاشتن محصول در سبد خرید دارد، در پایان پاسخ یک خط مخفی با قالب دقیق [BEE_CART_ADD:SKU1*QTY,SKU2*QTY] اضافه کن.
- QTY تعداد واقعی پیشنهادی همان محصول است؛ مثلاً [BEE_CART_ADD:BH21*1,P100*2,MG10*3].
- داخل این marker فقط SKU دقیق محصولاتی را بگذار که در متن همان پاسخ صریحاً به‌عنوان ترکیب نهایی برای خرید لیست کرده‌ای و طبق کاتالوگ active و دارای stock>0 هستند.
- اگر مشتری یک سیستم کامل/پکیج حفاظتی می‌خواهد، marker نباید فقط شامل پنل باشد؛ حداقل باید حسگر تشخیص نفوذ مناسب هم در ترکیب نهایی وجود داشته باشد.
- اگر هنوز تعداد/نوع حسگر لازم مشخص نیست، marker نساز و اول سؤال کوتاه لازم را بپرس یا فرض پکیج پایه را صریحاً اعلام کن و تأیید بگیر.
- marker را برای توضیح، مقایسه، قیمت‌پرسیدن یا پیشنهاد عادی نساز.
- اگر یک «ترکیب نهایی خرید» را در متن می‌نویسی و cart action می‌سازی، marker باید همهٔ اقلام همان ترکیب نهایی را با همان تعداد شامل شود. حذف پنل یا یکی از اجزای اصلی از marker ممنوع است.

وضعیت فعلی سبد خرید مشتری:
${cartContext}

قواعد سبد فعلی:
- فرض نکن سبد خالی است.
- اگر سبد فعلی پنل دیگری دارد و مشتری فقط می‌گوید «این پکیج را اضافه کن»، به او بگو محصول قبلی در سبد باقی می‌ماند مگر اینکه خودش درخواست جایگزینی/حذف بدهد.
- فعلاً cart action فقط افزودن انجام می‌دهد؛ درباره حذف یا جایگزینی ادعای انجام‌شدن نکن.

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
  cart?: Array<{
    sku: string
    nameFa: string
    quantity: number
  }>
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
    // Keep product/spec grounding alive across short follow-up turns such as
    // «خودت کدومو پیشنهاد میدی؟» where the model names are omitted.
    const recentUserContext = body.messages
      .filter((message) => message.role === 'user')
      .slice(-4)
      .map((message) => message.text)
      .join('\n')
    const { catalogContext, mentionedContext, products: catalogProducts } =
      await getProductContext(recentUserContext)

    const currentCart = Array.isArray(body.cart) ? body.cart.slice(0, 50) : []
    const cartContext = currentCart.length > 0
      ? currentCart
          .map((item) => `- ${item.sku} | ${item.nameFa} | تعداد: ${Math.max(1, item.quantity || 1)}`)
          .join('\n')
      : '- سبد خرید فعلاً خالی است.'

    const systemPrompt = buildSystemPrompt(catalogContext, mentionedContext, cartContext)
    const rawReply = await chat(body.messages, systemPrompt)
    const { cleanText, items: requestedCartItems } = extractCartDirective(rawReply)

    let validatedSelections = requestedCartItems
      .map(({ sku, quantity }) => {
        const product = catalogProducts.find(
          (candidate) => candidate.sku.toUpperCase() === sku,
        )
        if (!product || product.status !== 'active' || product.stock <= 0) return null

        return {
          product,
          quantity: Math.min(quantity, product.stock, 20),
        }
      })
      .filter((selection): selection is { product: ProductSnapshot; quantity: number } => !!selection)

    const enforceCompleteness = shouldEnforceSystemCompleteness(recentUserContext)

    // LLMs occasionally list the chosen panel in the visible "final package"
    // but omit it from the hidden cart marker. For full-system intents, recover
    // exactly one explicitly mentioned in-stock panel from the same reply.
    if (enforceCompleteness) {
      const selectedHasPanel = validatedSelections.some(
        ({ product }) => classifySecurityProduct({
          sku: product.sku,
          name: product.name,
          category: product.category,
          categorySlug: product.categorySlug,
          description: product.description,
        }) === 'panel',
      )

      if (!selectedHasPanel) {
        const mentionedPanels = findMentionedProducts(cleanText, catalogProducts)
          .filter((product) => (
            product.status === 'active'
            && product.stock > 0
            && classifySecurityProduct({
              sku: product.sku,
              name: product.name,
              category: product.category,
              categorySlug: product.categorySlug,
              description: product.description,
            }) === 'panel'
          ))

        if (mentionedPanels.length === 1) {
          validatedSelections = [
            { product: mentionedPanels[0]!, quantity: 1 },
            ...validatedSelections,
          ]
        }
      }
    }

    const securityAssessment = assessSecurityCart(
      validatedSelections.map(({ product, quantity }) => ({
        sku: product.sku,
        name: product.name,
        category: product.category,
        categorySlug: product.categorySlug,
        description: product.description,
        quantity,
      })),
    )

    const cartGuard = enforceCompleteness
      ? securityCartGuardMessage(securityAssessment)
      : null

    const reply = cartGuard
      ? `${cartGuard}\n\nتعداد درهای ورودی، پنجره‌های قابل‌دسترسی و فضاهای اصلی رو بگو تا ترکیب کامل رو با تعداد درست سنسورها بچینم و یکجا به سبد اضافه کنم.`
      : cleanText

    const cartItems = cartGuard
      ? []
      : validatedSelections.map(({ product, quantity }) => ({
          id: product.id,
          slug: product.slug,
          categorySlug: product.categorySlug ?? 'products',
          nameFa: product.name,
          sku: product.sku,
          price: product.price,
          comparePrice: product.comparePrice ?? undefined,
          quantity,
          placeholderFrom: '#DBEAFE',
          placeholderTo: '#BFDBFE',
        }))

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
      cartItems,
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
