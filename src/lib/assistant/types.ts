export interface AssistantAction {
  label: string
  path: string
  count?: number
}

export interface AssistantResult {
  message: string
  actions: AssistantAction[]
  /** Primary destination — panel auto-navigates here when set */
  navigateTo?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: AssistantAction[]
  timestamp: string
}
