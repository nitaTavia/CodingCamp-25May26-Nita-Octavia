# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application (SPA) built with plain HTML, CSS, and vanilla JavaScript. It requires no build tools, no framework, and no backend. All state is persisted in the browser's `localStorage`. Chart.js (loaded via CDN) powers the pie chart visualization.

The design follows a **module pattern** inside a single `js/script.js` file, organized into clearly separated concerns: storage, state management, UI rendering, chart management, and event handling. This keeps the codebase maintainable without introducing a module bundler.

### Key Design Goals

- **Zero dependencies beyond Chart.js** — no npm, no bundler, no framework.
- **Single source of truth** — an in-memory `state` object is the authoritative data store; the DOM is always derived from it.
- **Immutable-style updates** — state mutations always go through a `setState()` function that persists to `localStorage` and triggers a re-render.
- **Mobile-first CSS** — base styles target small screens; media queries add desktop layout at ≥768px.

---

## Architecture

The application is structured as a layered pipeline:

```
User Interaction
      │
      ▼
Event Handlers  (js/script.js — event layer)
      │
      ▼
State Manager   (js/script.js — state layer)
      │
      ├──► Storage Layer  (localStorage)
      │
      └──► Render Layer   (DOM + Chart.js)
```

### Data Flow

1. The user interacts with the UI (form submit, button click, select change).
2. An event handler validates input and calls a state-mutation function.
3. The state-mutation function updates the in-memory `state` object and writes it to `localStorage`.
4. After every state mutation, `renderAll()` is called to synchronize the DOM with the current state.

### Initialization Sequence

```
DOMContentLoaded
  └─► loadStateFromStorage()
  └─► applyTheme(state.theme)
  └─► renderAll()
        ├─► renderSummary()
        ├─► renderTransactionList()
        ├─► renderChart()
        └─► renderSpendingLimitWarning()
```

---

## Components and Interfaces

### 1. Storage Module

Responsible for reading and writing the application state to `localStorage`.

```js
// Key used for all app data
const STORAGE_KEY = 'expenseBudgetData';
const THEME_KEY   = 'theme';

function saveState(state) { ... }   // JSON.stringify → localStorage
function loadState()       { ... }  // localStorage → JSON.parse, returns default state on failure
```

Default state shape returned when nothing is stored:

```js
{
  transactions: [],   // Transaction[]
  spendingLimit: null // number | null
}
```

Theme is stored separately under `THEME_KEY` as the string `"dark"` or `"light"`.

---

### 2. State Manager

A single `state` object lives in module scope. All mutations go through `setState()`.

```js
let state = loadState();

function setState(updater) {
  state = updater(state);       // pure update
  saveState(state);             // persist
  renderAll();                  // sync DOM
}
```

Helper mutation functions:

| Function | Description |
|---|---|
| `addTransaction(tx)` | Appends a new transaction to `state.transactions` |
| `deleteTransaction(id)` | Removes a transaction by `id` |
| `setSpendingLimit(value)` | Sets `state.spendingLimit` |
| `setTheme(theme)` | Saves theme to `localStorage` under `THEME_KEY` |
| `setSortOrder(order)` | Sets `state.sortOrder` |

---

### 3. Form Component (Add Transaction)

HTML form with the following fields:

| Field | Element | Validation |
|---|---|---|
| Type | `<select>` | Required; values: `"income"`, `"expense"` |
| Category | `<select>` | Required; pre-defined list |
| Amount | `<input type="number">` | Required; 0.01 – 999,999,999.99 |
| Description | `<input type="text">` | Required; 1–100 chars, non-whitespace-only |

On submit:
1. `validateForm()` checks all fields and returns an array of errors.
2. If errors exist, `showFormErrors(errors)` renders inline error messages; the transaction is NOT saved.
3. If valid, a `Transaction` object is constructed and passed to `addTransaction()`.
4. The form is reset to its default state (type = "Expense", category = first option, amount and description cleared).

---

### 4. Transaction List Component

Rendered by `renderTransactionList()`. Reads `state.transactions`, applies the active sort order, and generates list items.

Each list item displays:
- Type badge (Income / Expense)
- Category label
- Amount (formatted, green for income, red for expense)
- Date (locale date string)
- Description
- Delete button

The container has `overflow-y: auto` with a `max-height` to enable scrolling when the list grows long.

When `state.transactions` is empty, a placeholder `<p>` is shown instead.

---

### 5. Summary Cards Component

Rendered by `renderSummary()`. Computes and displays:

| Card | Calculation |
|---|---|
| Total Income | Sum of all `income` transaction amounts |
| Total Expenses | Sum of all `expense` transaction amounts |
| Balance | Total Income − Total Expenses |

All values are formatted as `$X.XX` (two decimal places, currency symbol).

Balance card receives CSS class `balance--positive` (green) when ≥ 0, or `balance--negative` (red) when < 0.

---

### 6. Pie Chart Component

Rendered by `renderChart()` using Chart.js.

- A single `Chart` instance is created on first render and stored in a module-level variable `chartInstance`.
- On subsequent renders, `chartInstance.data` is updated and `chartInstance.update()` is called (avoids destroying and recreating the canvas context).
- When no expense transactions exist, the canvas is hidden (`display: none`) and a placeholder `<p>` is shown.
- Category colors are defined in a static `CATEGORY_COLORS` map in JavaScript so the same category always gets the same color.

```js
const CATEGORY_COLORS = {
  Food:        '#FF6384',
  Transport:   '#36A2EB',
  Housing:     '#FFCE56',
  Health:      '#4BC0C0',
  Entertainment: '#9966FF',
  Salary:      '#FF9F40',
  Other:       '#C9CBCF',
  // ...
};
```

---

### 7. Spending Limit Component

A dedicated input field and save button. On save:
1. Validates the value (positive number, 0.01 – 999,999,999).
2. Calls `setSpendingLimit(value)`.
3. Triggers `renderSpendingLimitWarning()`.

`renderSpendingLimitWarning()` computes the current month's total expenses and compares against `state.spendingLimit`:

| Condition | Banner |
|---|---|
| No limit set or limit = 0 | No banner |
| Expenses ≥ 80% and < 100% of limit | Warning banner (amber/yellow) |
| Expenses ≥ 100% of limit | Alert banner (red) |
| Expenses < 80% of limit | No banner |

---

### 8. Dark Mode Toggle

A `<button>` with an icon/label. On click:
1. Toggles `document.body`'s CSS class between `theme-light` and `theme-dark`.
2. Calls `setTheme(newTheme)` to persist.
3. Updates the Chart background color via `chartInstance.options.plugins.legend.labels.color` and calls `chartInstance.update()`.

On load, `applyTheme(state.theme)` reads the saved preference and applies the correct class.

---

### 9. Sort Control

A `<select>` element with four options:

| Value | Label |
|---|---|
| `newest` | Newest First |
| `oldest` | Oldest First |
| `amount-desc` | Amount (High to Low) |
| `amount-asc` | Amount (Low to High) |

`sortTransactions(transactions, order)` is a pure function that returns a sorted copy of the array. Tie-breaking rules:
- Equal dates → insertion order descending (original array index, reversed).
- Equal amounts → date descending.

The active sort option is stored in `state.sortOrder` (default: `"newest"`).

---

## Data Models

### Transaction

```js
{
  id:          string,   // crypto.randomUUID() or Date.now().toString()
  type:        'income' | 'expense',
  category:    string,   // one of the pre-defined categories
  amount:      number,   // positive float, max 2 decimal places
  description: string,   // 1–100 chars
  date:        string,   // ISO 8601 date string (new Date().toISOString())
}
```

### AppState

```js
{
  transactions: Transaction[],
  spendingLimit: number | null,
  sortOrder: 'newest' | 'oldest' | 'amount-desc' | 'amount-asc',
}
```

### Theme (stored separately)

```
localStorage['theme'] = 'light' | 'dark'
```

---

### Pre-defined Categories

```js
const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Health',
  'Entertainment', 'Education', 'Shopping', 'Salary', 'Other'
];
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction is persisted and list grows

*For any* valid transaction (non-whitespace description of 1–100 chars, amount in [0.01, 999999999.99], valid type and category), after calling `addTransaction(tx)`, the transaction SHALL be present in `state.transactions`, retrievable via `loadState()`, and the list length SHALL be exactly one greater than before the addition.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Invalid transaction is rejected

*For any* transaction input where the description is whitespace-only or empty, the amount is outside [0.01, 999999999.99] or non-numeric, or a required field is missing, `validateForm()` SHALL return at least one error and `state.transactions` SHALL remain unchanged.

**Validates: Requirements 1.3**

---

### Property 3: Balance invariant

*For any* list of transactions, `computeSummary(transactions)` SHALL return a Balance that equals the sum of all income amounts minus the sum of all expense amounts, a total income equal to the sum of all income amounts, and a total expenses equal to the sum of all expense amounts — regardless of the order in which transactions were added or deleted.

**Validates: Requirements 1.5, 2.5, 3.1, 3.2**

---

### Property 4: Delete removes exactly one transaction

*For any* transaction list and any transaction `id` present in that list, after calling `deleteTransaction(id)`, the resulting `state.transactions` SHALL contain exactly one fewer item, SHALL NOT contain any transaction with that `id`, and all other transactions SHALL be unchanged.

**Validates: Requirements 2.3**

---

### Property 5: Sort correctness and stability

*For any* list of transactions and any valid sort order (`newest`, `oldest`, `amount-desc`, `amount-asc`), `sortTransactions(transactions, order)` SHALL return a permutation of the original list (same elements, no additions or removals) where every adjacent pair satisfies the ordering predicate for that sort option, with tie-breaking applied consistently (equal dates → insertion order descending; equal amounts → date descending).

**Validates: Requirements 8.2, 8.5**

---

### Property 6: Spending limit warning threshold

*For any* positive spending limit `L` and any total monthly expense amount `E`, `computeSpendingWarning(E, L)` SHALL return:
- `'none'` when `E < 0.8 * L`
- `'warning'` when `0.8 * L ≤ E < L`
- `'alert'` when `E ≥ L`

**Validates: Requirements 9.5, 9.6, 9.8**

---

### Property 7: Theme persistence round-trip

*For any* theme value (`"light"` or `"dark"`), calling `setTheme(theme)` followed by `loadTheme()` SHALL return the same value that was set, and `applyTheme(theme)` SHALL add the corresponding CSS class to `document.body` and remove the other.

**Validates: Requirements 7.4, 7.5, 7.6**

---

### Property 8: Spending limit persistence round-trip

*For any* valid spending limit value `v` in [0.01, 999999999], calling `setSpendingLimit(v)` and then `loadState()` SHALL return a state object whose `spendingLimit` equals `v`.

**Validates: Requirements 9.3, 9.4**

---

### Property 9: Chart data reflects expense transactions only

*For any* list of transactions, the chart data object produced by `buildChartData(transactions)` SHALL contain only entries for `expense`-type transactions grouped by category, and the sum of all segment values SHALL equal the total expenses returned by `computeSummary(transactions)`.

**Validates: Requirements 5.1, 5.2, 5.4**

---

### Property 10: Balance CSS class matches sign

*For any* list of transactions, after `renderSummary()` is called, the balance display element SHALL have the `balance--negative` CSS class if and only if the computed Balance is strictly negative, and the `balance--positive` CSS class if and only if the Balance is zero or positive — never both classes simultaneously.

**Validates: Requirements 3.3, 3.4**

---

### Property 11: Transaction list item renders all required fields with correct color class

*For any* transaction, the DOM element produced by `renderTransactionItem(tx)` SHALL contain the transaction's type, category, amount formatted as `$X.XX`, date in locale format, and description — and SHALL apply the `amount--income` CSS class for income transactions and the `amount--expense` CSS class for expense transactions.

**Validates: Requirements 4.1, 4.2**

---

### Property 12: Invalid spending limit is rejected

*For any* spending limit input that is non-numeric, zero, or negative, `validateSpendingLimit(value)` SHALL return an error and `state.spendingLimit` SHALL remain unchanged.

**Validates: Requirements 9.2**

---

## Error Handling

### Form Validation Errors

- Inline error messages are rendered adjacent to each invalid field.
- Errors are cleared on the next valid submission or when the field value changes.
- The form is never submitted (no page reload) — all validation is client-side.

### localStorage Failures

- `saveState()` is wrapped in a `try/catch`. If `localStorage.setItem` throws (e.g., storage quota exceeded), the app displays a non-blocking toast notification: "Could not save data. Storage may be full."
- `loadState()` is wrapped in a `try/catch`. If parsing fails (corrupted data), it returns the default empty state and logs a warning to the console.
- For delete operations specifically: if `saveState()` throws after a delete, the transaction is re-inserted into the in-memory state and the Transaction_List is re-rendered to reflect the rollback (Requirement 2.4).

### Chart.js Initialization

- If `Chart` is not available (CDN load failure), the chart container displays a static error message: "Chart could not be loaded."
- The rest of the app continues to function normally without the chart.

### Invalid Spending Limit Input

- Non-numeric, zero, or negative values trigger an inline validation error on the spending limit field.
- The previous valid limit (or null) is preserved in state.

---

## Testing Strategy

### Unit Tests

Unit tests cover pure functions that have no DOM or `localStorage` dependencies:

| Function | What to test |
|---|---|
| `validateForm(formData)` | Valid inputs pass; each invalid case returns the correct error |
| `computeSummary(transactions)` | Correct balance, income, expense totals for various transaction sets |
| `sortTransactions(transactions, order)` | All four sort orders; tie-breaking rules |
| `computeSpendingWarning(expenses, limit)` | All threshold bands; null/zero limit returns no-warning |
| `formatCurrency(amount)` | Correct `$X.XX` formatting for edge values (0, negative, large numbers) |

### Property-Based Tests

Property-based testing is appropriate here because the core logic functions (`computeSummary`, `sortTransactions`, `computeSpendingWarning`, `validateForm`, and the storage round-trip) are pure functions whose correctness must hold across a wide input space. The recommended library is **fast-check** (JavaScript).

Each property test runs a minimum of **100 iterations**.

Tag format: `Feature: expense-budget-visualizer, Property {N}: {property_text}`

| Property | Test Description |
|---|---|
| Property 1 | Generate random valid transactions; verify `addTransaction` + `loadState` round-trip and list length grows by 1 |
| Property 2 | Generate random invalid form inputs (whitespace descriptions, out-of-range amounts, missing fields); verify `validateForm` returns ≥1 error and state is unchanged |
| Property 3 | Generate random transaction lists; verify `computeSummary` balance, income, and expense totals are always correct |
| Property 4 | Generate random transaction lists + random id; verify `deleteTransaction` removes exactly one and leaves others unchanged |
| Property 5 | Generate random transaction lists; verify `sortTransactions` returns a valid permutation satisfying the ordering predicate with correct tie-breaking for all four sort orders |
| Property 6 | Generate random (limit, expense) pairs; verify `computeSpendingWarning` returns correct threshold band (`none`, `warning`, `alert`) |
| Property 7 | For each theme value; verify `setTheme`/`loadTheme` round-trip and `applyTheme` applies correct CSS class |
| Property 8 | Generate random valid spending limits; verify `setSpendingLimit`/`loadState` round-trip |
| Property 9 | Generate random transaction lists; verify `buildChartData` contains only expense entries and sums match `computeSummary` expense total |
| Property 10 | Generate transaction sets with positive, zero, and negative balances; verify correct CSS class is applied to balance element |
| Property 11 | Generate random transactions of both types; verify rendered item contains all required fields and correct color class |
| Property 12 | Generate random invalid spending limit values (non-numeric, zero, negative); verify `validateSpendingLimit` returns error and state is unchanged |

### Integration / Smoke Tests

- **App loads without errors** on an empty `localStorage` state (smoke test).
- **Dark mode persists across page reload** — set dark mode, reload, verify class is applied.
- **Transactions survive reload** — add transactions, reload, verify they appear in the list.
- **Chart renders correctly** after adding expense transactions of multiple categories.

### Manual / Visual Tests

- Responsive layout at 320px, 768px, 1280px, and 2560px viewport widths.
- Touch target sizes on a mobile device or emulator.
- Dark mode visual appearance across all UI components.
- Chart.js CDN failure fallback message.
