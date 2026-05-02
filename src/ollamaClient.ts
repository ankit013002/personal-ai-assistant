export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

export class OllamaClient {
  constructor(
    private readonly host: string,
    private readonly model: string,
    private readonly timeoutMs: number
  ) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const endpoint = new URL("/api/chat", this.host).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Ollama did not respond within ${Math.round(this.timeoutMs / 1000)} seconds. The model may still be loading or too slow for the current machine.`
        );
      }
      throw new Error(
        `Could not reach Ollama at ${this.host}. Start Ollama and pull the configured model (${this.model}). ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) throw new Error(data.error);
    return data.message?.content?.trim() ?? "";
  }
}
