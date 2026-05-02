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
  enableStt: envFlag(process.env.ENABLE_STT, false),
  voiceMode: envFlag(process.env.VOICE_MODE, false),
  sttPython: process.env.STT_PYTHON ?? process.env.TTS_PYTHON ?? "python",
  sttScript: path.resolve(rootDir, process.env.STT_SCRIPT ?? "stt/whisper_stt.py"),
  sttOutputDir: path.resolve(rootDir, process.env.STT_OUTPUT_DIR ?? "assistant_data/audio"),
  sttModel: process.env.STT_MODEL ?? "base",
  sttRecordSeconds: Number(process.env.STT_RECORD_SECONDS ?? 6),
  sttMode: process.env.STT_MODE ?? "vad",
  sttMaxRecordSeconds: Number(process.env.STT_MAX_RECORD_SECONDS ?? process.env.STT_RECORD_SECONDS ?? 10),
  sttSilenceSeconds: Number(process.env.STT_SILENCE_SECONDS ?? 1),
  sttVadThreshold: Number(process.env.STT_VAD_THRESHOLD ?? 0.01),
  enableTts: envFlag(process.env.ENABLE_TTS, false),
  warmTtsOnStart: envFlag(process.env.WARM_TTS_ON_START, true),
  ttsWarmupText: process.env.TTS_WARMUP_TEXT ?? "Ready to assist you.",
  ttsPython: process.env.TTS_PYTHON ?? "python",
  ttsScript: path.resolve(rootDir, process.env.TTS_SCRIPT ?? "tts/kokoro_tts.py"),
  ttsOutputDir: path.resolve(rootDir, process.env.TTS_OUTPUT_DIR ?? "assistant_data/audio"),
  ttsVoice: process.env.TTS_VOICE ?? "af_heart",
  ttsSpeed: Number(process.env.TTS_SPEED ?? 1)
};
