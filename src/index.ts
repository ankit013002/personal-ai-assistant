import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { appConfig } from "./config.js";
import { OllamaClient } from "./ollamaClient.js";
import { ensureWorkspace } from "./memory/workspace.js";
import { runAgentTurn } from "./agent/agentLoop.js";
import { speakText } from "./voice/tts.js";

async function main(): Promise<void> {
  await ensureWorkspace(appConfig.assistantDataDir);

  const ollama = new OllamaClient(appConfig.ollamaHost, appConfig.ollamaModel);
  const rl = readline.createInterface({ input, output });

  console.log("Local AI Assistant MVP");
  console.log(`Model: ${appConfig.ollamaModel}`);
  console.log(`Workspace: ${appConfig.assistantDataDir}`);
  console.log("Type a request, or /exit to quit.\n");

  while (true) {
    const userInput = (await rl.question("> ")).trim();
    if (!userInput) continue;
    if (["/exit", "exit", "quit"].includes(userInput.toLowerCase())) break;

    try {
      const result = await runAgentTurn(userInput, appConfig.assistantDataDir, ollama);
      console.log(`\n${result.answer}\n`);
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
