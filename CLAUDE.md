# Beewaz Web — Project Memory

این فایل حافظه بلند‌مدت پروژه است. Claude Code آن را در شروع هر session می‌خواند.

---

## مشخصات پروژه

- **نام:** Beewaz Web (`beewaz-web`)
- **مسیر:** `C:\Users\user\Music\beewaz-web`
- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + NextAuth v5 + Prisma + PostgreSQL
- **جهت:** RTL (فارسی) — همه اعداد باید با `toFaDigits()` نمایش داده شوند
- **GitHub:** `https://github.com/ahmadi98ir/beewaz`

---

## ⛔ قوانین لمس‌نکردنی

> **هرگز بدون دستور صریح کاربر این فایل‌ها را تغییر نده:**

### `.github/workflows/deploy.yml`
- workflow مسیر build/publish را انجام می‌دهد: push به `main` ← GitHub Actions ← build standalone Docker image ← push به GHCR (`ghcr.io/ahmadi98ir/beewaz-web:latest` و SHA tag).
- R2/deploy-cache می‌تواند به‌عنوان artifact/cache باقی بماند، اما production activation دیگر به R2 وابسته نیست.
- اگر production به build جدید سوییچ نکرد، اول bridge سمت سرور (`beewaz-autodeploy.timer` و لاگ‌های آن) بررسی شود.
- credential یا endpoint خصوصی hard-coded به workflow اضافه نشود.

### قانون merge
- کدها روی branch توسعه داده می‌شوند.
- برای دیپلوی باید به `main` merge شود.
- workflow فقط روی `main` اجرا می‌شود.
- merge فقط بعد از review/validation همان تغییر انجام شود.

---

## سرور و دیپلوی

| مورد | مقدار |
|------|-------|
| پنل استقرار | Coolify |
| FQDN سایت | `https://beewaz.ir` |
| Production selector | Docker labels: `coolify.projectName=beewaz` + `coolify.environmentName=production` |
| Source image | `ghcr.io/ahmadi98ir/beewaz-web:latest` |

### فرآیند دیپلوی

1. **Push به `main`** → GitHub Actions اپ را build می‌کند و Docker image را به GHCR با tagهای `latest` و commit SHA push می‌کند.
2. `beewaz-autodeploy.timer` روی production هر ۲ دقیقه `/opt/beewaz-autodeploy.sh` را اجرا می‌کند.
3. اسکریپت `ghcr.io/ahmadi98ir/beewaz-web:latest` را `docker pull` می‌کند.
4. container production را از Docker/Coolify labels به‌صورت پویا پیدا می‌کند؛ UUID یا generated container name در repo hard-code نمی‌شود.
5. اگر Image ID جدید با Image ID درحال اجرا یکی باشد، هیچ کاری انجام نمی‌شود.
6. اگر image جدید باشد، image قبلی با tag محلی `beewaz-rollback:previous` نگهداری می‌شود، سپس image جدید با image-name مورد انتظار Compose tag می‌شود.
7. فقط همان service با `--pull never --no-deps --force-recreate` recreate می‌شود.
8. local HTTP health check روی container جدید باید پاس شود؛ در غیر این صورت image قبلی restore و service rollback می‌شود.

### چرا R2 دیگر activation source نیست

روی production، DNS مربوط به `*.r2.dev` قابل اتکا نیست و resolution timeout دیده شده است. در مقابل GHCR از همان سرور با موفقیت pull می‌شود. بنابراین production activation مستقیماً از GHCR انجام می‌شود و R2 فقط در صورت نیاز می‌تواند artifact/cache workflow باقی بماند.

سرویس‌های مرتبط روی سرور:
- `/opt/beewaz-autodeploy.sh`
- `beewaz-autodeploy.service` (oneshot)
- `beewaz-autodeploy.timer` (هر ۲ دقیقه)

### امنیت deployment
- هیچ token/password/private key نباید در repo، مستندات، shell script یا log commit شود.
- credentialهای production فقط در secret store یا root-owned env/config خارج از repo نگهداری شوند.
- اگر credential در git history یا chat/log آشکار شد، compromised فرض و rotate شود.
- bridge فعلی برای pull از public GHCR image به bearer token اختصاصی در script نیاز ندارد.
- rollback image قبل از هر activation با tag محلی `beewaz-rollback:previous` نگهداری می‌شود.

### بررسی وضعیت deployment

```bash
systemctl status beewaz-autodeploy.timer --no-pager
systemctl status beewaz-autodeploy.service --no-pager
journalctl -u beewaz-autodeploy.service -n 200 --no-pager
docker image inspect ghcr.io/ahmadi98ir/beewaz-web:latest --format '{{.Id}}'
```

---

## معماری

### احراز هویت (NextAuth v5)
- OTP-based با SMS از `api.sms.ir`
- جدول `phone_otps` در PostgreSQL
- Session: JWT | Provider: `credentials` (phone + otp)
- Server-side: `auth()` | Client-side: `useSession()`
- بعد از ورود: **`window.location.href`** (نه `router.push`) تا cookie درست set شود

### قیمت‌ها
- DB: **ریال** | نمایش: **تومان**
- فرمول: `Math.floor(rial / 10).toLocaleString('fa-IR') + ' تومان'`
- تابع: `formatPrice(rial)` در `src/lib/utils.ts`
- آستانه ارسال رایگان: **۲٬۰۰۰٬۰۰۰ ریال** | هزینه ارسال: **۱۵۰٬۰۰۰ ریال**

### سبد خرید شناور
- Zustand store (`src/stores/cart`) — persist فقط `items` به localStorage
- FloatingCart: پنل از **سمت چپ** (`left-0`، `-translate-x-full`)
- باز کردن: `openCart()` از store

---

## فایل‌های کلیدی

| فایل | توضیح |
|------|-------|
| `src/lib/utils.ts` | `formatPrice`, `toFaDigits`, `toEnDigits`, `formatToman` |
| `src/stores/cart.ts` | Zustand cart store |
| `src/app/login/login-form.tsx` | فرم OTP دو مرحله‌ای |
| `src/app/profile/page.tsx` | پروفایل + باشگاه مشتریان (loyalty tiers) |
| `src/app/profile/complete/page.tsx` | تکمیل ثبت‌نام (first-time users) |
| `src/app/checkout/checkout-client.tsx` | تکمیل خرید با آدرس ساختاریافته |
| `src/app/api/orders/route.ts` | API ثبت سفارش + Zod validation |
| `src/components/layout/floating-cart.tsx` | سبد خرید شناور (left-side) |
| `src/components/layout/header/user-button.tsx` | دکمه پروفایل/ورود در هدر |
| `src/components/layout/header/cart-button.tsx` | دکمه سبد → openCart |
| `src/app/layout.tsx` | Root layout با AppSessionProvider + FloatingCart |

---

## ساختار آدرس checkout

```
استان | شهر | خیابان اصلی | خیابان فرعی (اختیاری) | پلاک | واحد (اختیاری) | کد پستی (۱۰ رقم)
```
- شماره موبایل از **session** می‌آید (نه ورودی کاربر)
- کد پستی: `toEnDigits()` قبل از validation (قبول هر دو فارسی و لاتین)

---

## مشکلات رفع‌شده

1. **OTP redirect loop:** `window.location.href` به جای `router.push`
2. **جدول phone_otps:** با post-deployment Node.js script ساخته می‌شود
3. **DNS بلاک api.sms.ir:** hardcode در `/etc/hosts` سرور
4. **قیمت‌ها:** همه به تومان کامل (بدون اختصار)
5. **سبد شناور:** از راست به **چپ** منتقل شد
6. **آدرس checkout:** از یک textarea به ۶ فیلد ساختاریافته
7. **شماره تلفن تکراری در checkout:** حذف — از session می‌آید
8. **اعداد فارسی:** همه اعداد نمایشی با `toFaDigits()` یا `toLocaleString('fa-IR')`
9. **چت‌بات محصولات جدید را نمی‌دید:** `getProductContext()` بر اساس `isFeatured` مرتب می‌شد نه تاریخ — به `orderBy(desc(createdAt))` با `limit(30)` تغییر کرد
10. **auto-deploy production:** bridge قدیمی با R2/UUIDهای stale کنار گذاشته شد؛ activation اکنون با pull مستقیم `ghcr.io/ahmadi98ir/beewaz-web:latest`، discovery پویا از Coolify labels، health check و rollback خودکار انجام می‌شود.

---

## قوانین توسعه

- همه اعداد نمایشی سایت **فارسی** باشند (`toFaDigits`)
- قیمت‌ها همیشه با `formatPrice(rial)` نمایش داده شوند
- هیچ‌وقت `router.push` بعد از login نه — از `window.location.href` استفاده کن
- آستانه ارسال رایگان در floating-cart و checkout باید **یکسان** باشند (۲٬۰۰۰٬۰۰۰ ریال)
