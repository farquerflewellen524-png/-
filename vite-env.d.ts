/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_GPT?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
