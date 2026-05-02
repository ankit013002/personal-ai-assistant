import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const defaultFiles: Record<string, string> = {
  "profile.md": "# Profile\n\nAdd stable information about you here.\n",
  "projects.md": "# Projects\n\n- Local personal AI assistant MVP\n",
  "daily.md": "# Daily\n\n## Today\n\n- Review assistant output and choose the next task.\n",
  "memory.md": "# Memory\n\nLong-term assistant memory will be appended here.\n",
  "inbox.md": "# Inbox\n\n- Ideas and unprocessed requests go here.\n"
};

export function resolveWorkspacePath(dataDir: string, relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const resolved = path.resolve(dataDir, normalized);
  const root = path.resolve(dataDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Access denied outside assistant_data: ${relativePath}`);
  }
  return resolved;
}

export async function ensureWorkspace(dataDir: string): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, "audio"), { recursive: true });
  await Promise.all(
    Object.entries(defaultFiles).map(async ([file, content]) => {
      const fullPath = resolveWorkspacePath(dataDir, file);
      try {
        await fs.access(fullPath);
      } catch {
        await fs.writeFile(fullPath, content, "utf8");
      }
    })
  );

  const tasksPath = resolveWorkspacePath(dataDir, "tasks.json");
  try {
    await fs.access(tasksPath);
  } catch {
    await fs.writeFile(
      tasksPath,
      JSON.stringify(
        [
          {
            id: "sample-review-today",
            title: "Ask the assistant what needs to be done today",
            status: "todo",
            project: "Local personal AI assistant MVP",
            notes: "Use this sample task to verify the workspace summary and planning loop.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        null,
        2
      ),
      "utf8"
    );
  }
}

export async function readWorkspaceText(dataDir: string, relativePath: string): Promise<string> {
  return fs.readFile(resolveWorkspacePath(dataDir, relativePath), "utf8");
}

export async function writeWorkspaceText(dataDir: string, relativePath: string, content: string): Promise<void> {
  const fullPath = resolveWorkspacePath(dataDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
}

export async function appendWorkspaceText(dataDir: string, relativePath: string, content: string): Promise<void> {
  const fullPath = resolveWorkspacePath(dataDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.appendFile(fullPath, content, "utf8");
}

export async function listWorkspaceDirectory(dataDir: string, relativePath = "."): Promise<string[]> {
  const fullPath = resolveWorkspacePath(dataDir, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  return entries.map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`).sort();
}

export async function readJsonFile<T>(dataDir: string, relativePath: string, schema: z.ZodSchema<T>, fallback: T): Promise<T> {
  try {
    const text = await readWorkspaceText(dataDir, relativePath);
    return schema.parse(JSON.parse(text)) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonFile<T>(dataDir: string, relativePath: string, schema: z.ZodSchema<T>, value: T): Promise<void> {
  const parsed = schema.parse(value);
  await writeWorkspaceText(dataDir, relativePath, `${JSON.stringify(parsed, null, 2)}\n`);
}

export async function summarizeWorkspaceFiles(dataDir: string): Promise<string> {
  const [profile, projects, daily, memory, inbox, tasks] = await Promise.all([
    readWorkspaceText(dataDir, "profile.md"),
    readWorkspaceText(dataDir, "projects.md"),
    readWorkspaceText(dataDir, "daily.md"),
    readWorkspaceText(dataDir, "memory.md"),
    readWorkspaceText(dataDir, "inbox.md"),
    readWorkspaceText(dataDir, "tasks.json")
  ]);

  return [
    "IMPORTANT: This is private local assistant memory. Use it to answer the user's personal/project/task questions. Do not claim you lack access when the answer is here.",
    "## profile.md",
    compactText(profile, 3500),
    "## projects.md",
    compactText(projects, 1800),
    "## daily.md",
    compactText(daily, 1000),
    "## memory.md",
    compactText(memory, 3500),
    "## inbox.md",
    compactText(inbox, 1000),
    "## tasks.json",
    compactText(tasks, 3500)
  ].join("\n\n");
}

export async function summarizeWorkspaceForInput(dataDir: string, input: string): Promise<string> {
  const [profile, projects, daily, memory, inbox, tasksText] = await Promise.all([
    readWorkspaceText(dataDir, "profile.md"),
    readWorkspaceText(dataDir, "projects.md"),
    readWorkspaceText(dataDir, "daily.md"),
    readWorkspaceText(dataDir, "memory.md"),
    readWorkspaceText(dataDir, "inbox.md"),
    readWorkspaceText(dataDir, "tasks.json")
  ]);

  const focus = detectFocus(input);
  const filteredTasks = filterTasksForFocus(tasksText, focus);

  return [
    `REQUEST FOCUS: ${focus}. Use only memory relevant to this focus unless the user asks for all priorities.`,
    "IMPORTANT: This is private local assistant memory. Use it to answer the user's personal/project/task questions. Do not claim you lack access when the answer is here.",
    "## profile.md",
    compactText(profile, 2500),
    "## projects.md",
    compactText(projects, focus === "condo/property rental" ? 1200 : 1800),
    "## daily.md",
    compactText(daily, 1000),
    "## memory.md",
    compactText(memory, focus === "condo/property rental" ? 3000 : 3500),
    "## inbox.md",
    compactText(inbox, 1000),
    "## relevant tasks.json entries",
    filteredTasks
  ].join("\n\n");
}

function compactText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Truncated for context. Use tools to read the full file if needed.]`;
}

function detectFocus(input: string): string {
  const lower = input.toLowerCase();
  if (/\b(condo|rental|rent out|tenant|landlord|lease|property|fairborn|fieldstone)\b/.test(lower)) {
    return "condo/property rental";
  }
  if (/\b(benzene|nebula|vault|storage|s3|compression)\b/.test(lower)) return "Benzene / Nebula Vault";
  if (/\b(portfolio|resume|career|case stud)/.test(lower)) return "portfolio/career";
  if (/\b(node|npm|typescript|tooling|esm|cjs)\b/.test(lower)) return "Node/npm learning";
  if (/\b(today|daily|all priorities|everything|tasks|plan my day)\b/.test(lower)) return "daily planning";
  return "general";
}

function filterTasksForFocus(tasksText: string, focus: string): string {
  try {
    const tasks = JSON.parse(tasksText) as Array<Record<string, unknown>>;
    if (focus === "daily planning" || focus === "general") return JSON.stringify(tasks, null, 2);

    const keywordsByFocus: Record<string, string[]> = {
      "condo/property rental": ["condo", "rental", "rent", "property", "fairborn", "lease", "tenant", "insurance"],
      "Benzene / Nebula Vault": ["benzene", "nebula", "vault", "storage", "compression"],
      "portfolio/career": ["portfolio", "career", "case stud"],
      "Node/npm learning": ["node", "npm", "typescript", "tooling", "esm", "cjs"]
    };
    const keywords = keywordsByFocus[focus] ?? [];
    const relevant = tasks.filter((task) => {
      const searchable = JSON.stringify(task).toLowerCase();
      return keywords.some((keyword) => searchable.includes(keyword));
    });
    return JSON.stringify(relevant, null, 2);
  } catch {
    return compactText(tasksText, 2500);
  }
}

export async function appendMemorySummary(dataDir: string, userInput: string, assistantOutput: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const summary = `\n## ${timestamp}\n\nUser: ${userInput}\n\nAssistant summary: ${assistantOutput.slice(0, 1200)}\n`;
  await appendWorkspaceText(dataDir, "memory.md", summary);
}
