import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { products, productImages, productVariants } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'
import { eq, and, isNull } from 'drizzle-orm'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const [product] = await db.select().from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
    if (!product) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })

    const images = await db.select().from(productImages)
      .where(eq(productImages.productId, id)).orderBy(productImages.sortOrder)

    const variants = await db.select().from(productVariants)
      .where(eq(productVariants.productId, id)).orderBy(productVariants.createdAt)
      .catch(() => [])

    return NextResponse.json({
      product: {
        id: product.id,
        slug: product.slug,
        name: product.nameFa,
        modelCode: product.sku,
        sku: product.sku,
        shortDescription: product.descriptionFa,
        description: product.descriptionFa,
        status: product.status,
        basePrice: String(product.price ?? 0),
        compareAtPrice: product.comparePrice ? String(product.comparePrice) : null,
        isFeatured: product.isFeatured,
        warrantyDays: product.warrantyDays,
        warrantyMonths: product.warrantyDays > 0 ? Math.round(product.warrantyDays / 30) : 24,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDesc,
        highlights: [],
        categoryId: product.categoryId,
        salePrice: product.salePrice ? String(product.salePrice) : null,
        salePriceFrom: product.salePriceFrom ?? null,
        salePriceTo: product.salePriceTo ?? null,
        relatedProductIds: (product.relatedProductIds as string[] | null) ?? [],
      },
      images,
      variants,
    })
  } catch (err) {
    console.error('[product GET]', err)
    return NextResponse.json({ error: 'خطا' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const body = await req.json() as Record<string, unknown>

    const update: Partial<typeof products.$inferInsert> = {}
    if (typeof body.nameFa === 'string')       update.nameFa       = body.nameFa
    if (typeof body.name === 'string')          update.nameFa       = body.name as string
    if (typeof body.slug === 'string')          update.slug         = body.slug as string
    if (typeof body.sku === 'string')           update.sku          = body.sku as string
    if (typeof body.descriptionFa === 'string') update.descriptionFa = body.descriptionFa
    if (typeof body.price === 'number')         update.price        = body.price as number
    if (typeof body.basePrice === 'number')     update.price        = body.basePrice as number
    if (typeof body.comparePrice === 'number')  update.comparePrice = body.comparePrice as number
    if (typeof body.stock === 'number')         update.stock        = body.stock as number
    if (typeof body.warrantyDays === 'number')  update.warrantyDays = body.warrantyDays as number
    if (typeof body.status === 'string')        update.status       = body.status as typeof products.$inferInsert['status']
    if (typeof body.isFeatured === 'boolean')   update.isFeatured   = body.isFeatured as boolean
    if (typeof body.categoryId === 'string')    update.categoryId   = body.categoryId as string
    if (typeof body.metaTitle === 'string')     update.metaTitle    = body.metaTitle
    if (typeof body.metaDesc === 'string')         update.metaDesc     = body.metaDesc
    if (typeof body.metaDescription === 'string') update.metaDesc     = body.metaDescription as string
    if (typeof body.description === 'string')     update.descriptionFa = body.description as string
    if (typeof body.shortDescription === 'string') update.descriptionFa = body.shortDescription as string
    if (typeof body.name === 'string')            update.nameFa        = body.name as string
    if (typeof body.modelCode === 'string')       update.sku           = body.modelCode as string
    if (typeof body.basePrice === 'string' && body.basePrice !== '') {
      const p = parseInt(body.basePrice as string)
      if (!isNaN(p)) update.price = p
    }
    if (typeof body.compareAtPrice === 'string') {
      const cp = parseInt(body.compareAtPrice as string)
      update.comparePrice = isNaN(cp) ? null : cp
    }
    if (typeof body.salePrice === 'number') update.salePrice = body.salePrice as number
    if (typeof body.salePrice === 'string') {
      const sp = parseInt(body.salePrice as string)
      update.salePrice = isNaN(sp) ? null : sp
    }
    if (body.salePriceFrom !== undefined) update.salePriceFrom = body.salePriceFrom ? new Date(body.salePriceFrom as string) : null
    if (body.salePriceTo !== undefined)   update.salePriceTo   = body.salePriceTo   ? new Date(body.salePriceTo as string) : null
    if (Array.isArray(body.relatedProductIds)) update.relatedProductIds = body.relatedProductIds as string[]

    const rows = await db.update(products).set(update).where(eq(products.id, id)).returning()
    const updated = rows[0]
    if (!updated) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
    return NextResponse.json({
      product: {
        id: updated.id,
        slug: updated.slug,
        name: updated.nameFa,
        modelCode: updated.sku,
        sku: updated.sku,
        shortDescription: updated.descriptionFa,
        description: updated.descriptionFa,
        status: updated.status,
        basePrice: String(updated.price ?? 0),
        compareAtPrice: updated.comparePrice ? String(updated.comparePrice) : null,
        isFeatured: updated.isFeatured,
        warrantyDays: updated.warrantyDays,
        warrantyMonths: updated.warrantyDays > 0 ? Math.round(updated.warrantyDays / 30) : 24,
        metaTitle: updated.metaTitle,
        metaDescription: updated.metaDesc,
        highlights: [],
        categoryId: updated.categoryId,
      }
    })
  } catch (err) {
    console.error('[product PUT]', err)
    return NextResponse.json({ error: 'خطا در ویرایش' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await db.update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[product DELETE]', err)
    return NextResponse.json({ error: 'خطا در حذف' }, { status: 500 })
  }
}
