import { spawn } from "node:child_process";
import fs from "node:fs/promises";

export type SttConfig = {
  enabled: boolean;
  python: string;
  script: string;
  outputDir: string;
  model: string;
  recordSeconds: number;
  mode: string;
  maxRecordSeconds: number;
  silenceSeconds: number;
  vadThreshold: number;
  onReady?: () => void;
  onStatus?: (message: string) => void;
};

export async function transcribeSpeech(config: SttConfig): Promise<string> {
  if (!config.enabled) {
    throw new Error("Speech-to-text is disabled. Set ENABLE_STT=true in .env.");
  }

  await fs.mkdir(config.outputDir, { recursive: true });
  const args = [
    config.script,
    "--record-seconds",
    String(config.recordSeconds),
    "--output-dir",
    config.outputDir,
    "--model",
    config.model,
    "--mode",
    config.mode,
    "--max-record-seconds",
    String(config.maxRecordSeconds),
    "--silence-seconds",
    String(config.silenceSeconds),
    "--vad-threshold",
    String(config.vadThreshold)
  ];

  const transcript = await new Promise<string>((resolve, reject) => {
    const child = spawn(config.python, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      for (const rawLine of chunk.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === "__STT_READY__") {
          config.onReady?.();
          continue;
        }
        stdoutLines.push(line);
        config.onStatus?.(line);
      }
    });

    child.stderr.on("data", (chunk: string) => {
      for (const rawLine of chunk.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line) stderrLines.push(line);
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderrLines.join("\n") || `STT script exited with code ${code}`));
        return;
      }
      resolve(stdoutLines.at(-1)?.trim() ?? "");
    });
  });

  if (!transcript) throw new Error("STT script did not return a transcript.");
  return transcript;
}
