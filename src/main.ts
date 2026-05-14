import './style.css'

type Session = {
  user: {
    id: string
    name?: string
    email: string
  }
}

type Todo = {
  id: string
  text: string
  completed: boolean
}

type AuthMode = 'sign-in' | 'sign-up'

let session: Session | null = null
let todos: Todo[] = []
let isSaving = false
let authMode: AuthMode = 'sign-in'
let filter: 'all' | 'active' | 'completed' = 'all'
let editingId: string | null = null

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="todo-app" aria-labelledby="app-title">
    <header class="app-header">
      <div>
        <p class="eyebrow">Postgres list</p>
        <h1 id="app-title">Todos</h1>
      </div>
      <button id="sign-out" class="secondary-button" type="button" hidden>Sign out</button>
    </header>

    <section class="auth-panel" id="auth-panel" aria-label="Account">
      <div class="auth-tabs" role="tablist" aria-label="Auth mode">
        <button id="sign-in-tab" type="button" aria-selected="true">Sign in</button>
        <button id="sign-up-tab" type="button" aria-selected="false">Sign up</button>
      </div>
      <form class="auth-form" id="auth-form">
        <label>
          <span>Email</span>
          <input id="auth-email" name="email" type="email" autocomplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <input
            id="auth-password"
            name="password"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
          />
        </label>
        <button id="auth-submit" type="submit">Sign in</button>
      </form>
    </section>

    <p class="signed-in-state" id="signed-in-state" hidden></p>

    <form class="todo-form" id="todo-form">
      <button id="toggle-all" type="button" aria-label="Toggle all">❯</button>
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
      <div class="filters" id="filters">
        <button type="button" data-filter="all">All</button>
        <button type="button" data-filter="active">Active</button>
        <button type="button" data-filter="completed">Completed</button>
      </div>
      <button id="clear-completed" type="button">Clear completed</button>
    </footer>
  </main>
`

const form = document.querySelector<HTMLFormElement>('#todo-form')!
const input = document.querySelector<HTMLInputElement>('#todo-input')!
const addButton = document.querySelector<HTMLButtonElement>('.todo-form button[type="submit"]')!
const toggleAllButton = document.querySelector<HTMLButtonElement>('#toggle-all')!
const authPanel = document.querySelector<HTMLElement>('#auth-panel')!
const authForm = document.querySelector<HTMLFormElement>('#auth-form')!
const authEmail = document.querySelector<HTMLInputElement>('#auth-email')!
const authPassword = document.querySelector<HTMLInputElement>('#auth-password')!
const authSubmit = document.querySelector<HTMLButtonElement>('#auth-submit')!
const signInTab = document.querySelector<HTMLButtonElement>('#sign-in-tab')!
const signUpTab = document.querySelector<HTMLButtonElement>('#sign-up-tab')!
const signOutButton = document.querySelector<HTMLButtonElement>('#sign-out')!
const signedInState = document.querySelector<HTMLParagraphElement>('#signed-in-state')!
const list = document.querySelector<HTMLUListElement>('#todo-list')!
const emptyState = document.querySelector<HTMLParagraphElement>('#empty-state')!
const errorState = document.querySelector<HTMLParagraphElement>('#error-state')!
const todoCount = document.querySelector<HTMLSpanElement>('#todo-count')!
const clearCompleted = document.querySelector<HTMLButtonElement>('#clear-completed')!
const filters = document.querySelector<HTMLDivElement>('#filters')!

authForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (isSaving) return

  const email = authEmail.value.trim()
  const password = authPassword.value
  if (!email || !password) return

  await saveChange(async () => {
    const path =
      authMode === 'sign-in' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email'
    const body =
      authMode === 'sign-in'
        ? { email, password }
        : { email, password, name: email.split('@')[0] || email }

    await requestJson(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    authPassword.value = ''
    await loadSession()
  })
})

signInTab.addEventListener('click', () => setAuthMode('sign-in'))
signUpTab.addEventListener('click', () => setAuthMode('sign-up'))

signOutButton.addEventListener('click', async () => {
  if (isSaving) return

  await saveChange(async () => {
    await requestJson('/api/auth/sign-out', {
      method: 'POST',
    })
    session = null
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

toggleAllButton.addEventListener('click', async () => {
  if (isSaving) return

  const nextCompleted = !todos.every((todo) => todo.completed)
  const previousTodos = todos
  todos = todos.map((todo) => ({ ...todo, completed: nextCompleted }))
  render()

  await saveChange(
    async () => {
      const data = await requestJson<{ todos: Todo[] }>('/api/todos', {
        method: 'PATCH',
        body: JSON.stringify({ all: true, completed: nextCompleted }),
      })
      todos = data.todos
    },
    () => {
      todos = previousTodos
    },
  )
})

filters.addEventListener('click', (event) => {
  const button = event.target
  if (!(button instanceof HTMLButtonElement)) return

  const next = button.dataset.filter
  if (next !== 'all' && next !== 'active' && next !== 'completed') return
  filter = next
  render()
})

list.addEventListener('dblclick', (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement) || isSaving) return

  const id = target.dataset.editId
  if (!id) return
  editingId = id
  render()
  document.querySelector<HTMLInputElement>(`[data-edit-input="${CSS.escape(id)}"]`)?.focus()
})

list.addEventListener('focusout', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return

  const id = target.dataset.editInput
  if (!id) return
  await commitEdit(id, target.value)
})

list.addEventListener('keydown', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return

  const id = target.dataset.editInput
  if (!id) return

  if (event.key === 'Enter') {
    event.preventDefault()
    await commitEdit(id, target.value)
  }

  if (event.key === 'Escape') {
    editingId = null
    render()
  }
})

async function loadTodos() {
  setError('')

  if (!session) {
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

async function loadSession() {
  setError('')

  try {
    const data = await requestJson<Session | null>('/api/auth/get-session')
    session = data
  } catch {
    session = null
  }

  await loadTodos()
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
  const visibleTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  list.innerHTML = visibleTodos.map(createTodoMarkup).join('')

  authPanel.hidden = Boolean(session)
  signOutButton.hidden = !session
  signedInState.hidden = !session
  signedInState.textContent = session ? `Signed in as ${session.user.email}` : ''

  const remaining = todos.filter((todo) => !todo.completed).length
  todoCount.textContent = `${remaining} ${remaining === 1 ? 'item' : 'items'} left`
  emptyState.textContent = getEmptyStateText()
  emptyState.hidden = todos.length > 0
  clearCompleted.disabled = isSaving || !todos.some((todo) => todo.completed)
  toggleAllButton.disabled = isSaving || !session || todos.length === 0
  addButton.disabled = isSaving || !session
  input.disabled = isSaving || !session
  form.hidden = !session
  clearCompleted.hidden = !session
  filters.hidden = !session
  filters.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === filter)
  })
  authSubmit.disabled = isSaving
  signOutButton.disabled = isSaving
}

function setSaving(value: boolean) {
  isSaving = value
}

function setError(message: string) {
  errorState.textContent = message
  errorState.hidden = !message
}

function setAuthMode(mode: AuthMode) {
  authMode = mode
  signInTab.setAttribute('aria-selected', String(mode === 'sign-in'))
  signUpTab.setAttribute('aria-selected', String(mode === 'sign-up'))
  authSubmit.textContent = mode === 'sign-in' ? 'Sign in' : 'Create account'
  authPassword.autocomplete =
    mode === 'sign-in' ? 'current-password' : 'new-password'
}

function getEmptyStateText() {
  if (!errorState.hidden) return 'Unable to load todos.'
  if (!session) return 'Sign in to load your todos.'
  return 'No todos yet.'
}

function createTodoMarkup(todo: Todo) {
  const text = escapeHtml(todo.text)
  return `
    <li class="todo-item ${todo.completed ? 'is-completed' : ''}">
      <label>
        <input
          type="checkbox"
          data-id="${todo.id}"
          ${todo.completed ? 'checked' : ''}
          ${isSaving ? 'disabled' : ''}
        />
        ${
          editingId === todo.id
            ? `<input class="edit-input" data-edit-input="${todo.id}" value="${text}" />`
            : `<span data-edit-id="${todo.id}">${text}</span>`
        }
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

async function commitEdit(id: string, value: string) {
  if (editingId !== id || isSaving) return

  editingId = null
  const text = value.trim()
  if (!text) {
    const previousTodos = todos
    todos = todos.filter((todo) => todo.id !== id)
    render()
    await saveChange(
      async () => {
        await requestJson(`/api/todos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      },
      () => {
        todos = previousTodos
      },
    )
    return
  }

  const previousTodos = todos
  todos = todos.map((todo) => (todo.id === id ? { ...todo, text } : todo))
  render()
  await saveChange(
    async () => {
      const todo = await requestTodo<Todo>(`/api/todos?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
      })
      todos = todos.map((item) => (item.id === todo.id ? todo : item))
    },
    () => {
      todos = previousTodos
    },
  )
}

async function requestTodo<TodoResponse>(url: string, init?: RequestInit) {
  const data = await requestJson<{ todo: TodoResponse }>(url, init)
  return data.todo
}

async function requestJson<TResponse>(url: string, init?: RequestInit) {
  const response = await fetch(toApiUrl(url), {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (response.status === 204) return undefined as TResponse

  const data = await readJson(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data))
  }

  return data as TResponse
}

async function readJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function readErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') return 'Request failed'

  const record = data as Record<string, unknown>
  if (typeof record.error === 'string') return record.error
  if (typeof record.message === 'string') return record.message

  return 'Request failed'
}

function toApiUrl(path: string) {
  return new URL(path, window.location.origin).toString()
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

setAuthMode(authMode)
loadSession()
