import './style.css'
import { createAuthClient } from 'better-auth/client'

type Todo = {
  id: string
  text: string
  completed: boolean
}

type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
}

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
})

let todos: Todo[] = []
let currentUser: SessionUser | null = null
let isSaving = false
let isAuthLoading = false
let authMode: 'login' | 'signup' = 'login'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="todo-app" aria-labelledby="app-title">
    <header class="app-header">
      <div>
        <p class="eyebrow">Postgres list</p>
        <h1 id="app-title">Todos</h1>
      </div>
      <div class="auth-panel" aria-live="polite">
        <form class="auth-form" id="auth-form">
          <label class="sr-only" for="email-input">Email</label>
          <input
            id="email-input"
            name="email"
            type="email"
            placeholder="Email"
            autocomplete="email"
            required
          />
          <label class="sr-only" for="password-input">Password</label>
          <input
            id="password-input"
            name="password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            required
          />
          <button id="auth-submit" type="submit">Log in</button>
          <button class="secondary-button" id="toggle-auth-mode" type="button">
            Create account
          </button>
        </form>
        <div class="user-panel" id="user-panel" hidden>
          <span id="user-label"></span>
          <button id="sign-out" type="button">Sign out</button>
        </div>
      </div>
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
const authForm = document.querySelector<HTMLFormElement>('#auth-form')!
const input = document.querySelector<HTMLInputElement>('#todo-input')!
const emailInput = document.querySelector<HTMLInputElement>('#email-input')!
const passwordInput = document.querySelector<HTMLInputElement>('#password-input')!
const addButton = document.querySelector<HTMLButtonElement>('.todo-form button')!
const authSubmitButton = document.querySelector<HTMLButtonElement>('#auth-submit')!
const toggleAuthModeButton = document.querySelector<HTMLButtonElement>('#toggle-auth-mode')!
const list = document.querySelector<HTMLUListElement>('#todo-list')!
const emptyState = document.querySelector<HTMLParagraphElement>('#empty-state')!
const errorState = document.querySelector<HTMLParagraphElement>('#error-state')!
const todoCount = document.querySelector<HTMLSpanElement>('#todo-count')!
const clearCompleted = document.querySelector<HTMLButtonElement>('#clear-completed')!
const userPanel = document.querySelector<HTMLDivElement>('#user-panel')!
const userLabel = document.querySelector<HTMLSpanElement>('#user-label')!
const signOutButton = document.querySelector<HTMLButtonElement>('#sign-out')!

authForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = emailInput.value.trim()
  const password = passwordInput.value
  if (!email || !password || isAuthLoading) return

  await saveAuthChange(async () => {
    if (authMode === 'login') {
      const { error } = await authClient.signIn.email({ email, password, rememberMe: true })
      if (error) throw new Error(error.message ?? 'Sign in failed')
    } else {
      const { error } = await authClient.signUp.email({ email, password, name: email })
      if (error) throw new Error(error.message ?? 'Sign up failed')
    }

    passwordInput.value = ''
    await refreshSession()
    await loadTodos()
  })
})

toggleAuthModeButton.addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login'
  setError('')
  render()
})

signOutButton.addEventListener('click', async () => {
  if (isAuthLoading) return

  await saveAuthChange(async () => {
    await authClient.signOut()
    currentUser = null
    todos = []
  })
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const text = input.value.trim()
  if (!text || isSaving) return

  await saveChange(async () => {
    const todo = await requestTodo<Todo>('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })

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
      const todo = await requestTodo<Todo>(`/api/todos?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: checkbox.checked }),
      })

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
      await requestJson(`/api/todos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
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
      await requestJson('/api/todos?completed=true', {
        method: 'DELETE',
      })
    },
    () => {
      todos = previousTodos
    },
  )
})

async function loadTodos() {
  setError('')

  if (!currentUser) {
    todos = []
    render()
    return
  }

  try {
    const data = await requestJson<{ todos: Todo[] }>('/api/todos')
    todos = data.todos
  } catch (error) {
    setError((error as Error).message)
  } finally {
    render()
  }
}

async function saveChange(change: () => Promise<void>, rollback?: () => void) {
  isSaving = true
  setError('')
  render()

  try {
    await change()
  } catch (error) {
    rollback?.()
    setError((error as Error).message)
  } finally {
    isSaving = false
    render()
  }
}

async function saveAuthChange(change: () => Promise<void>) {
  isAuthLoading = true
  setError('')
  render()

  try {
    await change()
  } catch (error) {
    setError((error as Error).message)
  } finally {
    isAuthLoading = false
    render()
  }
}

async function refreshSession() {
  const { data } = await authClient.getSession()
  currentUser = (data?.user as SessionUser | undefined) ?? null
}

function render() {
  list.innerHTML = todos.map(createTodoMarkup).join('')

  const remaining = todos.filter((todo) => !todo.completed).length
  todoCount.textContent = `${remaining} ${remaining === 1 ? 'item' : 'items'} left`
  emptyState.textContent = getEmptyStateText()
  emptyState.hidden = todos.length > 0
  clearCompleted.disabled = isSaving || !currentUser || !todos.some((todo) => todo.completed)
  addButton.disabled = isSaving || !currentUser
  input.disabled = isSaving || !currentUser
  input.placeholder = currentUser ? 'What needs to be done?' : 'Log in to manage todos'
  authForm.hidden = Boolean(currentUser)
  userPanel.hidden = !currentUser
  userLabel.textContent = currentUser?.email ?? currentUser?.name ?? 'Signed in'
  authSubmitButton.textContent = authMode === 'login' ? 'Log in' : 'Sign up'
  toggleAuthModeButton.textContent =
    authMode === 'login' ? 'Create account' : 'Use existing account'
  passwordInput.autocomplete = authMode === 'login' ? 'current-password' : 'new-password'
  authSubmitButton.disabled = isAuthLoading
  toggleAuthModeButton.disabled = isAuthLoading
  emailInput.disabled = isAuthLoading
  passwordInput.disabled = isAuthLoading
  signOutButton.disabled = isAuthLoading
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

async function requestTodo<TodoResponse>(url: string, init?: RequestInit) {
  const data = await requestJson<{ todo: TodoResponse }>(url, init)
  return data.todo
}

async function requestJson<TResponse>(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) return undefined as TResponse

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed')
  }

  return data as TResponse
}

function getEmptyStateText() {
  if (!errorState.hidden) return 'Unable to load todos.'
  return currentUser ? 'No todos yet.' : 'Log in to load your todos.'
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

await saveAuthChange(async () => {
  await refreshSession()
  await loadTodos()
})
