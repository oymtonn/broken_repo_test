import express from "express";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

let nextTaskId = 1;
let nextArchiveJobId = 1;
const tasks = [];
const taskListCache = new Map();
const archiveJobs = new Map();
const CACHE_TTL_MS = 60_000;

function statusFor(task) {
  return task.completed ? "completed" : "active";
}

function cacheKey(status) {
  return `task-list:${status}`;
}

function readTaskList(status) {
  const entry = taskListCache.get(cacheKey(status));

  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.payload;
}

function writeTaskList(status, payload) {
  taskListCache.set(cacheKey(status), {
    payload: structuredClone(payload),
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function invalidateTaskLists(statuses) {
  for (const status of statuses) {
    taskListCache.delete(cacheKey(status));
  }
}

function createArchiveBatch(archivedTasks, job) {
  const batch = {
    id: `archive-${Date.now()}`,
    createdAt: new Date().toISOString(),
    entries: [],
    context: { jobId: job.id }
  };

  for (const task of archivedTasks) {
    batch.entries.push({
      task,
      archivedAt: new Date().toISOString(),
      sourceStatus: statusFor(task)
    });
  }

  return batch;
}

function persistArchiveBatch(batch) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(JSON.stringify(batch));
      } catch (error) {
        reject(error);
      }
    }, 80);
  });
}

function archiveJobResponse(job) {
  return {
    id: job.id,
    status: job.status,
    requestedCount: job.taskIds.length,
    archivedCount: job.archivedCount,
    error: job.error?.message ?? null
  };
}

async function processArchiveJob(job) {
  job.status = "processing";
  const snapshot = tasks.slice();
  const archivedTasks = tasks.filter((task) => job.taskIds.includes(task.id));
  const batch = createArchiveBatch(archivedTasks, job);
  job.batch = batch;

  for (const task of archivedTasks) {
    task.archivedAt = batch.createdAt;
    const index = tasks.findIndex((item) => item.id === task.id);

    if (index !== -1) {
      tasks.splice(index, 1);
    }
  }

  invalidateTaskLists(["completed"]);

  try {
    job.receipt = await persistArchiveBatch(batch);
    job.archivedCount = archivedTasks.length;
    job.status = "completed";
  } catch (error) {
    tasks.push(...snapshot);
    job.status = "failed";
    job.error = error;
    console.error(`Archive job ${job.id} failed`, error);
  }
}

app.get("/tasks", (req, res) => {
  const status = req.query.status ?? "all";

  if (!["all", "active", "completed"].includes(status)) {
    return res.status(400).json({ error: "Unknown task status." });
  }

  const cachedPayload = readTaskList(status);

  if (cachedPayload) {
    return res.json(cachedPayload);
  }

  let visibleTasks = tasks;

  if (status === "active") {
    visibleTasks = tasks.filter((task) => task.completed === false);
  } else if (status === "completed") {
    visibleTasks = tasks.filter((task) => task.completed === true);
  }

  const payload = { tasks: visibleTasks, count: visibleTasks.length };
  writeTaskList(status, payload);
  return res.json(payload);
});

app.post("/tasks", (req, res) => {
  const { title, priority, dueDate } = req.body;

  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "A task title is required." });
  }

  if (!["low", "medium", "high"].includes(priority)) {
    return res.status(400).json({ error: "Priority must be low, medium, or high." });
  }

  if (typeof dueDate !== "string" || dueDate === "") {
    return res.status(400).json({ error: "A due date is required." });
  }

  const task = {
    id: nextTaskId++,
    title: title.trim(),
    priority,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(task);
  invalidateTaskLists(["all", statusFor(task)]);
  return res.status(201).json({ task });
});

app.post("/tasks/archive-completed", (req, res) => {
  const archivedTasks = tasks.filter((task) => task.completed);

  if (archivedTasks.length === 0) {
    return res.status(400).json({ error: "There are no completed tasks to archive." });
  }

  const job = {
    id: nextArchiveJobId++,
    status: "queued",
    taskIds: archivedTasks.map((task) => task.id),
    archivedCount: 0,
    error: null,
    createdAt: new Date().toISOString()
  };

  archiveJobs.set(job.id, job);
  setTimeout(() => processArchiveJob(job), 25);
  return res.status(202).json({ job: archiveJobResponse(job) });
});

app.get("/tasks/archive-jobs/:id", (req, res) => {
  const job = archiveJobs.get(Number(req.params.id));

  if (!job) {
    return res.status(404).json({ error: "Archive job not found." });
  }

  return res.json({ job: archiveJobResponse(job) });
});

app.patch("/tasks/:id/complete", (req, res) => {
  const task = tasks.find((item) => item.id === Number(req.params.id));

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  task.completed = true;
  invalidateTaskLists(["all", statusFor(task)]);
  return res.json({ success: true, task });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ error: "The request could not be completed." });
});

app.listen(PORT, () => {
  console.log(`Taskboard running on http://localhost:${PORT}`);
});
