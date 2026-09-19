import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/gemini'
import { db } from '@/lib/db'
import { products, categories, productSpecs } from '@/lib/db/schema'
import { chatSessions, chatMessages } from '@/lib/db/schema/chat'
import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import {
  buildStructuredSpecComparison,
  canonicalizeSku,
  extractCartSignals,
  findLatestSingleMentionedProduct,
  hasCartPlanModificationIntent,
  isCartCommitIntent,
  isExplicitCartPurchaseIntent,
  findMentionedProducts,
  productAvailabilityLabel,
  type GroundedProduct,
} from '@/lib/chat/product-grounding'
import {
  assessSecurityCart,
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  isExplicitPanelOnlyRequest,
  securityCartGuardMessage,
  shouldEnforceSystemCompleteness,
  wiredZoneCapacityGuardMessage,
} from '@/lib/chat/security-system-builder'
import {
  applyPackageQuestionAnswer,
  buildDeterministicSecurityPackage,
  extractSecurityNeeds,
  isPackageRecommendationIntent,
  isPackageRequirementsUpdate,
  isSecurityPackageConversation,
  isUnknownPackageAnswer,
  type DeterministicPackageProduct,
} from '@/lib/chat/security-package-planner'

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
    const panelProducts = snapshots.filter((product) => (
      classifySecurityProduct({
        sku: product.sku,
        name: product.name,
        category: product.category,
        categorySlug: product.categorySlug,
        description: product.description,
      }) === 'panel'
    ))

    const detailProductIds = Array.from(new Set([
      ...mentioned.map((product) => product.id),
      ...panelProducts.map((product) => product.id),
    ]))

    let detailSpecs: ProductSpecSnapshot[] = []
    if (detailProductIds.length > 0) {
      detailSpecs = await db
        .select({
          productId: productSpecs.productId,
          key: productSpecs.keyFa,
          value: productSpecs.valueFa,
        })
        .from(productSpecs)
        .where(inArray(productSpecs.productId, detailProductIds))
        .orderBy(productSpecs.sortOrder)
    }

    const mentionedSpecs = detailSpecs.filter((spec) => (
      mentioned.some((product) => product.id === spec.productId)
    ))
    const panelSpecs = detailSpecs.filter((spec) => (
      panelProducts.some((product) => product.id === spec.productId)
    ))

    const structuredComparison = buildStructuredSpecComparison(mentioned, mentionedSpecs)
    const panelCapacityLines = panelProducts.map((product) => {
      const capacity = getPanelWiredZoneCapacity({
        sku: product.sku,
        name: product.name,
        category: product.category,
        categorySlug: product.categorySlug,
        description: product.description,
        specs: panelSpecs
          .filter((spec) => spec.productId === product.id)
          .map((spec) => ({ key: spec.key, value: spec.value })),
      })

      return capacity === null
        ? `- ${product.sku}: ظرفیت زون سیمی ساختاریافته ثبت نشده است.`
        : `- ${product.sku}: ${capacity} زون سیمی ثبت‌شده.`
    })

    return {
      catalogContext: [
        'کاتالوگ فعلی فروشگاه (دادهٔ مستقیم از دیتابیس همین سایت):',
        ...snapshots.map(productFactLine),
        '',
        'خلاصه قطعی ظرفیت پنل‌های مرکزی:',
        ...(panelCapacityLines.length > 0
          ? panelCapacityLines
          : ['ظرفیت زون سیمی پنل فعالی ثبت نشده است.']),
        '',
        'مشخصات فنی پنل‌های مرکزی قابل پیشنهاد:',
        ...(panelProducts.length > 0
          ? panelProducts.map((product) => productDetailBlock(product, panelSpecs))
          : ['پنل مرکزی فعالی برای مقایسه پیدا نشد.']),
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
  cartPlanContext: string,
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
- اگر اطلاعات لازم برای انتخاب قطعی کم است، فقط یک سؤال ساده و تعیین‌کننده بپرس؛ چند سؤال پشت‌سرهم نپرس.
- هرگز تعداد در، پنجره، اتاق، حسگر یا نقطه حفاظتی را از خودت نساز. اگر مشتری نمی‌داند، یا فقط یک سؤال ساده بپرس، یا یک «پکیج پایه» با فرض صریح پیشنهاد بده و روشن بگو این فرض جای بازدید/شمارش واقعی را نمی‌گیرد.
- در پیشنهاد نهایی، دقیقاً توضیح بده کدام نیاز کاربر به کدام مشخصهٔ ثبت‌شده وصل شده است؛ از «بهتر/حرفه‌ای‌تر/پیشرفته‌تر» بدون معیار مشخص استفاده نکن.
- اگر کاربر می‌گوید «اونی که بهتره»، «بهتر» را مطلق تفسیر نکن. فقط مدلی را انتخاب کن که برای نیازهای همین مشتری با یک یا چند تفاوت مستند مناسب‌تر باشد و همان معیارها را نام ببر.
- اگر انتخاب پنل به تعداد حسگرهای سیمی مربوط است، تعداد نقاط سیمی را صریح جمع بزن و ظرفیت زون سیمی هر پنل را با عدد ثبت‌شده مقایسه کن؛ از عبارت کلی «امکانات بیشتری دارد» به‌جای این استدلال استفاده نکن.
- قبل از نهایی‌کردن پنل، نوع اتصال سنسورهای پیشنهادی (سیمی/بی‌سیم) را با ظرفیت زون‌های ثبت‌شده پنل تطبیق بده. اگر تعداد حسگرهای سیمی از تعداد زون‌های سیمی بیشتر است، بدون توضیح درباره طراحی زون/گروه‌بندی یا جایگزین بی‌سیم ادعای «کامل و آماده نصب» نکن.
- متراژ خانه به‌تنهایی برای انتخاب پنل کافی نیست. برای کاربر مبتدی اول فقط تعداد درها و پنجره‌های قابل‌دسترسی را بپرس. سؤال سیمی/بی‌سیم را فقط وقتی واقعاً برای انتخاب نهایی لازم است مطرح کن؛ اصطلاح «زون» را تا وقتی مشتری فنی نپرسیده وارد مکالمه نکن.
- موجودی عددی دقیق انبار را فقط وقتی مشتری مشخصاً درباره تعداد موجودی پرسید بیان کن؛ در حالت عادی فقط «موجود» یا «ناموجود» بگو.

نقش متخصص طراحی سیستم:
- تو فقط «فروشنده یک دستگاه» نیستی؛ برای مشتری مبتدی باید یک سیستم حفاظتی کامل طراحی کنی.
- پنل مرکزی به‌تنهایی سیستم دزدگیر کامل نیست. برای یک راهکار حفاظتی واقعی باید لایه‌های لازم را بررسی کنی: پنل مرکزی، حسگرهای تشخیص نفوذ، حفاظت در/پنجره در صورت نیاز، هشدار صوتی محلی در صورت نیاز، و اقلام کنترلی/تغذیه/آنتن فقط وقتی نیاز یا سازگاری آن‌ها از داده محصول مشخص است.
- برای حسگرها، تعداد را از نقاط حفاظتی تعیین کن نه فقط متراژ: هر در/پنجره‌ای که قرار است حفاظت شود معمولاً به یک مگنت مستقل نیاز دارد و چشمی حرکتی باید بر اساس فضاهای اصلی/مسیرهای عبور انتخاب شود.
- وقتی مشتری می‌گوید «هیچی از دزدگیر سر درنمیارم»، مسئولیت تصمیم‌سازی با توست: با زبان خیلی ساده راهنمایی کن، گزینه‌های اضافی را کم کن و او را مجبور نکن اسم قطعه، نوع زون یا اصطلاح فنی را از قبل بداند.
- اگر مشتری درباره سیمی/بی‌سیم مطمئن نیست، سؤال را خشک و فنی تکرار نکن. اول با یک توضیح کوتاه بگو چرا این انتخاب مهم است و اگر از اطلاعات فعلی بتوانی یک ترکیب ایمن و مستند پیشنهاد بدهی، خودت پیشنهاد مشخص بده.
- از کاربر اطلاعاتی را که همین چند پیام قبل گفته دوباره نپرس مگر اینکه واقعاً متناقض یا مبهم شده باشد.
- در پیشنهاد نهایی، اقلام را در سه گروه ذهنی مدیریت کن: «ضروری برای کارکرد سیستم»، «پیشنهادی برای پوشش بهتر»، «اختیاری/وابسته به شرایط». این تفکیک را در صورت نیاز به زبان ساده برای مشتری بگو.
- هرگز یک پنل تنها را به‌عنوان «سیستم کامل» معرفی یا برای یک درخواست سیستم کامل به‌تنهایی به سبد اضافه نکن.
- اگر تعداد دقیق سنسورها هنوز معلوم نیست، قبل از افزودن نهایی به سبد سؤال کوتاه لازم را بپرس یا یک «پکیج پایه با فرض مشخص» ارائه کن و فرض را صریح بگو.
- سازگاری محصول را حدس نزن. اگر از داده‌های محصول نتوانستی بفهمی یک آژیر/منبع تغذیه/آنتن برای پنل لازم یا سازگار است، آن را خودسرانه به سبد اضافه نکن و فقط بگو نیاز به تأیید دارد.

اقدام خرید و سبد:
- تصمیم واقعی افزودن به سبد توسط backend قطعی سایت انجام می‌شود، نه با متن آزاد تو.
- هیچ marker، فرمان داخلی، JSON، BEE_CART_PLAN یا BEE_CART_ADD در پاسخ تولید نکن.
- اگر مشتری گفت محصول/پکیج را بخرد، طبیعی و کوتاه جواب بده؛ backend خودش اقدام معتبر را انجام می‌دهد.
- هیچ‌وقت ادعای «به سبد اضافه شد» نکن مگر اینکه context ساختاریافتهٔ همین درخواست صراحتاً بگوید اقدام خرید انجام شده است.
- برای پیشنهاد عادی فقط محصول و دلیل را واضح بگو؛ هیچ متن ماشینی یا دستور داخلی ننویس.

وضعیت فعلی سبد خرید مشتری:
${cartContext}

پیشنهاد خرید فعلی که در turn قبلی به‌صورت ساختاریافته نگه داشته شده:
${cartPlanContext}

قواعد سبد فعلی:
- فرض نکن سبد خالی است.
- اگر سبد فعلی پنل دیگری دارد و مشتری فقط می‌گوید «این پکیج را اضافه کن»، به او بگو محصول قبلی در سبد باقی می‌ماند مگر اینکه خودش درخواست جایگزینی/حذف بدهد.
- فعلاً cart action فقط افزودن انجام می‌دهد؛ درباره حذف یا جایگزینی ادعای انجام‌شدن نکن.

سبک پاسخ:
- لحن BEE باید گرم، صمیمیِ حرفه‌ای، مطمئن و مشتری‌پسند باشد؛ مثل یک کارشناس فروش خوش‌برخورد ایرانی، نه یک فرم اداری یا ربات خشک.
- فارسی طبیعی و محاوره‌ایِ محترمانه استفاده کن. به‌جای «لطفاً اطلاعات را اعلام کنید» بگو «فقط تعداد در و پنجره رو بهم بگو، بقیه‌ش با من». از «نگران نباشید» و لحن بالا به پایین هم استفاده نکن.
- برای مشتری مبتدی، اول نتیجه و پیشنهاد روشن را بگو و بعد دلیل کوتاه بده. پاسخ عادی حداکثر ۴ تا ۶ خط کوتاه باشد؛ تیترهای رسمی، توضیح آموزشی طولانی و جمع‌بندی تکراری نده مگر مشتری خودش جزئیات بخواهد.
- در هر نوبت حداکثر یک سؤال بپرس.
- اگر مشتری گفت «خودت انتخاب کن»، دوباره تصمیم را به خودش پاس نده؛ بر اساس داده قطعی موجود بهترین ترکیب متناسب با اطلاعات فعلی را پیشنهاد بده و فقط اگر یک داده واقعاً حیاتی کم است همان یک مورد را بپرس.
- اگر عددی را از حرف مشتری استخراج کردی، قبل از پاسخ جمع و تطبیقش را چک کن؛ مثلاً ۶ پنجره + ۲ در = ۸ مگنت، نه عدد دیگری.
- هیچ‌وقت درباره تعداد زون، سیمی/بی‌سیم یا قابلیت پنل عبارتی مثل «چندین سنسور را کنترل می‌کند» ننویس مگر اینکه همان ادعا مستقیماً از مشخصات ساختاریافتهٔ دیتابیس پشتیبانی شود.
- جمله‌های کوتاه، روشن و روان بنویس و از تکرار سؤال یا عبارت‌های بوروکراتیک دوری کن.
- به‌جای «امکان انجام وجود ندارد» یا «ترکیب ناقص است» تا جای ممکن بگو «یه نکته مهم قبل از خرید داریم» و سریع راه‌حل بعدی را پیشنهاد بده.
- وقتی مشتری آماده خرید است، بی‌دلیل او را بین تأییدهای پشت‌سرهم نگه ندار؛ اگر اطلاعات لازم کامل است، اقدام را انجام بده و نتیجه را شفاف بگو.
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
  const safeVisitorToken = visitorToken?.trim().slice(0, 100)

  // Never accept a browser-supplied session UUID by itself. Once we use the
  // persisted transcript as canonical context, ownership must be tied to the
  // same anonymous visitor token that created the session.
  if (sessionId && safeVisitorToken) {
    const [existing] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.visitorToken, safeVisitorToken),
      ))
      .limit(1)
    if (existing) return existing.id
  }

  const [created] = await db
    .insert(chatSessions)
    .values({
      visitorToken: safeVisitorToken ?? null,
      status: 'active',
    })
    .returning({ id: chatSessions.id })

  return created!.id
}

function normalizeDecimalDigits(text: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  return Array.from(text).map((char) => {
    const p = persian.indexOf(char)
    if (p >= 0) return String(p)
    const a = arabic.indexOf(char)
    if (a >= 0) return String(a)
    return char
  }).join('')
}

function extractIranMobile(text: string): string | null {
  const normalized = normalizeDecimalDigits(text).replace(/[\s()-]/g, '')
  const match = normalized.match(/(?:\+98|0098|0)?9\d{9}/)
  if (!match) return null

  const raw = match[0]
  if (raw.startsWith('+98')) return '0' + raw.slice(3)
  if (raw.startsWith('0098')) return '0' + raw.slice(4)
  if (raw.startsWith('9')) return '0' + raw
  return raw
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface ChatRequest {
  messages: { role: 'user' | 'model'; text: string }[]
  session_id?: string
  visitorToken?: string
  request_id?: string
  cart?: Array<{
    sku: string
    nameFa: string
    quantity: number
  }>
  // Legacy clients may still send this during a rolling deployment. The server
  // treats persisted assistant metadata as the primary source of plan state.
  cartPlan?: Array<{
    sku: string
    quantity: number
  }>
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ChatRequest

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json({ error: 'پیامی ارسال نشده' }, { status: 400 })
    }

    const lastUserMsg = body.messages.findLast((message) => message.role === 'user')
    if (!lastUserMsg?.text?.trim()) {
      return NextResponse.json({ error: 'پیامی ارسال نشده' }, { status: 400 })
    }

    const requestId = body.request_id?.trim().slice(0, 100) || undefined

    // ── 1. Session management ───────────────────────────────────────────────
    const sessionId = await getOrCreateSession(body.session_id, body.visitorToken)

    // ── 2. Persist current user turn ────────────────────────────────────────
    await db.insert(chatMessages).values({
      sessionId,
      role: 'user',
      content: lastUserMsg.text.trim(),
      metadata: requestId ? { requestId } : undefined,
    })

    // The database transcript is canonical. This survives refreshes and avoids
    // trusting a client-provided copy of previous assistant messages.
    const persistedDesc = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        metadata: chatMessages.metadata,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(40)

    const persistedMessages = persistedDesc.reverse()
    const canonicalMessages = persistedMessages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role === 'user' ? 'user' as const : 'model' as const,
        text: message.content,
      }))

    const userTexts = canonicalMessages
      .filter((message) => message.role === 'user')
      .map((message) => message.text)

    const recentUserContext = userTexts.slice(-4).join('\n')
    const systemIntentContext = userTexts.slice(-12).join('\n')

    const latestSalesMessage = [...persistedMessages]
      .reverse()
      .find((message) => (
        message.role === 'assistant'
        && (
          message.metadata?.packageMode === 'security_system'
          || (message.metadata?.cartPlan?.length ?? 0) > 0
        )
      ))
    const latestSalesState = latestSalesMessage?.metadata ?? null

    // ── 3. Load authoritative catalog context ───────────────────────────────
    const { catalogContext, mentionedContext, products: catalogProducts } =
      await getProductContext(recentUserContext)

    const currentCart = Array.isArray(body.cart) ? body.cart.slice(0, 50) : []
    const cartContext = currentCart.length > 0
      ? currentCart
          .map((item) => `- ${item.sku} | ${item.nameFa} | تعداد: ${Math.max(1, item.quantity || 1)}`)
          .join('\n')
      : '- سبد خرید فعلاً خالی است.'

    const latestUserText = lastUserMsg.text.trim()
    const enforceCompleteness = (
      !isExplicitPanelOnlyRequest(latestUserText)
      && shouldEnforceSystemCompleteness(systemIntentContext)
    )

    type ValidatedSelection = { product: ProductSnapshot; quantity: number }

    const validateCartSelectionItems = (
      items: readonly { sku: string; quantity: number }[],
    ): ValidatedSelection[] => {
      if (items.length === 0) return []

      const selections: ValidatedSelection[] = []
      const seen = new Set<string>()

      for (const item of items) {
        const sku = canonicalizeSku(item.sku)
        const quantity = Number(item.quantity)

        // Never silently clamp a proposed quantity. A package is either still
        // exactly purchasable or it must be rebuilt against current stock.
        if (
          !sku
          || seen.has(sku)
          || !Number.isInteger(quantity)
          || quantity < 1
          || quantity > 20
        ) {
          return []
        }

        const product = catalogProducts.find(
          (candidate) => canonicalizeSku(candidate.sku) === sku,
        )
        if (
          !product
          || product.status !== 'active'
          || product.stock < quantity
        ) {
          return []
        }

        seen.add(sku)
        selections.push({ product, quantity })
      }

      return selections
    }

    const assessValidatedSelections = async (selections: ValidatedSelection[]) => {
      let specs: ProductSpecSnapshot[] = []
      if (selections.length > 0) {
        specs = await db
          .select({
            productId: productSpecs.productId,
            key: productSpecs.keyFa,
            value: productSpecs.valueFa,
          })
          .from(productSpecs)
          .where(inArray(
            productSpecs.productId,
            selections.map(({ product }) => product.id),
          ))
          .orderBy(productSpecs.sortOrder)
      }

      const assessed = selections.map(({ product, quantity }) => ({
        sku: product.sku,
        name: product.name,
        category: product.category,
        categorySlug: product.categorySlug,
        description: product.description,
        specs: specs
          .filter((spec) => spec.productId === product.id)
          .map((spec) => ({ key: spec.key, value: spec.value })),
        quantity,
      }))

      const assessment = assessSecurityCart(assessed)
      const completenessGuard = enforceCompleteness
        ? securityCartGuardMessage(assessment)
        : null
      const capacityGuard = enforceCompleteness && !completenessGuard
        ? wiredZoneCapacityGuardMessage(assessed)
        : null

      return {
        assessed,
        guard: completenessGuard ?? capacityGuard,
        capacityGuard,
      }
    }

    const legacyPlanItems = Array.isArray(body.cartPlan)
      ? body.cartPlan.slice(0, 50)
      : []
    const currentPlanItems = latestSalesState?.cartPlan?.length
      ? latestSalesState.cartPlan.slice(0, 50)
      : latestSalesState
        ? []
        : legacyPlanItems

    const currentPlanSelections = validateCartSelectionItems(currentPlanItems)
    const currentPlanAssessment = currentPlanSelections.length > 0
      ? await assessValidatedSelections(currentPlanSelections)
      : { guard: null as string | null, capacityGuard: null as string | null }
    const currentPlanReady = (
      currentPlanSelections.length === currentPlanItems.length
      && currentPlanSelections.length > 0
      && !currentPlanAssessment.guard
    )

    const cartPlanContext = currentPlanReady
      ? currentPlanSelections
          .map(({ product, quantity }) => `- ${product.sku} | ${product.name} | تعداد: ${quantity}`)
          .join('\n')
      : '- پیشنهاد ساختاریافتهٔ معتبر و آماده خرید از turn قبلی نداریم.'

    const plainPlanApproval = (
      currentPlanReady
      && isCartCommitIntent(latestUserText)
      && !hasCartPlanModificationIntent(latestUserText)
    )

    const approvalAgainstStalePlan = (
      currentPlanItems.length > 0
      && !currentPlanReady
      && isCartCommitIntent(latestUserText)
      && !hasCartPlanModificationIntent(latestUserText)
    )

    // A validated persisted plan is the only source for terse approvals such as
    // «باشه» or «اوکی». The LLM is not called and cannot rewrite the package.
    if (plainPlanApproval) {
      const reply = 'حتماً 👌 همون ترکیب تأییدشده رو دقیقاً به سبد خرید اضافه کردم.'
      const cartActionId = requestId ?? `cart-${sessionId}-${Date.now()}`
      const cartActionItems = currentPlanSelections.map(({ product, quantity }) => ({
        sku: product.sku,
        quantity,
      }))
      const cartItems = currentPlanSelections.map(({ product, quantity }) => ({
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

      await db.insert(chatMessages).values({
        sessionId,
        role: 'assistant',
        content: reply,
        metadata: {
          requestId,
          cartActionId,
          cartActionItems,
          cartPlan: [],
          packageMode: latestSalesState?.packageMode,
          packageNeeds: latestSalesState?.packageNeeds,
        },
      })

      return NextResponse.json({
        message: reply,
        session_id: sessionId,
        cartItems,
        cartActionId,
        cartPlan: [],
        leadCaptured: false,
      })
    }


    // ── Deterministic package engine ─────────────────────────────────────────
    const pendingPackageQuestion = latestSalesState?.packageQuestionKey ?? null
    const previousPackageNeeds = latestSalesState?.packageNeeds ?? null

    let packageNeeds = extractSecurityNeeds(userTexts, previousPackageNeeds)
    const pendingAnswer = applyPackageQuestionAnswer(
      packageNeeds,
      pendingPackageQuestion,
      latestUserText,
    )
    if (pendingAnswer.handled) packageNeeds = pendingAnswer.needs

    let assumedMotionCoverage = false
    if (
      pendingPackageQuestion === 'motion_areas'
      && isUnknownPackageAnswer(latestUserText)
    ) {
      // The customer explicitly delegated the choice to BEE. We may offer a
      // clearly-labelled base package, but must not call the assumed coverage
      // a complete site design.
      packageNeeds = { ...packageNeeds, motionAreas: 1 }
      assumedMotionCoverage = true
    }

    const packageFlowActive = (
      (
        latestSalesState?.packageMode === 'security_system'
        || isSecurityPackageConversation(userTexts)
      )
      && (
        isPackageRecommendationIntent(latestUserText)
        || isPackageRequirementsUpdate(latestUserText)
        || isExplicitCartPurchaseIntent(latestUserText)
        || pendingAnswer.handled
        || (
          !!pendingPackageQuestion
          && isUnknownPackageAnswer(latestUserText)
        )
        || approvalAgainstStalePlan
      )
    )

    if (packageFlowActive) {
      let plannerSpecs: ProductSpecSnapshot[] = []
      if (catalogProducts.length > 0) {
        plannerSpecs = await db
          .select({
            productId: productSpecs.productId,
            key: productSpecs.keyFa,
            value: productSpecs.valueFa,
          })
          .from(productSpecs)
          .where(inArray(
            productSpecs.productId,
            catalogProducts.map((product) => product.id),
          ))
          .orderBy(productSpecs.sortOrder)
      }

      const plannerProducts: DeterministicPackageProduct[] = catalogProducts.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        stock: product.stock,
        status: product.status,
        category: product.category,
        categorySlug: product.categorySlug,
        description: product.description,
        specs: plannerSpecs
          .filter((spec) => spec.productId === product.id)
          .map((spec) => ({ key: spec.key, value: spec.value })),
      }))

      const packagePlan = buildDeterministicSecurityPackage(
        plannerProducts,
        packageNeeds,
      )

      if (packagePlan.status === 'needs_input') {
        await db.insert(chatMessages).values({
          sessionId,
          role: 'assistant',
          content: packagePlan.question,
          metadata: {
            requestId,
            packageMode: 'security_system',
            packageQuestionKey: packagePlan.questionKey,
            packageNeeds: packagePlan.needs,
            cartPlan: [],
          },
        })

        return NextResponse.json({
          message: packagePlan.question,
          session_id: sessionId,
          cartItems: [],
          cartPlan: [],
          leadCaptured: false,
        })
      }

      if (packagePlan.status === 'unsupported') {
        await db.insert(chatMessages).values({
          sessionId,
          role: 'assistant',
          content: packagePlan.message,
          metadata: {
            requestId,
            packageMode: 'security_system',
            packageNeeds: packagePlan.needs,
            cartPlan: [],
          },
        })

        return NextResponse.json({
          message: packagePlan.message,
          session_id: sessionId,
          cartItems: [],
          cartPlan: [],
          leadCaptured: false,
        })
      }

      const deterministicItems = packagePlan.items.map((item) => ({
        sku: item.product.sku,
        quantity: item.quantity,
      }))
      const deterministicSelections = validateCartSelectionItems(deterministicItems)
      const exactSelection = deterministicSelections.length === deterministicItems.length
      const deterministicAssessment = exactSelection
        ? await assessValidatedSelections(deterministicSelections)
        : { guard: 'موجودی یکی از اقلام این پکیج تغییر کرده و باید ترکیب را دوباره بسازم.' as string | null, capacityGuard: null as string | null }

      if (!exactSelection || deterministicAssessment.guard) {
        const message = deterministicAssessment.guard
          ?? 'موجودی یکی از اقلام این پکیج تغییر کرده و باید ترکیب را دوباره بسازم.'

        await db.insert(chatMessages).values({
          sessionId,
          role: 'assistant',
          content: message,
          metadata: {
            requestId,
            packageMode: 'security_system',
            packageNeeds: packagePlan.needs,
            cartPlan: [],
          },
        })

        return NextResponse.json({
          message,
          session_id: sessionId,
          cartItems: [],
          cartPlan: [],
          leadCaptured: false,
        })
      }

      const roleLabel = (product: DeterministicPackageProduct): string => {
        const role = classifySecurityProduct(product)
        if (role === 'panel') return 'پنل مرکزی'
        if (role === 'opening_sensor') return 'حفاظت در و پنجره'
        if (role === 'motion_sensor') return 'پوشش فضاهای اصلی'
        if (role === 'intrusion_sensor') return 'حسگر تشخیص نفوذ'
        return product.name
      }

      const designLabel = packagePlan.design === 'wireless'
        ? 'بی‌سیم'
        : packagePlan.design === 'hybrid'
          ? 'ترکیبی'
          : 'سیمی با زون‌های مستقل'

      const totalToman = Math.floor(packagePlan.totalPrice / 10).toLocaleString('fa-IR')
      const needsSummary = [
        packagePlan.needs.areaM2
          ? `${packagePlan.needs.areaM2.toLocaleString('fa-IR')} متر`
          : null,
        packagePlan.needs.windows !== null
          ? `${packagePlan.needs.windows.toLocaleString('fa-IR')} پنجره`
          : null,
        packagePlan.needs.doors !== null
          ? `${packagePlan.needs.doors.toLocaleString('fa-IR')} در ورودی`
          : null,
        packagePlan.needs.motionAreas !== null
          ? `${packagePlan.needs.motionAreas.toLocaleString('fa-IR')} فضای اصلی`
          : null,
      ].filter(Boolean).join('، ')

      const itemLines = packagePlan.items.map((item) => (
        `• ${item.product.sku} ×${item.quantity.toLocaleString('fa-IR')} — ${roleLabel(item.product)}`
      ))

      const capacityNotes: string[] = []
      if (
        packagePlan.wiredDetectorCount > 0
        && packagePlan.panelWiredCapacity !== null
      ) {
        capacityNotes.push(
          `${packagePlan.wiredDetectorCount.toLocaleString('fa-IR')} نقطه سیمی مستقل از ${packagePlan.panelWiredCapacity.toLocaleString('fa-IR')} زون سیمی پنل استفاده می‌کند`,
        )
      }
      if (
        packagePlan.wirelessDetectorCount > 0
        && packagePlan.panelWirelessCapacity !== null
      ) {
        capacityNotes.push(
          `${packagePlan.wirelessDetectorCount.toLocaleString('fa-IR')} حسگر بی‌سیم داخل ظرفیت ${packagePlan.panelWirelessCapacity.toLocaleString('fa-IR')} زون بی‌سیم پنل است`,
        )
      }

      const recommendation = [
        assumedMotionCoverage
          ? `با فرض پایهٔ یک فضای اصلی، برای ${needsSummary || 'نیاز فعلی'} این پکیج ${designLabel} رو پیشنهاد می‌دم:`
          : `برای ${needsSummary || 'نیاز فعلی'} این پکیج ${designLabel} رو پیشنهاد می‌دم:`,
        ...itemLines,
        ...(capacityNotes.length > 0
          ? [`کنترل ظرفیت: ${capacityNotes.join(' و ')}.`]
          : []),
        `جمع فعلی: حدود ${totalToman} تومان.`,
        approvalAgainstStalePlan
          ? 'ترکیب قبلی با موجودی فعلی قابل ثبت نبود؛ این نسخه به‌روز شده‌ست. اگر تأییدش می‌کنی دوباره بگو «بذار تو سبد».'
          : assumedMotionCoverage
            ? 'این یک پکیج پایه است؛ اگر فضای اصلی بیشتری داری تعداد چشمی‌ها رو قبل از خرید اصلاح می‌کنیم.'
            : 'اگر اوکیه بگو «بذار تو سبد»؛ همین ترکیب دقیق رو اضافه می‌کنم.',
      ].join('\n')

      const wantsImmediatePurchase = (
        isExplicitCartPurchaseIntent(latestUserText)
        && !assumedMotionCoverage
        && !approvalAgainstStalePlan
      )
      const cartActionId = wantsImmediatePurchase
        ? requestId ?? `cart-${sessionId}-${Date.now()}`
        : undefined
      const cartActionItems = wantsImmediatePurchase
        ? deterministicSelections.map(({ product, quantity }) => ({
            sku: product.sku,
            quantity,
          }))
        : undefined
      const cartItems = wantsImmediatePurchase
        ? deterministicSelections.map(({ product, quantity }) => ({
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
        : []

      const message = wantsImmediatePurchase
        ? 'حتماً 👌 همین پکیج تأییدشده رو با تعدادهای دقیق به سبد خرید اضافه کردم.'
        : recommendation
      const persistedPlan = wantsImmediatePurchase
        ? []
        : deterministicSelections.map(({ product, quantity }) => ({
            sku: product.sku,
            quantity,
          }))

      await db.insert(chatMessages).values({
        sessionId,
        role: 'assistant',
        content: message,
        metadata: {
          requestId,
          cartActionId,
          cartActionItems,
          cartPlan: persistedPlan,
          packageMode: 'security_system',
          packageNeeds: packagePlan.needs,
        },
      })

      return NextResponse.json({
        message,
        session_id: sessionId,
        cartItems,
        cartActionId,
        cartPlan: persistedPlan,
        leadCaptured: false,
      })
    }

    const systemPrompt = buildSystemPrompt(
      catalogContext,
      mentionedContext,
      cartContext,
      cartPlanContext,
    )
    const rawReply = await chat(body.messages, systemPrompt)
    const signals = extractCartSignals(rawReply)
    const cleanText = signals.cleanText

    const directCommitIntent = isExplicitCartPurchaseIntent(latestUserText)
    const inferredReplyItems = inferCartPlanFromAssistantText(cleanText, catalogProducts)
    const requestedCartItems = directCommitIntent
      ? mergeCartSelectionItems(
          signals.addItems,
          signals.planItems,
          inferredReplyItems,
        )
      : []

    let validatedSelections = validateCartSelectionItems(requestedCartItems)

    // Backwards-compatible recovery for direct buy requests where the model
    // mentions a single panel in the reply but accidentally omits it from ADD.
    if (enforceCompleteness && directCommitIntent && validatedSelections.length > 0) {
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
        const purchasablePanels = catalogProducts.filter((product) => (
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
        const recoveredPanel = findLatestSingleMentionedProduct(
          [
            cleanText,
            ...body.messages.slice(-10).reverse().map((message) => message.text),
          ],
          purchasablePanels,
        )
        if (recoveredPanel) {
          validatedSelections = [
            { product: recoveredPanel, quantity: 1 },
            ...validatedSelections,
          ]
        }
      }
    }

    const cartActionAttempted = directCommitIntent && validatedSelections.length > 0
    const actionAssessment = cartActionAttempted
      ? await assessValidatedSelections(validatedSelections)
      : { guard: null as string | null, capacityGuard: null as string | null }
    const cartGuard = actionAssessment.guard

    // Capture a structured proposal for the next turn. A rogue ADD marker on a
    // non-purchase turn is demoted to PLAN instead of mutating the browser cart.
    const proposedItems = !directCommitIntent
      ? mergeCartSelectionItems(
          signals.planItems,
          signals.addItems,
          inferredReplyItems,
        )
      : []
    const proposedSelections = validateCartSelectionItems(proposedItems)
    const proposalAssessment = proposedSelections.length > 0
      ? await assessValidatedSelections(proposedSelections)
      : { guard: null as string | null, capacityGuard: null as string | null }
    const proposalGuard = proposalAssessment.guard

    // Guards may block a real cart mutation, but they must never hijack an
    // ordinary recommendation turn. An invalid proposed plan is simply not
    // persisted; the customer still sees BEE's actual recommendation.
    const reply = cartGuard
      ? actionAssessment.capacityGuard
        ? `${cartGuard}\n\nاگر بخوای، ترکیب رو اصلاح می‌کنم تا با ظرفیت واقعی پنل و نوع حسگرها جور دربیاد و بعد یکجا وارد سبدش کنیم.`
        : `${cartGuard}\n\nفقط همون یک موردی که واقعاً برای خرید کمه رو مشخص می‌کنیم و بعد یکجا جمعش می‌کنم.`
      : cartActionAttempted
        ? `${cleanText}\n\n✅ موارد تأییدشده به سبد خرید اضافه شدند.`
        : cleanText

    const cartItems = !cartActionAttempted || cartGuard
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

    const cartPlan = cartActionAttempted
      ? []
      : proposalGuard
        ? []
        : proposedSelections.map(({ product, quantity }) => ({
            sku: product.sku,
            quantity,
          }))

    // ── 4. Persist assistant response ─────────────────────────────────────────
    await db.insert(chatMessages).values({
      sessionId,
      role: 'assistant',
      content: reply,
    })

    // ── 5. Detect lead (phone number) ─────────────────────────────────────────
    const phoneMatch = latestUserText.match(/(\+98|0)?9\d{9}/)
    const leadCaptured = !!phoneMatch && reply.includes('✅')

    return NextResponse.json({
      message: reply,
      session_id: sessionId,
      cartItems,
      cartPlan,
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
