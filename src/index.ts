import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { appConfig } from "./config.js";
import { OllamaClient } from "./ollamaClient.js";
import { ensureWorkspace } from "./memory/workspace.js";
import { AgentSession } from "./agent/agentLoop.js";
import { speakText } from "./voice/tts.js";
import { formatElapsedSeconds, startStatusTimer } from "./ui/statusTimer.js";

async function main(): Promise<void> {
  await ensureWorkspace(appConfig.assistantDataDir);

  const ollama = new OllamaClient(appConfig.ollamaHost, appConfig.ollamaModel, appConfig.ollamaTimeoutMs);
  const agent = new AgentSession(appConfig.assistantDataDir, ollama);
  const rl = readline.createInterface({ input, output });

  console.log("Local AI Assistant MVP");
  console.log(`Model: ${appConfig.ollamaModel}`);
  console.log(`Workspace: ${appConfig.assistantDataDir}`);

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

  console.log("Type a request, or /exit to quit.\n");

  while (true) {
    let userInput: string;
    try {
      userInput = (await rl.question("> ")).trim();
    } catch (error) {
      if (error instanceof Error && error.message.includes("readline was closed")) break;
      throw error;
    }
    if (!userInput) continue;
    if (["/exit", "exit", "quit"].includes(userInput.toLowerCase())) break;

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
          outputDir: appConfig.ttsOutputDir
        });
        if (audioPath) console.log(`[tts] ${audioPath}\n`);
      }
    } catch (error) {
      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
