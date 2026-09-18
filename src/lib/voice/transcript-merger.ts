function normalizeDigit(char: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  const p = persian.indexOf(char)
  if (p >= 0) return String(p)
  const a = arabic.indexOf(char)
  if (a >= 0) return String(a)
  return char
}

function normalizeComparisonText(text: string): string {
  return Array.from(text)
    .map(normalizeDigit)
    .join('')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR')
}

function normalizedTokens(text: string): string[] {
  const normalized = normalizeComparisonText(text)
  return normalized ? normalized.split(' ') : []
}

/**
 * Browser SpeechRecognition implementations sometimes emit cumulative phrases
 * as separate final/interim chunks on Android. Joining those chunks blindly
 * produces text like "برای برای خونه برای خونه ۱۲۰...".
 *
 * This merger prefers the most complete cumulative phrase and otherwise joins
 * chunks using their largest token overlap.
 */
export function mergeSpeechTranscript(existing: string, incoming: string): string {
  const left = existing.replace(/\s+/g, ' ').trim()
  const right = incoming.replace(/\s+/g, ' ').trim()
  if (!left) return right
  if (!right) return left

  const leftNormalized = normalizeComparisonText(left)
  const rightNormalized = normalizeComparisonText(right)

  if (leftNormalized === rightNormalized) {
    return right.length >= left.length ? right : left
  }

  if (rightNormalized.startsWith(leftNormalized + ' ')) return right
  if (leftNormalized.startsWith(rightNormalized + ' ')) return left

  const leftTokens = normalizedTokens(left)
  const rightTokens = normalizedTokens(right)
  const rightRawTokens = right.split(/\s+/)
  const maxOverlap = Math.min(leftTokens.length, rightTokens.length)

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const leftTail = leftTokens.slice(-overlap)
    const rightHead = rightTokens.slice(0, overlap)
    if (leftTail.every((token, index) => token === rightHead[index])) {
      const suffix = rightRawTokens.slice(overlap).join(' ').trim()
      return suffix ? `${left} ${suffix}` : left
    }
  }

  // If one normalized phrase fully contains the other, keep the richer version.
  if (rightNormalized.includes(leftNormalized)) return right
  if (leftNormalized.includes(rightNormalized)) return left

  return `${left} ${right}`.trim()
}
