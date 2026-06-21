import { nextTaskId, tasks } from "@/lib/tasks";

export async function GET() {
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();

  if (!title) {
    return Response.json({ message: "A title is required" }, { status: 400 });
  }

  const task = { id: nextTaskId(), title };
  tasks.push(task);
  return Response.json(task, { status: 201 });
}
