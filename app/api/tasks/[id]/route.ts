import { tasks } from "@/lib/tasks";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await context.params;
  const task = tasks.find((entry) => entry.id === Number(id));

  if (!task) {
    return Response.json({ message: "Task not found" }, { status: 404 });
  }

  tasks.splice(Number(id), 1);
  return new Response(null, { status: 204 });
}
