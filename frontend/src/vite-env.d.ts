/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_TRADEAL_API_TOKEN?: string
  /** @deprecated use VITE_TRADEAL_API_TOKEN */
  readonly VITE_TRADEOS_API_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
