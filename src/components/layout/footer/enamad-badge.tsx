'use client'

import { useState } from 'react'

const ENAMAD_ID = '733910'
const ENAMAD_CODE = '1fDUu6rrYqBiYkpnIrcclfpuPGF2bvxs'
const ENAMAD_LINK = `https://trustseal.enamad.ir/?id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`
const ENAMAD_LOGO = `https://trustseal.enamad.ir/logo.aspx?id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`

/**
 * نماد اعتماد الکترونیکی — تصویر از سرور enamad.ir بارگذاری می‌شود.
 * این سرویس گاهی به دلیل مشکلات شبکه/SSL خارج از کنترل ما در دسترس نیست؛
 * در آن صورت به‌جای تصویر شکسته یا جای خالی، لینک متنی معتبر نمایش داده می‌شود
 * تا الزام قانونی درج نماد اعتماد حفظ شود.
 */
export function EnamadBadge() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <a
      referrerPolicy="origin"
      target="_blank"
      rel="noopener"
      href={ENAMAD_LINK}
      className="inline-flex items-center justify-center"
    >
      {imgFailed ? (
        <span className="text-xs text-surface-400 underline underline-offset-2 hover:text-surface-600 transition-colors">
          نماد اعتماد الکترونیکی
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          referrerPolicy="origin"
          src={ENAMAD_LOGO}
          alt="نماد اعتماد الکترونیکی"
          style={{ cursor: 'pointer', height: 96, width: 'auto' }}
          onError={() => setImgFailed(true)}
        />
      )}
    </a>
  )
}
