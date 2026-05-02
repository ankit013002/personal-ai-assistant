import { OllamaClient, type ChatMessage } from "../ollamaClient.js";
import { appendMemorySummary, summarizeWorkspaceFiles, summarizeWorkspaceForInput } from "../memory/workspace.js";
import { executeTool, parseToolCalls } from "./tools.js";
import { systemPrompt, userPrompt, workspacePrompt } from "./prompts.js";
import { guardAssistantPersona } from "./responseGuard.js";

export type AgentResult = {
  answer: string;
  toolResults: Array<{ tool: string; result: unknown }>;
};

export class AgentSession {
  private workspaceSummary = "";

  constructor(
    private readonly dataDir: string,
    private readonly ollama: OllamaClient
  ) {}

  async preloadWorkspace(): Promise<void> {
    this.workspaceSummary = await summarizeWorkspaceFiles(this.dataDir);
  }

  async warmup(): Promise<void> {
    if (!this.workspaceSummary) await this.preloadWorkspace();
    await this.ollama.chat([
      { role: "system", content: systemPrompt() },
      { role: "system", content: workspacePrompt(this.workspaceSummary) },
      {
        role: "user",
        content:
          "Preload this workspace context for the local assistant session. Reply with only: Ready."
      }
    ]);
  }

  async runTurn(input: string): Promise<AgentResult> {
    if (!this.workspaceSummary) await this.preloadWorkspace();
    const focusedWorkspaceSummary = await summarizeWorkspaceForInput(this.dataDir, input);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(input, focusedWorkspaceSummary) }
    ];

    const firstResponse = await this.ollama.chat(messages);
    const toolCalls = parseToolCalls(firstResponse);
    const toolResults: Array<{ tool: string; result: unknown }> = [];

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const result = await executeTool(this.dataDir, call);
        toolResults.push({ tool: call.tool, result });
      }

      await this.preloadWorkspace();

      messages.push({ role: "assistant", content: firstResponse });
      messages.push({
        role: "tool",
        content: JSON.stringify({ toolResults }, null, 2)
      });
      messages.push({
        role: "system",
        content: workspacePrompt(await summarizeWorkspaceForInput(this.dataDir, input))
      });
      messages.push({
        role: "user",
        content: "Use those tool results to provide the final answer in the requested structure."
      });

      const answer = guardAssistantPersona(await this.ollama.chat(messages));
      await appendMemorySummary(this.dataDir, input, answer);
      await this.preloadWorkspace();
      return { answer, toolResults };
    }

    const answer = guardAssistantPersona(firstResponse);
    await appendMemorySummary(this.dataDir, input, answer);
    await this.preloadWorkspace();
    return { answer, toolResults };
  }
}
