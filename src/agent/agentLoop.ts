import { OllamaClient, type ChatMessage } from "../ollamaClient.js";
import { appendMemorySummary, summarizeWorkspaceFiles } from "../memory/workspace.js";
import { executeTool, parseToolCalls } from "./tools.js";
import { systemPrompt, workspacePrompt } from "./prompts.js";

export type AgentResult = {
  answer: string;
  toolResults: Array<{ tool: string; result: unknown }>;
};

export async function runAgentTurn(input: string, dataDir: string, ollama: OllamaClient): Promise<AgentResult> {
  const workspaceSummary = await summarizeWorkspaceFiles(dataDir);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "system", content: workspacePrompt(workspaceSummary) },
    { role: "user", content: input }
  ];

  const firstResponse = await ollama.chat(messages);
  const toolCalls = parseToolCalls(firstResponse);
  const toolResults: Array<{ tool: string; result: unknown }> = [];

  if (toolCalls.length > 0) {
    for (const call of toolCalls) {
      const result = await executeTool(dataDir, call);
      toolResults.push({ tool: call.tool, result });
    }

    messages.push({ role: "assistant", content: firstResponse });
    messages.push({
      role: "tool",
      content: JSON.stringify({ toolResults }, null, 2)
    });
    messages.push({
      role: "user",
      content: "Use those tool results to provide the final answer in the requested structure."
    });

    const answer = await ollama.chat(messages);
    await appendMemorySummary(dataDir, input, answer);
    return { answer, toolResults };
  }

  await appendMemorySummary(dataDir, input, firstResponse);
  return { answer: firstResponse, toolResults };
}
