import type { ChatMessage } from './types'

export type AssistantContext = 'org' | 'platform'

const OPEN_KEY = 'tradeal-assistant-open'
const CONTEXT_KEY = 'tradeal-assistant-context'
const MESSAGES_KEY_ORG = 'tradeal-assistant-messages'
const MESSAGES_KEY_PLATFORM = 'tradeal-assistant-messages-platform'

export const ASSISTANT_WELCOME_ORG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your Tradeal assistant. Ask about earnings, balances, pending orders, or type *Create a PO*, *New sales order*, or *Record lift*.",
  timestamp: new Date().toISOString(),
}

export const ASSISTANT_WELCOME_PLATFORM: ChatMessage = {
  id: 'welcome-platform',
  role: 'assistant',
  content:
    "Hi! I'm the Tradeal Admin assistant. Ask about organisations, seats, licences, or Features & Access — or say *Platform summary*.",
  timestamp: new Date().toISOString(),
}

/** @deprecated Use ASSISTANT_WELCOME_ORG */
export const ASSISTANT_WELCOME = ASSISTANT_WELCOME_ORG

function welcomeFor(context: AssistantContext): ChatMessage {
  const base = context === 'platform' ? ASSISTANT_WELCOME_PLATFORM : ASSISTANT_WELCOME_ORG
  return { ...base, timestamp: new Date().toISOString() }
}

function messagesKey(context: AssistantContext): string {
  return context === 'platform' ? MESSAGES_KEY_PLATFORM : MESSAGES_KEY_ORG
}

function readOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeOpen(open: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function readContext(): AssistantContext {
  try {
    return sessionStorage.getItem(CONTEXT_KEY) === 'platform' ? 'platform' : 'org'
  } catch {
    return 'org'
  }
}

function writeContext(context: AssistantContext) {
  try {
    sessionStorage.setItem(CONTEXT_KEY, context)
  } catch {
    /* ignore */
  }
}

function readMessages(context: AssistantContext): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(messagesKey(context))
    if (!raw) return [welcomeFor(context)]
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [welcomeFor(context)]
  } catch {
    return [welcomeFor(context)]
  }
}

function writeMessages(context: AssistantContext, messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(messagesKey(context), JSON.stringify(messages))
  } catch {
    /* ignore */
  }
}

let openState = typeof window !== 'undefined' ? readOpen() : false
let contextState: AssistantContext = typeof window !== 'undefined' ? readContext() : 'org'
let messagesState: ChatMessage[] =
  typeof window !== 'undefined' ? readMessages(contextState) : [ASSISTANT_WELCOME_ORG]
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function getAssistantOpen() {
  return openState
}

export function setAssistantOpen(open: boolean) {
  if (openState === open) return
  openState = open
  writeOpen(open)
  emit()
}

export function getAssistantContext(): AssistantContext {
  return contextState
}

/** Switch org ↔ platform chat history when the shell context changes. */
export function setAssistantContext(context: AssistantContext) {
  if (contextState === context) return
  contextState = context
  writeContext(context)
  messagesState = readMessages(context)
  emit()
}

export function getAssistantMessages() {
  return messagesState
}

export function setAssistantMessages(next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) {
  messagesState = typeof next === 'function' ? next(messagesState) : next
  writeMessages(contextState, messagesState)
  emit()
}

/** Return to the opening Tradeal AI screen (welcome + suggestion chips). */
export function resetAssistantToMainMenu() {
  messagesState = [welcomeFor(contextState)]
  writeMessages(contextState, messagesState)
  emit()
}

export function isAssistantMainMenuCommand(text: string): boolean {
  const q = text.trim().toLowerCase().replace(/[?.!]+$/g, '')
  return (
    /^(main\s+menu|menu|start\s+over|start\s+again|reset(\s+chat)?|clear(\s+chat)?|new\s+chat)$/.test(q)
    || /^(go\s+to\s+|open\s+|show\s+)?(the\s+)?main\s+menu$/.test(q)
    || /^(back\s+to\s+)(main\s+)?menu$/.test(q)
  )
}

export function subscribeAssistant(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
