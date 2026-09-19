export interface AssistantAction {
  label: string
  path: string
  count?: number
}

export interface AssistantResult {
  message: string
  actions: AssistantAction[]
  /** Optional primary path — shown as an action; the panel does not auto-navigate. */
  navigateTo?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: AssistantAction[]
  timestamp: string
}
