# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side single-page application using plain HTML, a single `css/style.css` file, and a single `js/script.js` file. Chart.js is loaded via CDN. All state is persisted in `localStorage`. The implementation follows the module pattern described in the design: a storage layer, an in-memory state manager, and a render layer that always derives the DOM from state.

---

## Tasks

- [x] 1. Scaffold HTML structure and link assets
  - Create `index.html` with semantic HTML5 structure: header (app title + dark mode toggle), main content area (summary cards, add-transaction form, spending limit section, sort control, transaction list, chart section)
  - Add `<link>` to `css/style.css` and `<script>` tags for Chart.js CDN and `js/script.js` (deferred)
  - Add all required `id` and `class` attributes referenced by the JavaScript layer (e.g., `#balance`, `#total-income`, `#total-expenses`, `#transaction-list`, `#chart-canvas`, `#spending-limit-warning`, `#theme-toggle`, `#sort-select`)
  - Add the spending limit input field and save button
  - _Requirements: 1.4, 3.1, 4.1, 5.3, 7.1, 8.1, 9.1_

- [x] 2. Implement storage and state management
  - [x] 2.1 Implement the storage module
    - Define `STORAGE_KEY` and `THEME_KEY` constants
    - Implement `saveState(state)` — `JSON.stringify` to `localStorage`, wrapped in `try/catch` that shows a toast on quota error
    - Implement `loadState()` — `JSON.parse` from `localStorage`, returns default state `{ transactions: [], spendingLimit: null, sortOrder: 'newest' }` on failure or missing key; log warning on parse error
    - Implement `loadTheme()` — reads `localStorage[THEME_KEY]`, returns `'light'` if absent
    - _Requirements: 1.1, 2.4, 7.4, 9.3, 9.4_

  - [x] 2.2 Implement the state manager
    - Initialize module-level `let state = loadState()`
    - Implement `setState(updater)` — calls `updater(state)`, assigns result to `state`, calls `saveState(state)`, calls `renderAll()`
    - Implement `addTransaction(tx)`, `deleteTransaction(id)`, `setSpendingLimit(value)`, `setTheme(theme)`, `setSortOrder(order)` as thin wrappers around `setState`
    - For `deleteTransaction`: wrap `saveState` in try/catch; on failure, re-insert the transaction and re-render (rollback per Requirement 2.4)
    - _Requirements: 1.1, 1.2, 2.3, 2.4, 7.5, 7.6, 8.2, 9.3_

- [x] 3. Implement pure utility functions
  - [x] 3.1 Implement `validateForm(formData)`
    - Validate `type` (required, `'income'|'expense'`), `category` (required), `amount` (required, numeric, in [0.01, 999999999.99]), `description` (required, 1–100 chars, non-whitespace-only)
    - Return an array of `{ field, message }` error objects; empty array means valid
    - _Requirements: 1.3_

  - [x]* 3.2 Write property test for `validateForm`
    - **Property 2: Invalid transaction is rejected**
    - **Validates: Requirements 1.3**
    - Generate random invalid inputs (whitespace-only descriptions, out-of-range amounts, missing fields) using fast-check; assert `validateForm` returns ≥ 1 error for each

  - [x] 3.3 Implement `computeSummary(transactions)`
    - Return `{ balance, totalIncome, totalExpenses }` where balance = totalIncome − totalExpenses
    - _Requirements: 1.5, 2.5, 3.1, 3.2_

  - [x]* 3.4 Write property test for `computeSummary`
    - **Property 3: Balance invariant**
    - **Validates: Requirements 1.5, 2.5, 3.1, 3.2**
    - Generate random transaction lists; assert balance = sum(income) − sum(expense), totalIncome = sum(income), totalExpenses = sum(expense)

  - [x] 3.5 Implement `sortTransactions(transactions, order)`
    - Support `'newest'`, `'oldest'`, `'amount-desc'`, `'amount-asc'`
    - Tie-breaking: equal dates → insertion order descending; equal amounts → date descending
    - Return a sorted copy (do not mutate the original array)
    - _Requirements: 8.2, 8.5_

  - [x]* 3.6 Write property test for `sortTransactions`
    - **Property 5: Sort correctness and stability**
    - **Validates: Requirements 8.2, 8.5**
    - Generate random transaction lists and all four sort orders; assert result is a permutation of the input, every adjacent pair satisfies the ordering predicate, and tie-breaking is applied correctly

  - [x] 3.7 Implement `computeSpendingWarning(expenses, limit)`
    - Return `'none'` when limit is null/0 or expenses < 0.8 × limit
    - Return `'warning'` when 0.8 × limit ≤ expenses < limit
    - Return `'alert'` when expenses ≥ limit
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

  - [x]* 3.8 Write property test for `computeSpendingWarning`
    - **Property 6: Spending limit warning threshold**
    - **Validates: Requirements 9.5, 9.6, 9.8**
    - Generate random (limit, expense) pairs; assert correct threshold band is returned for all three regions

  - [x] 3.9 Implement `validateSpendingLimit(value)`
    - Return an error for non-numeric, zero, or negative values; return null for valid values
    - _Requirements: 9.1, 9.2_

  - [x]* 3.10 Write property test for `validateSpendingLimit`
    - **Property 12: Invalid spending limit is rejected**
    - **Validates: Requirements 9.2**
    - Generate random invalid spending limit values (non-numeric, zero, negative); assert `validateSpendingLimit` returns an error and state is unchanged

  - [x] 3.11 Implement `formatCurrency(amount)`
    - Return a string formatted as `$X.XX` (two decimal places, currency symbol)
    - _Requirements: 3.1, 4.1_

  - [x] 3.12 Implement `buildChartData(transactions)`
    - Filter to `expense`-type transactions only, group by category, sum amounts per category
    - Return a Chart.js-compatible data object using `CATEGORY_COLORS` for background colors
    - _Requirements: 5.1, 5.4_

  - [x]* 3.13 Write property test for `buildChartData`
    - **Property 9: Chart data reflects expense transactions only**
    - **Validates: Requirements 5.1, 5.2, 5.4**
    - Generate random transaction lists; assert chart data contains only expense entries and sum of all segment values equals `computeSummary(transactions).totalExpenses`

- [x] 4. Checkpoint — Ensure all pure function tests pass
  - Run the test suite; all unit and property tests for utility functions must be green before proceeding.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement render functions
  - [-] 5.1 Implement `renderSummary()`
    - Call `computeSummary(state.transactions)`, format each value with `formatCurrency`, update the DOM elements for balance, total income, and total expenses
    - Apply `balance--positive` CSS class when balance ≥ 0; apply `balance--negative` when balance < 0; never apply both simultaneously
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for `renderSummary` balance CSS class
    - **Property 10: Balance CSS class matches sign**
    - **Validates: Requirements 3.3, 3.4**
    - Generate transaction sets with positive, zero, and negative balances; assert `balance--negative` is present iff balance < 0 and `balance--positive` is present iff balance ≥ 0, never both simultaneously

  - [-] 5.3 Implement `renderTransactionItem(tx)`
    - Return a DOM element (or HTML string) containing type badge, category, formatted amount, locale date, description, and delete button
    - Apply `amount--income` CSS class for income; apply `amount--expense` for expense
    - _Requirements: 4.1, 4.2_

  - [ ]* 5.4 Write property test for `renderTransactionItem`
    - **Property 11: Transaction list item renders all required fields with correct color class**
    - **Validates: Requirements 4.1, 4.2**
    - Generate random transactions of both types; assert rendered element contains type, category, `$X.XX` amount, locale date, description, and correct CSS class

  - [ ] 5.5 Implement `renderTransactionList()`
    - Apply `sortTransactions(state.transactions, state.sortOrder)` to get the display order
    - Render each transaction using `renderTransactionItem`; attach delete button click handlers
    - Show placeholder `<p>` when `state.transactions` is empty
    - Ensure the container has `overflow-y: auto` and a `max-height` for scrollability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.2, 8.3_

  - [-] 5.6 Implement `renderChart()`
    - Create `chartInstance` on first call; update `chartInstance.data` and call `chartInstance.update()` on subsequent calls
    - Hide canvas and show placeholder when no expense transactions exist
    - Handle CDN load failure: if `Chart` is undefined, show static error message
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [-] 5.7 Implement `renderSpendingLimitWarning()`
    - Compute current month's total expenses from `state.transactions`
    - Call `computeSpendingWarning(expenses, state.spendingLimit)` and show/hide the appropriate banner
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

  - [-] 5.8 Implement `renderAll()`
    - Call `renderSummary()`, `renderTransactionList()`, `renderChart()`, `renderSpendingLimitWarning()` in sequence
    - _Requirements: 1.2, 1.5, 2.5, 5.2_

- [ ] 6. Implement event handlers and initialization
  - [ ] 6.1 Implement the Add Transaction form handler
    - On form submit: call `validateForm`, display inline errors via `showFormErrors` if invalid, otherwise construct a `Transaction` object (with `crypto.randomUUID()` or `Date.now().toString()` as `id`, current ISO date) and call `addTransaction(tx)`
    - Reset form to default state after successful save (type = "Expense", category = first option, amount and description cleared)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 6.2 Write property test for `addTransaction` persistence round-trip
    - **Property 1: Valid transaction is persisted and list grows**
    - **Validates: Requirements 1.1, 1.2**
    - Generate random valid transactions; call `addTransaction(tx)`, then `loadState()`; assert transaction is present in the loaded state and list length is exactly one greater than before

  - [ ] 6.3 Implement the delete button handler
    - Show a confirmation prompt before deleting
    - On confirm: call `deleteTransaction(id)`; on storage failure, rollback and display error message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.4 Write property test for `deleteTransaction`
    - **Property 4: Delete removes exactly one transaction**
    - **Validates: Requirements 2.3**
    - Generate random transaction lists and a random id present in the list; call `deleteTransaction(id)`; assert list length decreased by exactly 1, the deleted id is absent, and all other transactions are unchanged

  - [ ] 6.5 Implement the spending limit save handler
    - On save button click: call `validateSpendingLimit`, show inline error if invalid, otherwise call `setSpendingLimit(value)` and trigger `renderSpendingLimitWarning()`
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 6.6 Write property test for spending limit persistence round-trip
    - **Property 8: Spending limit persistence round-trip**
    - **Validates: Requirements 9.3, 9.4**
    - Generate random valid spending limits; call `setSpendingLimit(v)`, then `loadState()`; assert returned state has `spendingLimit === v`

  - [ ] 6.7 Implement the dark mode toggle handler
    - On toggle click: determine new theme, toggle `theme-light`/`theme-dark` CSS class on `document.body`, call `setTheme(newTheme)`, update Chart legend label color, call `chartInstance.update()`, update toggle visual indicator
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_

  - [ ]* 6.8 Write property test for theme persistence round-trip
    - **Property 7: Theme persistence round-trip**
    - **Validates: Requirements 7.4, 7.5, 7.6**
    - For each theme value (`'light'`, `'dark'`): call `setTheme(theme)`, then `loadTheme()`; assert returned value equals the set value; call `applyTheme(theme)` and assert correct CSS class is on `document.body` and the other is absent

  - [ ] 6.9 Implement the sort control handler
    - On `<select>` change: call `setSortOrder(value)` and re-render the transaction list
    - On load: set the `<select>` value to `state.sortOrder` (default `'newest'`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 6.10 Implement `DOMContentLoaded` initialization
    - Call `loadStateFromStorage()`, `applyTheme(loadTheme())`, populate the spending limit input from `state.spendingLimit`, set sort control to `state.sortOrder`, call `renderAll()`
    - _Requirements: 5.5, 7.4, 8.3, 9.4_

- [ ] 7. Implement CSS styling
  - [ ] 7.1 Write base (mobile-first) styles in `css/style.css`
    - Single-column layout for all main sections
    - Style summary cards, transaction list items (with `overflow-y: auto` and `max-height`), form fields, buttons, sort control, spending limit section, chart container
    - Ensure all interactive controls have a minimum touch target of 44×44 CSS pixels
    - Use `overflow-x: hidden` or equivalent on the body/container to prevent horizontal overflow
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [ ] 7.2 Write responsive desktop styles (≥768px breakpoint)
    - Add `@media (min-width: 768px)` block that switches main content to at least a 2-column arrangement
    - _Requirements: 6.1, 6.2_

  - [ ] 7.3 Write light and dark theme CSS classes
    - Define `.theme-light` and `.theme-dark` CSS classes (applied to `body`) with all required color overrides: background, text, form fields, transaction list items, summary cards, chart background
    - _Requirements: 7.2, 7.3_

- [ ] 8. Checkpoint — Full integration smoke test
  - Verify the app loads without console errors on an empty `localStorage` state
  - Add several transactions of different types and categories; verify summary cards, transaction list, and pie chart all update correctly
  - Delete a transaction; verify list, summary, and chart update within 1 second
  - Toggle dark mode; verify all UI components switch theme and preference persists on reload
  - Set a spending limit; verify warning/alert banners appear at the correct thresholds
  - Resize viewport to 320px and 768px; verify single-column and 2-column layouts respectively
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they cover property-based and unit tests.
- Each task references specific requirements for full traceability.
- Property tests use **fast-check** (loaded via CDN or npm for the test environment); each property runs a minimum of 100 iterations.
- Pure utility functions (`validateForm`, `computeSummary`, `sortTransactions`, `computeSpendingWarning`, `formatCurrency`, `buildChartData`, `validateSpendingLimit`) must be exported or exposed on a module object so they can be tested independently of the DOM.
- The `CATEGORY_COLORS` map and `CATEGORIES` array are defined as constants at the top of `js/script.js`.
- `crypto.randomUUID()` is available in all modern browsers; fall back to `Date.now().toString()` if needed.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "3.3", "3.5", "3.7", "3.9", "3.11", "3.12"] },
    { "id": 2, "tasks": ["3.2", "3.4", "3.6", "3.8", "3.10", "3.13"] },
    { "id": 3, "tasks": ["5.1", "5.3", "5.6", "5.7", "5.8", "7.1"] },
    { "id": 4, "tasks": ["5.2", "5.4", "5.5", "7.2", "7.3"] },
    { "id": 5, "tasks": ["6.1", "6.3", "6.5", "6.7", "6.9"] },
    { "id": 6, "tasks": ["6.2", "6.4", "6.6", "6.8", "6.10"] }
  ]
}
```
