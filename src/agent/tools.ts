import { z } from "zod";
import {
  appendWorkspaceText,
  listWorkspaceDirectory,
  readWorkspaceText,
  summarizeWorkspaceFiles,
  writeWorkspaceText
} from "../memory/workspace.js";
import { addTask, completeTask, readTasks, taskStatusSchema, updateTask } from "../tasks/taskStore.js";

const safePathSchema = z.string().min(1).refine((value) => !value.includes(".."), "Path traversal is not allowed");

const toolSchemas = {
  readFile: z.object({ path: safePathSchema }),
  writeFile: z.object({
    path: safePathSchema,
    content: z.string(),
    overwriteConfirmed: z.boolean().optional()
  }),
  appendFile: z.object({ path: safePathSchema, content: z.string() }),
  listDirectory: z.object({ path: safePathSchema.default(".") }),
  addTask: z.object({
    title: z.string().min(1),
    notes: z.string().optional(),
    project: z.string().optional(),
    due: z.string().optional()
  }),
  updateTask: z.object({
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    status: taskStatusSchema.optional(),
    notes: z.string().optional(),
    project: z.string().optional(),
    due: z.string().optional()
  }),
  completeTask: z.object({ id: z.string().min(1) }),
  summarizeWorkspace: z.object({}),
  createDailyPlan: z.object({})
} satisfies Record<string, z.ZodTypeAny>;

export type ToolName = keyof typeof toolSchemas;

export type ToolCall = {
  tool: ToolName;
  args?: unknown;
};

export const toolNames = Object.keys(toolSchemas) as ToolName[];

export function parseToolCalls(content: string): ToolCall[] {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const calls = z
      .object({
        toolCalls: z.array(
          z.object({
            tool: z.enum(toolNames as [ToolName, ...ToolName[]]),
            args: z.unknown().default({})
          })
        )
      })
      .safeParse(parsed);
    return calls.success ? calls.data.toolCalls : [];
  } catch {
    return [];
  }
}

export async function executeTool(dataDir: string, call: ToolCall): Promise<unknown> {
  console.log(`[tool] ${call.tool} ${JSON.stringify(call.args)}`);

  switch (call.tool) {
    case "readFile": {
      const args = toolSchemas.readFile.parse(call.args);
      return { content: await readWorkspaceText(dataDir, args.path) };
    }
    case "writeFile": {
      const args = toolSchemas.writeFile.parse(call.args);
      if (args.content.length > 50_000 && !args.overwriteConfirmed) {
        throw new Error("Refusing to write a large file without overwriteConfirmed=true.");
      }
      await writeWorkspaceText(dataDir, args.path, args.content);
      return { ok: true, path: args.path };
    }
    case "appendFile": {
      const args = toolSchemas.appendFile.parse(call.args);
      await appendWorkspaceText(dataDir, args.path, args.content);
      return { ok: true, path: args.path };
    }
    case "listDirectory": {
      const args = toolSchemas.listDirectory.parse(call.args);
      return { entries: await listWorkspaceDirectory(dataDir, args.path) };
    }
    case "addTask": {
      const args = toolSchemas.addTask.parse(call.args);
      return { task: await addTask(dataDir, args) };
    }
    case "updateTask": {
      const args = toolSchemas.updateTask.parse(call.args);
      const { id, ...updates } = args;
      return { task: await updateTask(dataDir, id, updates) };
    }
    case "completeTask": {
      const args = toolSchemas.completeTask.parse(call.args);
      return { task: await completeTask(dataDir, args.id) };
    }
    case "summarizeWorkspace":
      toolSchemas.summarizeWorkspace.parse(call.args);
      return { summary: await summarizeWorkspaceFiles(dataDir) };
    case "createDailyPlan": {
      toolSchemas.createDailyPlan.parse(call.args);
      const tasks = await readTasks(dataDir);
      const active = tasks.filter((task) => task.status !== "done");
      return {
        date: new Date().toISOString().slice(0, 10),
        activeTasks: active,
        suggestedPlan: active.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`)
      };
    }
  }
}
