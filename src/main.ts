import './style.css'
import { api } from './lib/eden'

type Todo = {
  id: string
  text: string
  completed: boolean
}

let todos: Todo[] = []
let isSaving = false

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="todo-app" aria-labelledby="app-title">
    <header class="app-header">
      <p class="eyebrow">Postgres list</p>
      <h1 id="app-title">Todos</h1>
    </header>

    <form class="todo-form" id="todo-form">
      <label class="sr-only" for="todo-input">New todo</label>
      <input
        id="todo-input"
        name="todo"
        type="text"
        placeholder="What needs to be done?"
        autocomplete="off"
      />
      <button type="submit">Add</button>
    </form>

    <section class="todo-panel" aria-label="Todo list">
      <ul class="todo-list" id="todo-list"></ul>
      <p class="empty-state" id="empty-state">Loading todos...</p>
    </section>

    <p class="error-state" id="error-state" role="alert" hidden></p>

    <footer class="todo-footer">
      <span id="todo-count">0 items left</span>
      <button id="clear-completed" type="button">Clear completed</button>
    </footer>
  </main>
`

const form = document.querySelector<HTMLFormElement>('#todo-form')!
const input = document.querySelector<HTMLInputElement>('#todo-input')!
const addButton = document.querySelector<HTMLButtonElement>('.todo-form button')!
const list = document.querySelector<HTMLUListElement>('#todo-list')!
const emptyState = document.querySelector<HTMLParagraphElement>('#empty-state')!
const errorState = document.querySelector<HTMLParagraphElement>('#error-state')!
const todoCount = document.querySelector<HTMLSpanElement>('#todo-count')!
const clearCompleted = document.querySelector<HTMLButtonElement>('#clear-completed')!

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const text = input.value.trim()
  if (!text || isSaving) return

  await saveChange(async () => {
    const todo = await readTodo(api.post({ text }))

    todos = [...todos, todo]
    input.value = ''
  })
})

list.addEventListener('change', async (event) => {
  const checkbox = event.target
  if (!(checkbox instanceof HTMLInputElement) || isSaving) return

  const id = checkbox.dataset.id
  if (!id) return

  const previousTodos = todos
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: checkbox.checked } : todo,
  )
  render()

  await saveChange(
    async () => {
      const todo = await readTodo(
        api.patch(
          { completed: checkbox.checked },
          { query: { id } },
        ),
      )

      todos = todos.map((item) => (item.id === todo.id ? todo : item))
    },
    () => {
      todos = previousTodos
    },
  )
})

list.addEventListener('click', async (event) => {
  const button = event.target
  if (!(button instanceof HTMLButtonElement) || isSaving) return

  const id = button.dataset.id
  if (!id) return

  const previousTodos = todos
  todos = todos.filter((todo) => todo.id !== id)
  render()

  await saveChange(
    async () => {
      await readEden(api.delete(null, { query: { id } }))
    },
    () => {
      todos = previousTodos
    },
  )
})

clearCompleted.addEventListener('click', async () => {
  if (isSaving) return

  const previousTodos = todos
  todos = todos.filter((todo) => !todo.completed)
  render()

  await saveChange(
    async () => {
      await readEden(api.delete(null, { query: { completed: 'true' } }))
    },
    () => {
      todos = previousTodos
    },
  )
})

async function loadTodos() {
  setError('')

  try {
    todos = await readTodos(api.get())
  } catch (error) {
    setError((error as Error).message)
  } finally {
    render()
  }
}

async function saveChange(change: () => Promise<void>, rollback?: () => void) {
  setSaving(true)
  setError('')
  render()

  try {
    await change()
  } catch (error) {
    rollback?.()
    setError((error as Error).message)
  } finally {
    setSaving(false)
    render()
  }
}

function render() {
  list.innerHTML = todos.map(createTodoMarkup).join('')

  const remaining = todos.filter((todo) => !todo.completed).length
  todoCount.textContent = `${remaining} ${remaining === 1 ? 'item' : 'items'} left`
  emptyState.textContent = errorState.hidden ? 'No todos yet.' : 'Unable to load todos.'
  emptyState.hidden = todos.length > 0
  clearCompleted.disabled = isSaving || !todos.some((todo) => todo.completed)
  addButton.disabled = isSaving
  input.disabled = isSaving
}

function setSaving(value: boolean) {
  isSaving = value
}

function setError(message: string) {
  errorState.textContent = message
  errorState.hidden = !message
}

function createTodoMarkup(todo: Todo) {
  return `
    <li class="todo-item ${todo.completed ? 'is-completed' : ''}">
      <label>
        <input
          type="checkbox"
          data-id="${todo.id}"
          ${todo.completed ? 'checked' : ''}
          ${isSaving ? 'disabled' : ''}
        />
        <span>${escapeHtml(todo.text)}</span>
      </label>
      <button
        type="button"
        data-id="${todo.id}"
        aria-label="Delete ${escapeHtml(todo.text)}"
        ${isSaving ? 'disabled' : ''}
      >
        Delete
      </button>
    </li>
  `
}

async function readTodo<TResponse extends Promise<{ data: unknown; error: unknown }>>(
  response: TResponse,
) {
  const data = await readEden(response)
  const todo = data && typeof data === 'object' && 'todo' in data ? data.todo : null
  if (!isTodo(todo)) {
    throw new Error('Request failed')
  }

  return todo
}

async function readTodos<TResponse extends Promise<{ data: unknown; error: unknown }>>(
  response: TResponse,
) {
  const data = await readEden(response)
  const nextTodos =
    data && typeof data === 'object' && 'todos' in data ? data.todos : null

  if (!Array.isArray(nextTodos) || !nextTodos.every(isTodo)) {
    throw new Error('Request failed')
  }

  return nextTodos
}

async function readEden<TResponse extends Promise<{ data: unknown; error: unknown }>>(
  response: TResponse,
): Promise<NonNullable<Awaited<TResponse>['data']>> {
  const { data, error } = await response
  if (error) {
    const value =
      typeof error === 'object' && error && 'value' in error ? error.value : null

    if (value && typeof value === 'object' && 'error' in value) {
      throw new Error(String(value.error))
    }

    throw new Error('Request failed')
  }

  return data as NonNullable<Awaited<TResponse>['data']>
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== 'object') return false

  const todo = value as Record<string, unknown>
  return (
    typeof todo.id === 'string' &&
    typeof todo.text === 'string' &&
    typeof todo.completed === 'boolean'
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    return entities[char]
  })
}

loadTodos()
