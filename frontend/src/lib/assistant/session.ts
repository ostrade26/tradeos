import type { ChatMessage } from './types'

const OPEN_KEY = 'tradeal-assistant-open'
const MESSAGES_KEY = 'tradeal-assistant-messages'

export const ASSISTANT_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your Tradeal assistant. Ask about earnings, balances, pending orders, or type *Create a PO*, *New sales order*, or *Record lift*.",
  timestamp: new Date().toISOString(),
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

function readMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY)
    if (!raw) return [ASSISTANT_WELCOME]
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [ASSISTANT_WELCOME]
  } catch {
    return [ASSISTANT_WELCOME]
  }
}

function writeMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages))
  } catch {
    /* ignore */
  }
}

let openState = typeof window !== 'undefined' ? readOpen() : false
let messagesState: ChatMessage[] = typeof window !== 'undefined' ? readMessages() : [ASSISTANT_WELCOME]
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

export function getAssistantMessages() {
  return messagesState
}

export function setAssistantMessages(next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) {
  messagesState = typeof next === 'function' ? next(messagesState) : next
  writeMessages(messagesState)
  emit()
}

export function subscribeAssistant(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
