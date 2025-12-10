/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY: string
  readonly GEMINI_API_KEY: string
  readonly GEMINI_TTS_API_KEY: string
  readonly VITE_IMAGE_PROVIDER_DEFAULT: 'gemini' | 'openai'
  readonly VITE_IMAGE_PROVIDER_FALLBACK: 'gemini' | 'openai'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 
