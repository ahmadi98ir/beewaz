'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types/chat'

type Props = {
  message: ChatMessage
  onQuickReply: (text: string) => void
}

// پارسر امن markdown محدود برای **bold**، لینک و خط جدید
function parseInlineContent(text: string, lineIndex: number): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${lineIndex}-${match.index}`

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            {linkMatch[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function parseContent(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <span key={i}>
      {parseInlineContent(line, i)}
      {i < lines.length - 1 && <br />}
    </span>
  ))
}

export function MessageBubble({ message, onQuickReply }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isBot = message.role === 'bot'

  // ورود با انیمیشن
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  }, [])

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-2 ${isBot ? 'items-start' : 'items-end'}`}
    >
      {/* حباب پیام */}
      <div
        className={[
          'max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isBot
            ? 'bg-surface-100 text-surface-800 rounded-ss-sm'
            : 'bg-brand-600 text-white rounded-se-sm',
        ].join(' ')}
      >
        {parseContent(message.content)}
      </div>

      {/* Quick Replies */}
      {isBot && message.quickReplies && message.quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 max-w-[90%]">
          {message.quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => onQuickReply(reply)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white transition-all duration-150 active:scale-95"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {isBot && message.retryText && (
        <button
          type="button"
          onClick={() => onQuickReply(message.retryText!)}
          className="text-xs font-bold px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
        >
          تلاش مجدد
        </button>
      )}

      {/* زمان */}
      <span className="text-[10px] text-surface-400 px-1">
        {new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(
          new Date(message.timestamp),
        )}
      </span>
    </div>
  )
}
