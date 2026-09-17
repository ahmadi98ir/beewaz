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
- workflow مسیر build و publish را انجام می‌دهد: push به `main` ← GitHub Actions ← build tarball ← آپلود R2 + deploy-cache release.
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
| Production selector | Docker labels: `coolify.projectName=beewaz` + `coolify.environmentName=production` |

### فرآیند دیپلوی

1. **Push به `main`** → GitHub Actions standalone bundle را build می‌کند.
2. workflow فایل‌های `beewaz-build.tar.gz` و `sha.txt` را روی R2 منتشر می‌کند.
3. `beewaz-autodeploy.timer` روی production هر ۲ دقیقه `sha.txt` را poll می‌کند.
4. در صورت SHA جدید، `/opt/beewaz-autodeploy.sh` bundle را با `curl -f` دانلود و قبل از استفاده validate می‌کند.
5. اسکریپت container production را از Docker/Coolify labels به‌صورت پویا پیدا می‌کند؛ UUID یا نام container در repo hard-code نمی‌شود.
6. image جدید با همان image-name مورد انتظار Compose ساخته/tag می‌شود و فقط همان service با `--pull never --no-deps --force-recreate` recreate می‌شود.
7. local HTTP health check باید پاس شود؛ در غیر این صورت image قبلی restore و service rollback می‌شود.
8. SHA فقط پس از health check موفق در `/var/lib/beewaz-deploy/last-sha` ثبت می‌شود.

سرویس‌های مرتبط روی سرور:
- `/opt/beewaz-autodeploy.sh`
- `beewaz-autodeploy.service` (oneshot)
- `beewaz-autodeploy.timer` (هر ۲ دقیقه)

### امنیت deployment
- هیچ token/password/private key نباید در repo، مستندات، shell script یا log commit شود.
- credentialهای production فقط در secret store یا root-owned env/config خارج از repo نگهداری شوند.
- اگر credential در git history یا chat/log آشکار شد، آن credential compromised فرض و rotate شود.
- برای deploy bridge فعلی، R2 public read endpoint استفاده می‌شود و در خود اسکریپت production هیچ bearer token لازم نیست.
- rollback image قبل از هر activation با tag محلی `beewaz-rollback:previous` نگهداری می‌شود.

### بررسی وضعیت deployment

```bash
systemctl status beewaz-autodeploy.timer --no-pager
systemctl status beewaz-autodeploy.service --no-pager
journalctl -u beewaz-autodeploy.service -n 200 --no-pager
cat /var/lib/beewaz-deploy/last-sha 2>/dev/null || true
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

- همه اعداد نمایشی سایت **فارسی** باشند (`toFaDigits`).
- قیمت‌ها همیشه با `formatPrice(rial)` نمایش داده شوند.
- بعد از login از `window.location.href` استفاده شود.
- آستانه ارسال رایگان در floating-cart و checkout یکسان باشد.
- deployment scripts نباید به UUID، container name، token یا password ثابت وابسته باشند.
