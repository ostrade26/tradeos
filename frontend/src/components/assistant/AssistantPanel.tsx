import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bot, Send, Sparkles, ArrowRight, X, LayoutGrid } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn, noAutofill } from '../../lib/utils'
import { appPath, isPlatformAdminPath } from '../../lib/appShellMode'
import { useAuth } from '../../hooks/useAuth'
import { useTradeStore } from '../../store/TradeStore'
import { runAssistantQuery } from '../../lib/assistant/queryEngine'
import {
  loadPlatformAssistantSnapshot,
  runPlatformAssistantQuery,
} from '../../lib/assistant/platformQueryEngine'
import {
  getAssistantMessages,
  getAssistantOpen,
  isAssistantMainMenuCommand,
  resetAssistantToMainMenu,
  setAssistantContext,
  setAssistantMessages,
  setAssistantOpen,
  subscribeAssistant,
} from '../../lib/assistant/session'
import type { AssistantAction, ChatMessage } from '../../lib/assistant/types'

const ORG_SUGGESTIONS = [
  "What is today's earning?",
  'Total sales in last 3 days',
  'How much do I need to pay DVC?',
  'Pending purchase orders',
  'Summary / stats',
  'Create a PO for DVC 50 MT',
  'Record lift for PO-1',
]

const PLATFORM_SUGGESTIONS = [
  'Platform summary',
  'How many organisations?',
  'Pending seat requests',
  'Active licences',
  'Open Features & Access',
  'Go to Releases',
]

const THINK_MS = 520

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-heading">{part.slice(2, -2)}</strong>
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ))
  })
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-0.5" aria-label="Thinking">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="assistant-dot h-1.5 w-1.5 rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.14}s` }}
        />
      ))}
    </div>
  )
}

function useAssistantOpen() {
  return useSyncExternalStore(subscribeAssistant, getAssistantOpen, () => false)
}

function useAssistantMessages() {
  return useSyncExternalStore(subscribeAssistant, getAssistantMessages, getAssistantMessages)
}

function resolveAssistantNavigatePath(path: string) {
  if (path.startsWith('/platform-admin')) return path
  return appPath(path)
}

/** Floating Tradeal AI launcher + chat card. Open state and history survive route changes. */
export function AssistantPanel() {
  const store = useTradeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin } = useAuth()
  const platformMode = isPlatformAdmin && isPlatformAdminPath(location.pathname)
  const open = useAssistantOpen()
  const messages = useAssistantMessages()
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const thinkTimer = useRef(0)

  useEffect(() => {
    setAssistantContext(platformMode ? 'platform' : 'org')
  }, [platformMode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setAssistantOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, open])

  useEffect(() => () => window.clearTimeout(thinkTimer.current), [])

  const goToMainMenu = useCallback(() => {
    window.clearTimeout(thinkTimer.current)
    setThinking(false)
    setInput('')
    resetAssistantToMainMenu()
    setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || thinking) return

      if (isAssistantMainMenuCommand(trimmed)) {
        goToMainMenu()
        return
      }

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      }

      setAssistantMessages(prev => [...prev, userMsg])
      setInput('')
      setThinking(true)

      const finish = (content: string, actions?: AssistantAction[]) => {
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content,
          actions,
          timestamp: new Date().toISOString(),
        }
        window.clearTimeout(thinkTimer.current)
        thinkTimer.current = window.setTimeout(() => {
          setAssistantMessages(prev => [...prev, assistantMsg])
          setThinking(false)
        }, prefersReducedMotion() ? 0 : THINK_MS)
      }

      if (platformMode) {
        void loadPlatformAssistantSnapshot()
          .then(snapshot => {
            const result = runPlatformAssistantQuery(trimmed, snapshot)
            finish(result.message, result.actions)
          })
          .catch(() => {
            finish(
              'Could not load platform data right now. Try again, or open Organisations from the side nav.',
              [{ label: 'Organisations', path: '/platform-admin/organisations' }],
            )
          })
        return
      }

      const result = runAssistantQuery(trimmed, store)
      finish(result.message, result.actions)
    },
    [store, thinking, platformMode, goToMainMenu],
  )

  const handleAction = (action: AssistantAction) => {
    if (!action.path) return
    setAssistantOpen(true)
    navigate(resolveAssistantNavigatePath(action.path))
  }

  const suggestions = platformMode ? PLATFORM_SUGGESTIONS : ORG_SUGGESTIONS
  const showSuggestions = messages.length <= 1 && !thinking
  const showMainMenu = messages.length > 1 || thinking

  const fabClass =
    'fixed z-40 bottom-12 right-12 max-lg:bottom-32 pb-[env(safe-area-inset-bottom)]'

  return createPortal(
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className={cn(
            fabClass,
            'flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg',
            'bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--color-accent)_70%,#1e3a8a)]',
            'hover:brightness-110 hover:scale-[1.04] active:scale-95 cursor-pointer transition-transform',
            'attex-focus',
          )}
          aria-label={platformMode ? 'Ask Tradeal Admin AI' : 'Ask Tradeal AI'}
          title={platformMode ? 'Ask Tradeal Admin AI (⌘J)' : 'Ask Tradeal AI (⌘J)'}
        >
          <Bot className="h-6 w-6" />
        </button>
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assistant-title"
          className={cn(
            'fixed z-[100] flex flex-col overflow-hidden rounded-2xl shadow-2xl animate-fade-in',
            'bottom-12 right-12 max-lg:bottom-32',
            'w-[min(100vw-3rem,24rem)] h-[min(70vh,36rem)]',
            'ring-1 ring-black/10 dark:ring-white/10',
          )}
          style={{
            marginBottom: 'env(safe-area-inset-bottom)',
            background: `
              radial-gradient(ellipse 90% 55% at 110% -8%, color-mix(in srgb, var(--color-accent) 38%, transparent), transparent 58%),
              radial-gradient(ellipse 80% 50% at -15% 108%, color-mix(in srgb, var(--color-info) 26%, transparent), transparent 52%),
              linear-gradient(165deg, color-mix(in srgb, var(--color-accent) 10%, var(--color-card)) 0%, var(--color-card) 42%)
            `,
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="assistant-orb-a absolute -top-16 -right-10 h-56 w-56 rounded-full blur-3xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 42%, transparent)' }}
            />
            <div
              className="assistant-orb-b absolute bottom-24 -left-16 h-48 w-48 rounded-full blur-3xl"
              style={{ background: 'color-mix(in srgb, var(--color-info) 34%, transparent)' }}
            />
          </div>

          <div className="relative z-10 flex items-start gap-3 border-b border-white/50 dark:border-white/10 px-4 py-3.5 shrink-0 bg-white/40 dark:bg-black/20 backdrop-blur-md">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              {thinking && (
                <span className="assistant-pulse-ring absolute inset-0 rounded-full border-2 border-accent" />
              )}
              <span
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md',
                  'bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--color-accent)_70%,#1e3a8a)]',
                )}
              >
                <Bot className="h-5 w-5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="assistant-title" className="text-base font-semibold text-heading flex items-center gap-1.5">
                {platformMode ? 'Tradeal Admin AI' : 'Tradeal AI'}
                <Sparkles className={cn('h-3.5 w-3.5 text-accent', thinking && 'assistant-sparkle')} />
              </h2>
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                {thinking ? (
                  <>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    Thinking…
                  </>
                ) : (
                  <>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                    {platformMode ? 'Ready to help' : 'Ready · orders, balances, create PO / SO / lift'}
                  </>
                )}
              </p>
            </div>
            {showMainMenu ? (
              <button
                type="button"
                onClick={goToMainMenu}
                className="rounded-lg p-1.5 text-muted hover:text-heading hover:bg-white/70 dark:hover:bg-white/10 cursor-pointer transition-colors"
                aria-label="Main menu"
                title="Main menu"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:text-heading hover:bg-white/70 dark:hover:bg-white/10 cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={cn(
                  'flex assistant-message-in',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
                style={{ animationDelay: index === 0 ? '80ms' : '0ms' }}
              >
                <div
                  className={cn(
                    'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--color-accent)_78%,#1e3a8a)] text-white'
                      : 'rounded-bl-md border border-white/70 bg-white/75 text-gray-700 backdrop-blur-sm dark:border-white/10 dark:bg-white/8 dark:text-gray-200',
                  )}
                >
                  {renderMarkdownLite(msg.content)}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions
                        .filter(a => a.path)
                        .map(action => (
                          <button
                            key={action.path + action.label}
                            type="button"
                            onClick={() => handleAction(action)}
                            className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-white/90 dark:bg-card/80 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white cursor-pointer transition-colors"
                          >
                            {action.label}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start assistant-message-in">
                <div className="rounded-2xl rounded-bl-md border border-accent/20 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-accent/25 dark:bg-white/8">
                  <div className="flex items-center gap-2.5">
                    <ThinkingDots />
                    <span className="text-xs font-medium text-muted">Working on it…</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showSuggestions && (
            <div className="relative z-10 px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="assistant-message-in rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs text-gray-600 hover:border-accent/40 hover:text-accent hover:bg-white cursor-pointer transition-colors dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                  style={{ animationDelay: `${80 + i * 40}ms` }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="relative z-10 border-t border-white/50 dark:border-white/10 px-3 py-3 shrink-0 bg-white/50 dark:bg-black/25 backdrop-blur-md">
            <div
              className={cn(
                'flex items-end gap-2 rounded-2xl border bg-white/90 px-2.5 py-2 shadow-sm transition-shadow dark:bg-card/90',
                composerFocused
                  ? 'border-accent/50 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]'
                  : 'border-gray-200/90 dark:border-white/10',
              )}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit(input)
                  }
                }}
                placeholder={
                  platformMode
                    ? 'Ask about orgs, seats, licences…'
                    : 'Ask about earnings, balances, orders…'
                }
                className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-heading placeholder:text-muted focus:outline-none"
                {...noAutofill}
              />
              <button
                type="button"
                disabled={!input.trim() || thinking}
                onClick={() => submit(input)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--color-accent)_75%,#1e3a8a)] text-white disabled:opacity-40 hover:brightness-110 cursor-pointer transition-transform hover:scale-[1.04] active:scale-95"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}
