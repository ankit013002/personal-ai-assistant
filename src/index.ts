import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { appConfig } from "./config.js";
import { OllamaClient } from "./ollamaClient.js";
import { ensureWorkspace } from "./memory/workspace.js";
import { AgentSession } from "./agent/agentLoop.js";
import { transcribeSpeech } from "./voice/stt.js";
import { speakText } from "./voice/tts.js";
import { formatElapsedSeconds, startStatusTimer } from "./ui/statusTimer.js";

type VoiceInputConfig = {
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
};

async function main(): Promise<void> {
  await ensureWorkspace(appConfig.assistantDataDir);

  const ollama = new OllamaClient(appConfig.ollamaHost, appConfig.ollamaModel, appConfig.ollamaTimeoutMs);
  const agent = new AgentSession(appConfig.assistantDataDir, ollama);
  const rl = readline.createInterface({ input, output });

  console.log("Local AI Assistant MVP");
  console.log(`Model: ${appConfig.ollamaModel}`);
  console.log(`Workspace: ${appConfig.assistantDataDir}`);
  console.log(`Voice input: ${appConfig.enableStt ? "enabled" : "disabled"}`);
  console.log(`Voice output: ${appConfig.enableTts ? "enabled" : "disabled"}`);

  if (appConfig.preloadWorkspaceOnStart) {
    const timer = startStatusTimer("Loading assistant workspace memory...");
    await agent.preloadWorkspace();
    timer.stop("Loaded assistant workspace memory");
  }

  if (appConfig.warmOllamaOnStart) {
    const timer = startStatusTimer("Warming Ollama with workspace context...");
    try {
      await agent.warmup();
      timer.stop("Assistant memory is ready");
      console.log();
    } catch (error) {
      timer.stop("Warmup failed");
      console.error(`Warmup skipped: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  if (appConfig.enableTts && appConfig.warmTtsOnStart) {
    const timer = startStatusTimer("Warming Kokoro TTS...");
    try {
      await speakText(appConfig.ttsWarmupText, {
        enabled: appConfig.enableTts,
        python: appConfig.ttsPython,
        script: appConfig.ttsScript,
        outputDir: appConfig.ttsOutputDir,
        voice: appConfig.ttsVoice,
        speed: appConfig.ttsSpeed
      });
      timer.stop("Kokoro TTS is ready");
      console.log();
    } catch (error) {
      timer.stop("TTS warmup failed");
      console.error(`TTS warmup skipped: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  console.log("Type a request, /voice to speak once, or /exit to quit.\n");

  while (true) {
    let userInput: string;
    try {
      const prompt = appConfig.voiceMode ? "> Press Enter to speak, or type a request: " : "> ";
      userInput = (await rl.question(prompt)).trim();
    } catch (error) {
      if (error instanceof Error && error.message.includes("readline was closed")) break;
      throw error;
    }
    if (["/exit", "exit", "quit"].includes(userInput.toLowerCase())) break;

    if (userInput.toLowerCase().startsWith("/voice") || (appConfig.voiceMode && !userInput)) {
      userInput = await readVoiceInput({
        enabled: appConfig.enableStt,
        python: appConfig.sttPython,
        script: appConfig.sttScript,
        outputDir: appConfig.sttOutputDir,
        model: appConfig.sttModel,
        recordSeconds: appConfig.sttRecordSeconds,
        mode: appConfig.sttMode,
        maxRecordSeconds: appConfig.sttMaxRecordSeconds,
        silenceSeconds: appConfig.sttSilenceSeconds,
        vadThreshold: appConfig.sttVadThreshold
      });
      if (!userInput) continue;
    }

    if (!userInput) continue;

    try {
      console.log();
      const timer = startStatusTimer("Thinking...");
      const result = await agent.runTurn(userInput);
      const elapsedSeconds = timer.stop("Done thinking");
      console.log(`\n${result.answer}\n`);
      console.log(`Thought for ${formatElapsedSeconds(elapsedSeconds)}\n`);
      if (appConfig.enableTts) {
        const audioPath = await speakText(result.answer, {
          enabled: appConfig.enableTts,
          python: appConfig.ttsPython,
          script: appConfig.ttsScript,
          outputDir: appConfig.ttsOutputDir,
          voice: appConfig.ttsVoice,
          speed: appConfig.ttsSpeed
        });
        if (audioPath) console.log(`[tts] ${audioPath}\n`);
      }
    } catch (error) {
      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  rl.close();
}

async function readVoiceInput(config: VoiceInputConfig): Promise<string> {
  if (!config.enabled) {
    console.error("\nVoice input is disabled. Set ENABLE_STT=true in .env, then restart npm run dev.\n");
    return "";
  }

  console.log();
  console.log("Starting microphone...");
  let timer: ReturnType<typeof startStatusTimer> | undefined;
  try {
    const transcript = await transcribeSpeech({
      ...config,
      onReady: () => {
        const label =
          config.mode === "vad"
            ? `Speak now. Listening until speech ends, max ${config.maxRecordSeconds}s...`
            : `Speak now. Listening for ${config.recordSeconds}s...`;
        timer = startStatusTimer(label);
      }
    });
    timer?.stop("Done listening");
    console.log(`You said: ${transcript}\n`);
    return transcript;
  } catch (error) {
    timer?.stop("Stopped listening");
    console.error(`\nVoice input error: ${error instanceof Error ? error.message : String(error)}\n`);
    return "";
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
