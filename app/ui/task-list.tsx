"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Task } from "@/lib/tasks";

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((response) => response.json())
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  async function addTask(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (response.ok) {
      const task = await response.json();
      setTasks([...tasks, task]);
      setTitle("");
    }
  }

  async function deleteTask(id: number) {
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (response.ok) {
      setTasks(tasks.filter((task) => task.id !== id));
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="header">
          <span className="logo">✓</span>
          <div>
            <h1>My tasks</h1>
            <p>Keep track of what you need to finish today.</p>
          </div>
        </div>

        <form onSubmit={addTask}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a new task"
            aria-label="New task"
            required
          />
          <button type="submit">Add task</button>
        </form>

        <div className="list">
          {loading ? (
            <p className="empty">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="empty">You have no tasks.</p>
          ) : (
            tasks.map((task) => (
              <div className="task" key={task.id}>
                <span>{task.title}</span>
                <button onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <p className="count">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</p>
      </section>
    </main>
  );
}
