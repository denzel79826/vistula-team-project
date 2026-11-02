let table;  
let db; 

/* ---------- Elements ---------- */
const list = document.querySelector(".tasks");
const dialog = document.getElementById("task-dialog");
const form = document.getElementById("task-form");
const heading = document.getElementById("dialog-heading");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const submitBtn = document.getElementById("task-submit");
const cancelBtn = document.getElementById("task-cancel");
const openBtn = document.getElementById("open-form");

// Delete-confirmation popup
const confirmDialog = document.getElementById("confirm-dialog");
const confirmMessage = document.getElementById("confirm-message");
const confirmDeleteBtn = document.getElementById("confirm-delete");
const confirmCancelBtn = document.getElementById("confirm-cancel");

let tasks = [];
let editingId = null;       
let pendingDeleteId = null; 



async function init() {
  try {
    const response = await fetch("config.json");
    if (!response.ok) throw new Error("Failed to load config.json");
    const config = await response.json();
    table = config.TABLE_NAME; 
    db = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    loadTasks(); // <-- This is the correct place to call it!
  } catch (error) {
    showError("Could not initialize the application configuration.", error);
  }
}

init();


function showError(message, error) {
  console.error(message, error);
  alert(message);
}

/* ---------- Database ---------- */
async function loadTasks() {
  const { data, error } = await db.from(table).select("*");
  if (error) {
    showError("Could not load tasks.", error);
    return;
  }
  tasks = data;
  render();
}

async function createTask(title, description) {
  const { data, error } = await db
    .from(table)
    .insert({ title, description, completed: false })
    .select()
    .single();
  if (error) throw error;
  tasks.push(data);
}

async function updateTask(id, changes) {
  const numericId = Number(id);
  const { data, error } = await db
    .from(table)
    .update(changes)
    .eq("id", numericId)
    .select();

  if (error) throw error;
  const updatedTask = data && data.length > 0 ? data[0] : { id: numericId, ...changes };
  tasks = tasks.map((t) => (t.id === numericId ? updatedTask : t));
}

async function deleteTask(id) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
  tasks = tasks.filter((t) => t.id !== id);
}

/* ---------- Rendering ---------- */
function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item" + (task.completed ? " completed" : "");
  li.dataset.id = task.id;

  const info = document.createElement("div");
  info.className = "task-info";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  info.append(title);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    info.append(description);
  }

  const status = document.createElement("span");
  status.className = "task-status";
  status.textContent = task.completed ? "Completed" : "Pending";
  info.append(status);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "toggle-task";
  toggleBtn.textContent = task.completed ? "Mark incomplete" : "Mark complete";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-task";
  editBtn.textContent = "Edit";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-task";
  deleteBtn.textContent = "Delete";

  actions.append(toggleBtn, editBtn, deleteBtn);
  li.append(info, actions);
  return li;
}

function render() {
  list.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No tasks yet. Add your first one!";
    list.append(empty);
    return;
  }

  tasks.forEach((task) => list.append(createTaskElement(task)));
}

/* ---------- Task modal (create / edit) ---------- */
function openCreateForm() {
  editingId = null;
  heading.textContent = "New task";
  submitBtn.textContent = "Add task";
  form.reset();
  dialog.showModal();
  titleInput.focus();
}

function openEditForm(task) {
  editingId = task.id;
  heading.textContent = "Edit task";
  submitBtn.textContent = "Save changes";
  titleInput.value = task.title;
  descriptionInput.value = task.description ?? "";
  dialog.showModal();
  titleInput.focus();
}

openBtn.addEventListener("click", openCreateForm);
cancelBtn.addEventListener("click", () => dialog.close());

// Click on the dark backdrop closes the modal
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// Runs however the dialog closes (Cancel, Esc, backdrop, submit)
dialog.addEventListener("close", () => {
  form.reset();
  editingId = null;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  if (!title) return;

  submitBtn.disabled = true;
  try {
    if (editingId === null) {
      await createTask(title, description);
    } else {
      await updateTask(editingId, { title, description });
    }
    render();
    dialog.close();
  } catch (error) {
    showError("Could not save the task.", error);
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Delete confirmation modal ---------- */
function openConfirmDelete(task) {
  pendingDeleteId = task.id;
  confirmMessage.textContent = `"${task.title}" will be permanently removed.`;
  confirmDialog.showModal();
}

confirmDeleteBtn.addEventListener("click", async () => {
  confirmDeleteBtn.disabled = true;
  try {
    await deleteTask(pendingDeleteId);
    render();
    confirmDialog.close();
  } catch (error) {
    showError("Could not delete the task.", error);
  } finally {
    confirmDeleteBtn.disabled = false;
  }
});

confirmCancelBtn.addEventListener("click", () => confirmDialog.close());

// Click on the backdrop closes it
confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) confirmDialog.close();
});

// Clear the pending id however the dialog closes (Cancel, Esc, backdrop, confirm)
confirmDialog.addEventListener("close", () => {
  pendingDeleteId = null;
});

/* ---------- Toggle / edit / delete buttons ---------- */
list.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const item = button.closest(".task-item");
  const id = Number(item.dataset.id); // <-- Convert string ID to a Number here!
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  if (button.classList.contains("toggle-task")) {
    try {
      await updateTask(id, { completed: !task.completed });
      render();
    } catch (error) {
      showError("Could not update the task.", error);
    }
  } else if (button.classList.contains("edit-task")) {
    openEditForm(task);
  } else if (button.classList.contains("delete-task")) {
    openConfirmDelete(task);
  }
});