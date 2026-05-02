import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const rootDir = process.cwd();

function envFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const appConfig = {
  rootDir,
  ollamaHost: process.env.OLLAMA_HOST ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3-coder-next",
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000),
  preloadWorkspaceOnStart: envFlag(process.env.PRELOAD_WORKSPACE_ON_START, true),
  warmOllamaOnStart: envFlag(process.env.WARM_OLLAMA_ON_START, true),
  assistantDataDir: path.resolve(rootDir, process.env.ASSISTANT_DATA_DIR ?? "assistant_data"),
  enableTts: envFlag(process.env.ENABLE_TTS, false),
  ttsPython: process.env.TTS_PYTHON ?? "python",
  ttsScript: path.resolve(rootDir, process.env.TTS_SCRIPT ?? "tts/kokoro_tts.py"),
  ttsOutputDir: path.resolve(rootDir, process.env.TTS_OUTPUT_DIR ?? "assistant_data/audio")
};
