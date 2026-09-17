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
- workflow مسیر build و publish را انجام می‌دهد: push به `main` ← GitHub Actions ← build/push image به GHCR.
- production activation از `ghcr.io/ahmadi98ir/beewaz-web:latest` انجام می‌شود؛ R2 روی production host به‌دلیل DNS timeout قابل اتکا نیست.
- اگر production به build جدید سوییچ نکرد، ابتدا bridge سمت سرور (`beewaz-autodeploy.timer` و لاگ‌های آن) بررسی شود.
- از اضافه‌کردن credential یا endpoint خصوصی hard-coded به workflow خودداری شود.

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
| Source image | `ghcr.io/ahmadi98ir/beewaz-web:latest` |
| Production selector | Docker labels + Coolify application metadata |

### فرآیند دیپلوی

1. **Push به `main`** → GitHub Actions image را build و به GHCR منتشر می‌کند.
2. `beewaz-autodeploy.timer` روی production هر ۲ دقیقه اجرا می‌شود.
3. `/opt/beewaz-autodeploy.sh`، `ghcr.io/ahmadi98ir/beewaz-web:latest` را pull می‌کند.
4. Coolify برای app و database یکسان `coolify.projectName=beewaz` و `coolify.environmentName=production` می‌گذارد؛ بنابراین selector باید database را حذف کند و فقط containerی را بپذیرد که:
   - `coolify.applicationId` غیرخالی دارد، و
   - Compose workdir آن زیر `/data/coolify/applications/` است.
5. اگر بیش/کمتر از یک running application پیدا شود، deploy fail-closed می‌شود.
6. اگر pulled image ID با image درحال‌اجرا برابر باشد، deploy no-op است.
7. در image جدید، image قبلی با tag محلی `beewaz-rollback:previous` نگهداری می‌شود؛ image جدید به image-name مورد انتظار Compose tag می‌شود و فقط service Beewaz با `--pull never --no-deps --force-recreate` recreate می‌شود.
8. local HTTP health check باید پاس شود؛ در غیر این صورت image قبلی restore و service rollback می‌شود.

سرویس‌های مرتبط روی سرور:
- `/opt/beewaz-autodeploy.sh`
- `beewaz-autodeploy.service` (oneshot)
- `beewaz-autodeploy.timer` (هر ۲ دقیقه)

### امنیت deployment
- هیچ token/password/private key نباید در repo، مستندات، shell script یا log commit شود.
- credentialهای production فقط در secret store یا root-owned env/config خارج از repo نگهداری شوند.
- اگر credential در git history یا chat/log آشکار شد، آن credential compromised فرض و rotate شود.
- credentialهای قدیمی که قبلاً commit شده‌اند باید rotate شوند؛ حذف از current tree تاریخچه Git را پاک نمی‌کند.

### بررسی وضعیت deployment

```bash
systemctl status beewaz-autodeploy.timer --no-pager
systemctl status beewaz-autodeploy.service --no-pager
journalctl -u beewaz-autodeploy.service -n 200 --no-pager
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

## قوانین توسعه

- همه اعداد نمایشی سایت **فارسی** باشند (`toFaDigits`)
- قیمت‌ها همیشه با `formatPrice(rial)` نمایش داده شوند
- هیچ‌وقت `router.push` بعد از login نه — از `window.location.href` استفاده کن
- آستانه ارسال رایگان در floating-cart و checkout باید **یکسان** باشند (۲٬۰۰۰٬۰۰۰ ریال)
