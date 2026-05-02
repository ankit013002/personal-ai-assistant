import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../memory/workspace.js";

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: taskStatusSchema,
  notes: z.string().optional(),
  project: z.string().optional(),
  due: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Task = z.infer<typeof taskSchema>;

const taskListSchema = z.array(taskSchema);

export async function readTasks(dataDir: string): Promise<Task[]> {
  return readJsonFile(dataDir, "tasks.json", taskListSchema, []);
}

export async function writeTasks(dataDir: string, tasks: Task[]): Promise<void> {
  await writeJsonFile(dataDir, "tasks.json", taskListSchema, tasks);
}

export async function addTask(
  dataDir: string,
  input: Pick<Task, "title"> & Partial<Pick<Task, "notes" | "project" | "due" | "status">>
): Promise<Task> {
  const now = new Date().toISOString();
  const tasks = await readTasks(dataDir);
  const task: Task = {
    id: randomUUID(),
    title: input.title,
    status: input.status ?? "todo",
    notes: input.notes,
    project: input.project,
    due: input.due,
    createdAt: now,
    updatedAt: now
  };
  tasks.push(task);
  await writeTasks(dataDir, tasks);
  return task;
}

export async function updateTask(dataDir: string, id: string, updates: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task> {
  const tasks = await readTasks(dataDir);
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) throw new Error(`Task not found: ${id}`);
  const next = taskSchema.parse({
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString()
  });
  tasks[index] = next;
  await writeTasks(dataDir, tasks);
  return next;
}

export async function completeTask(dataDir: string, id: string): Promise<Task> {
  return updateTask(dataDir, id, { status: "done" });
}
