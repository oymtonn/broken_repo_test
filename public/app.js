const form = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const priorityInput = document.querySelector("#task-priority");
const dueDateInput = document.querySelector("#task-due-date");
const addButton = document.querySelector("#add-task-button");
const formMessage = document.querySelector("#form-message");
const taskList = document.querySelector("#task-list");
const visibleCount = document.querySelector("#visible-count");
const currentFilterLabel = document.querySelector("#current-filter-label");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const taskTemplate = document.querySelector("#task-template");
const archiveButton = document.querySelector("#archive-completed");
const taskStatus = document.querySelector("#task-status");

let currentFilter = "all";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric"
}).format(new Date());

function setDefaultDueDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dueDateInput.value = tomorrow.toISOString().slice(0, 10);
}

function formatDueDate(value) {
  return `Due ${dateFormatter.format(new Date(`${value}T00:00:00Z`))}`;
}

function showEmptyState() {
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.innerHTML = `<strong>No ${currentFilter === "all" ? "" : `${currentFilter} `}tasks</strong><span>Tasks in this view will appear here.</span>`;
  taskList.append(emptyState);
}

function renderTask(task) {
  const row = taskTemplate.content.firstElementChild.cloneNode(true);
  const title = row.querySelector(".task-title");
  const priority = row.querySelector(".priority-badge");
  const dueDate = row.querySelector(".due-date");
  const completeButton = row.querySelector("[data-testid='complete-task']");

  row.dataset.taskId = task.id;
  title.textContent = task.title;
  priority.textContent = task.priority;
  priority.classList.add(`priority-${task.priority}`);
  dueDate.textContent = formatDueDate(task.dueDate);

  if (task.completed) {
    row.classList.add("completed");
    completeButton.textContent = "Completed";
    completeButton.disabled = true;
  } else {
    completeButton.addEventListener("click", () => completeTask(task.id, row));
  }

  taskList.append(row);
}

async function loadTasks() {
  taskList.classList.add("loading");

  try {
    const response = await fetch(`/tasks?status=${currentFilter}`);
    if (!response.ok) throw new Error("Unable to load tasks");

    const data = await response.json();
    taskList.replaceChildren();
    data.tasks.forEach(renderTask);
    visibleCount.textContent = data.count;

    if (data.tasks.length === 0) showEmptyState();
  } catch (error) {
    taskList.innerHTML = '<div class="empty-state error"><strong>Tasks could not be loaded</strong><span>Refresh the page to try again.</span></div>';
    visibleCount.textContent = "0";
  } finally {
    taskList.classList.remove("loading");
  }
}

async function completeTask(taskId, row) {
  const button = row.querySelector("[data-testid='complete-task']");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const response = await fetch(`/tasks/${taskId}/complete`, { method: "PATCH" });
    if (!response.ok) throw new Error("Unable to complete task");

    row.classList.add("completed");
    button.textContent = "Completed";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Mark complete";
    formMessage.textContent = "Could not update the task.";
    formMessage.className = "form-message error";
  }
}

async function pollArchiveJob(jobId, attempt = 0) {
  const response = await fetch(`/tasks/archive-jobs/${jobId}`);
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Could not check archive status");

  if (data.job.status === "completed") {
    taskStatus.textContent = `${data.job.archivedCount} tasks archived`;
    taskStatus.className = "success";
    await loadTasks();
    return;
  }

  if (data.job.status === "failed") {
    taskStatus.textContent = "Archive failed after processing tasks";
    taskStatus.className = "error";
    await loadTasks();
    throw new Error(data.job.error || "Archive processing failed");
  }

  if (attempt >= 20) {
    taskStatus.textContent = "Archive is taking too long";
    taskStatus.className = "error";
    throw new Error("Archive job timed out");
  }

  setTimeout(() => pollArchiveJob(jobId, attempt + 1), 150);
}

async function archiveCompletedTasks() {
  archiveButton.disabled = true;
  archiveButton.textContent = "Archiving...";
  taskStatus.textContent = "Starting archive...";
  taskStatus.className = "";

  try {
    const response = await fetch("/tasks/archive-completed", { method: "POST" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not archive completed tasks");

    taskStatus.textContent = `Archive job ${data.job.id} queued`;
    await pollArchiveJob(data.job.id);
  } catch (error) {
    taskStatus.textContent = error.message;
    taskStatus.className = "error";
  } finally {
    archiveButton.disabled = false;
    archiveButton.textContent = "Archive completed";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  addButton.disabled = true;
  addButton.textContent = "Adding...";
  formMessage.textContent = "";

  try {
    const response = await fetch("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleInput.value,
        priority: priorityInput.value,
        dueDate: dueDateInput.value
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to add task");

    form.reset();
    setDefaultDueDate();
    titleInput.focus();
    formMessage.textContent = "Task added.";
    formMessage.className = "form-message success";
    await loadTasks();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = "form-message error";
  } finally {
    addButton.disabled = false;
    addButton.textContent = "Add task";
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    currentFilterLabel.textContent = `Showing ${currentFilter} tasks`;
    loadTasks();
  });
});

archiveButton.addEventListener("click", archiveCompletedTasks);

setDefaultDueDate();
loadTasks();
