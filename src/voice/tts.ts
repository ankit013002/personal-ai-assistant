import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

export type TtsConfig = {
  enabled: boolean;
  python: string;
  script: string;
  outputDir: string;
};

export async function speakText(text: string, config: TtsConfig): Promise<string | undefined> {
  if (!config.enabled) return undefined;

  await fs.mkdir(config.outputDir, { recursive: true });
  const { stdout } = await execFileAsync(config.python, [config.script, "--text", text, "--output-dir", config.outputDir], {
    maxBuffer: 1024 * 1024
  });
  const audioPath = stdout.trim().split(/\r?\n/).at(-1);
  if (!audioPath) throw new Error("TTS script did not return an audio path.");

  await playAudio(audioPath);
  return path.resolve(audioPath);
}

async function playAudio(audioPath: string): Promise<void> {
  if (process.platform === "win32") {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(New-Object Media.SoundPlayer ${JSON.stringify(audioPath)}).PlaySync();`
    ]);
  }
}
