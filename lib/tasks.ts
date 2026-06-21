export type Task = {
  id: number;
  title: string;
};

export const tasks: Task[] = [
  { id: 1, title: "Reply to customer emails" },
  { id: 2, title: "Update the weekly report" },
  { id: 3, title: "Review the new homepage" },
];

export function nextTaskId() {
  return Math.max(0, ...tasks.map((task) => task.id)) + 1;
}
