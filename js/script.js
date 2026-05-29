// =============================================================================
// EXPENSE & BUDGET VISUALIZER — script.js
// =============================================================================

// =============================================================================
// SECTION 1: CONSTANTS
// =============================================================================

const STORAGE_KEY = 'expenseBudgetData';
const THEME_KEY   = 'theme';

const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Health',
  'Entertainment', 'Education', 'Shopping', 'Salary', 'Other'
];

const CATEGORY_COLORS = {
  Food:          '#FF6384',
  Transport:     '#36A2EB',
  Housing:       '#FFCE56',
  Health:        '#4BC0C0',
  Entertainment: '#9966FF',
  Education:     '#FF9F40',
  Shopping:      '#C084FC', /* was #E7E9ED — near-white, invisible on light bg */
  Salary:        '#71B37C',
  Other:         '#94A3B8',
};

// =============================================================================
// SECTION 2: STORAGE MODULE
// =============================================================================

/**
 * Persist the current state to localStorage.
 * Shows a toast notification if the write fails (e.g. quota exceeded) and
 * re-throws the error so callers that need rollback behaviour can catch it.
 *
 * @param {Object} state - The application state to persist.
 * @throws {Error} Re-throws any localStorage write error after showing a toast.
 */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    showToast('Could not save data. Storage may be full.');
    throw err; // re-throw so deleteTransaction can roll back
  }
}

/**
 * Load the application state from localStorage.
 * Returns the default state if the key is absent or the stored value cannot
 * be parsed.
 *
 * @returns {{ transactions: Array, spendingLimit: number|null, sortOrder: string }}
 */
function loadState() {
  const DEFAULT_STATE = {
    transactions:  [],
    spendingLimit: null,
    sortOrder:     'newest',
  };

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw);
    // Merge with defaults so any missing keys are filled in
    return Object.assign({}, DEFAULT_STATE, parsed);
  } catch (err) {
    console.warn('[loadState] Failed to parse stored state — using default.', err);
    return DEFAULT_STATE;
  }
}

/**
 * Load the saved theme preference from localStorage.
 * Returns 'light' if no preference has been saved.
 *
 * @returns {'light'|'dark'}
 */
function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

// =============================================================================
// SECTION 3: STATE MANAGER
// =============================================================================

/** In-memory application state — single source of truth. */
let state = loadState();

/**
 * Apply an immutable-style update to the state, persist it, and re-render.
 *
 * @param {function(Object): Object} updater - Pure function that receives the
 *   current state and returns the next state.
 */
function setState(updater) {
  state = updater(state);
  try {
    saveState(state);
  } catch (_err) {
    // Toast already shown by saveState; swallow here so the UI still updates.
  }
  // renderAll may not be defined yet in early tasks; guard against that.
  if (typeof renderAll === 'function') {
    renderAll();
  }
}

/**
 * Append a new transaction to the state.
 *
 * @param {{ id: string, type: string, category: string, amount: number,
 *           description: string, date: string }} tx
 */
function addTransaction(tx) {
  setState(function (s) {
    return Object.assign({}, s, {
      transactions: s.transactions.concat(tx),
    });
  });
}

/**
 * Remove a transaction by id.
 * If persisting the updated state fails, the transaction is re-inserted and
 * the UI is re-rendered (rollback per Requirement 2.4).
 *
 * @param {string} id - The id of the transaction to remove.
 */
function deleteTransaction(id) {
  const removed = state.transactions.find(function (tx) { return tx.id === id; });
  const nextTransactions = state.transactions.filter(function (tx) { return tx.id !== id; });
  const nextState = Object.assign({}, state, { transactions: nextTransactions });

  // Optimistically update in-memory state
  state = nextState;

  try {
    saveState(state);
  } catch (err) {
    // Rollback: re-insert the removed transaction at its original position
    if (removed) {
      state = Object.assign({}, state, {
        transactions: state.transactions.concat(removed),
      });
    }
    if (typeof renderAll === 'function') {
      renderAll();
    }
    return;
  }

  if (typeof renderAll === 'function') {
    renderAll();
  }
}

/**
 * Update the monthly spending limit.
 *
 * @param {number|null} value
 */
function setSpendingLimit(value) {
  setState(function (s) {
    return Object.assign({}, s, { spendingLimit: value });
  });
}

/**
 * Persist the theme preference directly under THEME_KEY (not inside the main
 * state blob) and apply it to the document.
 *
 * @param {'light'|'dark'} theme
 */
function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    showToast('Could not save theme preference. Storage may be full.');
  }
  if (typeof applyTheme === 'function') {
    applyTheme(theme);
  }
}

/**
 * Update the active sort order.
 *
 * @param {'newest'|'oldest'|'amount-desc'|'amount-asc'} order
 */
function setSortOrder(order) {
  setState(function (s) {
    return Object.assign({}, s, { sortOrder: order });
  });
}

// =============================================================================
// SECTION 4: PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate a transaction form submission.
 * Returns an array of { field, message } error objects.
 * An empty array means all fields are valid.
 *
 * @param {{ type: string, category: string, amount: string|number, description: string }} formData
 * @returns {{ field: string, message: string }[]}
 */
function validateForm(formData) {
  var errors = [];

  // Validate type
  if (!formData.type || (formData.type !== 'income' && formData.type !== 'expense')) {
    errors.push({ field: 'type', message: 'Type must be "income" or "expense".' });
  }

  // Validate category
  if (!formData.category || String(formData.category).trim() === '') {
    errors.push({ field: 'category', message: 'Category is required.' });
  }

  // Validate amount
  var amount = Number(formData.amount);
  if (formData.amount === '' || formData.amount === null || formData.amount === undefined || isNaN(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a number.' });
  } else if (amount < 0.01 || amount > 999999999.99) {
    errors.push({ field: 'amount', message: 'Amount must be between 0.01 and 999,999,999.99.' });
  }

  // Validate description
  var desc = formData.description;
  if (desc === null || desc === undefined || String(desc).trim() === '') {
    errors.push({ field: 'description', message: 'Description is required and cannot be whitespace only.' });
  } else if (String(desc).length < 1 || String(desc).length > 100) {
    errors.push({ field: 'description', message: 'Description must be between 1 and 100 characters.' });
  }

  return errors;
}

/**
 * Compute summary totals from a list of transactions.
 *
 * @param {{ type: string, amount: number }[]} transactions
 * @returns {{ balance: number, totalIncome: number, totalExpenses: number }}
 */
function computeSummary(transactions) {
  var totalIncome = 0;
  var totalExpenses = 0;

  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpenses += tx.amount;
    }
  }

  return {
    balance: totalIncome - totalExpenses,
    totalIncome: totalIncome,
    totalExpenses: totalExpenses,
  };
}

/**
 * Return a sorted COPY of the transactions array.
 * Supported orders: 'newest', 'oldest', 'amount-desc', 'amount-asc'.
 * Tie-breaking: equal dates → insertion order descending (original index reversed);
 *               equal amounts → date descending.
 *
 * @param {{ date: string, amount: number }[]} transactions
 * @param {'newest'|'oldest'|'amount-desc'|'amount-asc'} order
 * @returns {Array}
 */
function sortTransactions(transactions, order) {
  // Attach original indices for stable tie-breaking
  var indexed = transactions.map(function (tx, idx) {
    return { tx: tx, idx: idx };
  });

  indexed.sort(function (a, b) {
    if (order === 'newest' || order === 'oldest') {
      var dateA = new Date(a.tx.date).getTime();
      var dateB = new Date(b.tx.date).getTime();
      if (dateA !== dateB) {
        return order === 'newest' ? dateB - dateA : dateA - dateB;
      }
      // Tie-break: insertion order descending (higher original index first)
      return b.idx - a.idx;
    }

    if (order === 'amount-desc' || order === 'amount-asc') {
      var amtA = a.tx.amount;
      var amtB = b.tx.amount;
      if (amtA !== amtB) {
        return order === 'amount-desc' ? amtB - amtA : amtA - amtB;
      }
      // Tie-break: date descending
      var dA = new Date(a.tx.date).getTime();
      var dB = new Date(b.tx.date).getTime();
      return dB - dA;
    }

    return 0;
  });

  return indexed.map(function (item) { return item.tx; });
}

/**
 * Determine the spending warning level given total expenses and a limit.
 *
 * @param {number} expenses - Total expense amount.
 * @param {number|null} limit - The spending limit (null/0/falsy means no limit).
 * @returns {'none'|'warning'|'alert'}
 */
function computeSpendingWarning(expenses, limit) {
  if (!limit) {
    return 'none';
  }
  if (expenses >= limit) {
    return 'alert';
  }
  if (expenses >= 0.8 * limit) {
    return 'warning';
  }
  return 'none';
}

/**
 * Validate a spending limit input value.
 * Returns a single { field, message } error object for invalid values,
 * or null if the value is valid (positive number in [0.01, 999999999]).
 *
 * @param {string|number} value - Raw input value (may be a string from an input field).
 * @returns {{ field: string, message: string }|null}
 */
function validateSpendingLimit(value) {
  // Empty / missing check
  if (value === '' || value === null || value === undefined) {
    return { field: 'spending-limit', message: 'Spending limit is required.' };
  }

  var num = parseFloat(value);

  // Non-numeric check
  if (isNaN(num)) {
    return { field: 'spending-limit', message: 'Spending limit must be a number.' };
  }

  // Zero or negative check
  if (num <= 0) {
    return { field: 'spending-limit', message: 'Spending limit must be a positive number.' };
  }

  return null;
}

/**
 * Format a numeric amount as a currency string: $X.XX
 *
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return '$' + Number(amount).toFixed(2);
}

/**
 * Build a Chart.js-compatible data object from a list of transactions.
 * Only expense-type transactions are included, grouped by category.
 *
 * @param {{ type: string, category: string, amount: number }[]} transactions
 * @returns {{ labels: string[], datasets: [{ data: number[], backgroundColor: string[] }] }}
 */
function buildChartData(transactions) {
  var totals = {};

  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    if (tx.type !== 'expense') continue;
    var cat = tx.category;
    totals[cat] = (totals[cat] || 0) + tx.amount;
  }

  var labels = Object.keys(totals);
  var data = labels.map(function (cat) { return totals[cat]; });
  var backgroundColor = labels.map(function (cat) {
    return CATEGORY_COLORS[cat] || '#C9CBCF';
  });

  return {
    labels: labels,
    datasets: [{
      data: data,
      backgroundColor: backgroundColor,
      borderWidth: 1,
    }],
  };
}

// =============================================================================
// SECTION 5: RENDER FUNCTIONS
// =============================================================================

/**
 * Build and return a <li> DOM element representing a single transaction.
 * Uses document.createElement (not innerHTML) for security.
 *
 * @param {{ id: string, type: 'income'|'expense', category: string,
 *           amount: number, description: string, date: string }} tx
 * @returns {HTMLLIElement}
 */
function renderTransactionItem(tx) {
  // Root list item
  var li = document.createElement('li');
  li.className = 'transaction-item';

  // Type badge: <span class="badge badge--income">Income</span>
  var badge = document.createElement('span');
  badge.className = 'badge badge--' + tx.type;
  badge.textContent = tx.type === 'income' ? 'Income' : 'Expense';
  li.appendChild(badge);

  // Category label
  var category = document.createElement('span');
  category.className = 'transaction-item__category';
  category.textContent = tx.category;
  li.appendChild(category);

  // Amount — green for income, red for expense
  var amount = document.createElement('span');
  amount.className = 'transaction-item__amount ' +
    (tx.type === 'income' ? 'amount--income' : 'amount--expense');
  amount.textContent = formatCurrency(tx.amount);
  li.appendChild(amount);

  // Date in locale format
  var date = document.createElement('span');
  date.className = 'transaction-item__date';
  date.textContent = new Date(tx.date).toLocaleDateString();
  li.appendChild(date);

  // Description
  var description = document.createElement('span');
  description.className = 'transaction-item__description';
  description.textContent = tx.description;
  li.appendChild(description);

  // Delete button
  var deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-delete';
  deleteBtn.dataset.id = tx.id;
  deleteBtn.textContent = 'Delete';
  li.appendChild(deleteBtn);

  return li;
}

/**
 * Render the full transaction list into #transaction-list.
 * - Sorts transactions using sortTransactions(state.transactions, state.sortOrder).
 * - Renders each transaction using renderTransactionItem and attaches delete handlers.
 * - Shows a placeholder <p> when state.transactions is empty.
 * - The container uses overflow-y: auto and max-height for scrollability (set via CSS).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 8.2, 8.3
 */
function renderTransactionList() {
  var listEl = document.getElementById('transaction-list');
  if (!listEl) return;

  // Clear existing content
  listEl.innerHTML = '';

  if (state.transactions.length === 0) {
    var placeholder = document.createElement('li');
    placeholder.className = 'transaction-list__placeholder';
    placeholder.textContent = 'No transactions recorded yet.';
    listEl.appendChild(placeholder);
    return;
  }

  var sorted = sortTransactions(state.transactions, state.sortOrder);

  for (var i = 0; i < sorted.length; i++) {
    var tx = sorted[i];
    var li = renderTransactionItem(tx);

    // Attach delete button click handler
    var deleteBtn = li.querySelector('.btn-delete');
    if (deleteBtn) {
      (function (txId) {
        deleteBtn.addEventListener('click', function () {
          if (confirm('Are you sure you want to delete this transaction?')) {
            deleteTransaction(txId);
          }
        });
      })(tx.id);
    }

    listEl.appendChild(li);
  }
}

/**
 * Render the expense pie chart using Chart.js.
 * - Creates chartInstance on first call; updates data and calls chartInstance.update() on subsequent calls.
 * - Hides canvas and shows placeholder when no expense transactions exist.
 * - Handles CDN load failure: if Chart is undefined, shows a static error message.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */
var chartInstance = null;

function renderChart() {
  var canvas = document.getElementById('chart-canvas');
  var placeholder = document.getElementById('chart-placeholder');

  // Handle CDN load failure
  if (typeof Chart === 'undefined') {
    if (canvas) canvas.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'Chart could not be loaded. Please check your internet connection.';
    }
    return;
  }

  var hasExpenses = state.transactions.some(function (tx) { return tx.type === 'expense'; });

  if (!hasExpenses) {
    // Hide canvas, show placeholder
    if (canvas) canvas.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'No expense data to display.';
    }
    // Destroy existing chart instance if present so it doesn't linger
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // Show canvas, hide placeholder
  if (canvas) canvas.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';

  // Build fresh aggregated data from the full state.transactions array.
  // buildChartData groups ALL expense transactions by category and sums
  // amounts, so every category is represented regardless of how many
  // individual transactions belong to it.
  var chartData = buildChartData(state.transactions);

  // Determine the current legend label colour based on the active theme.
  var isDark = document.body.classList.contains('theme-dark');
  var legendColor = isDark ? '#f1f5f9' : '#1a202c';

  // Always destroy the previous instance before creating a new one.
  // This is the only reliable way to guarantee Chart.js re-renders all
  // categories correctly when the number of labels changes between renders
  // (e.g. adding a transaction in a new category, or deleting the last
  // transaction in a category).  The performance cost is negligible for
  // the data sizes involved here.
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: legendColor,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              var label = context.label || '';
              var value = context.parsed || 0;
              return label + ': ' + formatCurrency(value);
            },
          },
        },
      },
    },
  });
}

// =============================================================================
// SECTION 6: TOAST UTILITY
// =============================================================================

/**
 * Display a brief, non-blocking notification message that auto-dismisses.
 *
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    // Fallback when DOM is not yet available
    console.warn('[showToast]', message);
    return;
  }
  toast.textContent = message;
  toast.classList.remove('toast--hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function () {
    toast.classList.add('toast--hidden');
  }, 4000);
}

// =============================================================================
// SECTION 7: RENDER FUNCTIONS
// =============================================================================

/**
 * Render the summary cards (balance, total income, total expenses).
 * Reads from state.transactions, formats each value with formatCurrency,
 * and updates the corresponding DOM elements.
 * Applies balance--positive or balance--negative CSS class to #balance
 * depending on whether the balance is ≥ 0 or < 0 (never both simultaneously).
 */
function renderSummary() {
  var summary = computeSummary(state.transactions);
  var balance = summary.balance;
  var totalIncome = summary.totalIncome;
  var totalExpenses = summary.totalExpenses;

  var balanceEl = document.getElementById('balance');
  var incomeEl = document.getElementById('total-income');
  var expensesEl = document.getElementById('total-expenses');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(balance);
    if (balance >= 0) {
      balanceEl.classList.add('balance--positive');
      balanceEl.classList.remove('balance--negative');
    } else {
      balanceEl.classList.add('balance--negative');
      balanceEl.classList.remove('balance--positive');
    }
  }

  if (incomeEl) {
    incomeEl.textContent = formatCurrency(totalIncome);
  }

  if (expensesEl) {
    expensesEl.textContent = formatCurrency(totalExpenses);
  }
}

/**
 * Render the spending limit warning banner based on the current month's
 * total expenses compared to state.spendingLimit.
 *
 * - Computes total expenses for the current calendar month from state.transactions.
 * - Calls computeSpendingWarning() to determine the warning level.
 * - Updates #spending-limit-warning visibility, text, and CSS classes accordingly.
 *
 * Warning levels (Requirements 9.5, 9.6, 9.7, 9.8):
 *   'none'    → hide the banner
 *   'warning' → show banner with yellow styling ("approaching limit")
 *   'alert'   → show banner with red styling ("limit exceeded")
 */
function renderSpendingLimitWarning() {
  var warningEl = document.getElementById('spending-limit-warning');
  if (!warningEl) return;

  // Compute current month's total expenses
  var now = new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth(); // 0-indexed

  var monthlyExpenses = 0;
  for (var i = 0; i < state.transactions.length; i++) {
    var tx = state.transactions[i];
    if (tx.type !== 'expense') continue;
    var txDate = new Date(tx.date);
    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      monthlyExpenses += tx.amount;
    }
  }

  var level = computeSpendingWarning(monthlyExpenses, state.spendingLimit);

  if (level === 'none') {
    warningEl.classList.add('spending-limit-warning--hidden');
    warningEl.classList.remove('warning--yellow', 'warning--red');
    warningEl.textContent = '';
  } else if (level === 'warning') {
    warningEl.classList.remove('spending-limit-warning--hidden', 'warning--red');
    warningEl.classList.add('warning--yellow');
    warningEl.textContent = 'Warning: You are approaching your spending limit.';
  } else if (level === 'alert') {
    warningEl.classList.remove('spending-limit-warning--hidden', 'warning--yellow');
    warningEl.classList.add('warning--red');
    warningEl.textContent = 'Alert: You have exceeded your spending limit.';
  }
}

/**
 * Re-render the entire UI from the current state.
 * Calls each render function in sequence:
 *   1. renderSummary()
 *   2. renderTransactionList()
 *   3. renderChart()
 *   4. renderSpendingLimitWarning()
 *
 * Requirements: 1.2, 1.5, 2.5, 5.2
 */
function renderAll() {
  renderSummary();
  renderTransactionList();
  renderChart();
  renderSpendingLimitWarning();
}

// =============================================================================
// SECTION 7: HELPER FUNCTIONS FOR EVENT HANDLERS
// =============================================================================

/**
 * Apply a theme to document.body by toggling theme-light / theme-dark classes.
 * Removes the opposite class before adding the new one.
 *
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add('theme-' + theme);
}

/**
 * Clear all inline form error messages in the Add Transaction form.
 */
function clearFormErrors() {
  var errorIds = ['tx-type-error', 'tx-category-error', 'tx-amount-error', 'tx-description-error'];
  for (var i = 0; i < errorIds.length; i++) {
    var el = document.getElementById(errorIds[i]);
    if (el) el.textContent = '';
  }
}

/**
 * Display inline validation errors for the Add Transaction form.
 * Clears all error elements first, then sets the message for each error.
 *
 * @param {{ field: string, message: string }[]} errors
 */
function showFormErrors(errors) {
  clearFormErrors();

  // Map field names to their error element IDs
  var fieldToErrorId = {
    type:        'tx-type-error',
    category:    'tx-category-error',
    amount:      'tx-amount-error',
    description: 'tx-description-error',
  };

  for (var i = 0; i < errors.length; i++) {
    var error = errors[i];
    var errorId = fieldToErrorId[error.field];
    if (errorId) {
      var el = document.getElementById(errorId);
      if (el) el.textContent = error.message;
    }
  }
}

// =============================================================================
// SECTION 8: EVENT HANDLERS
// =============================================================================

/**
 * Handle Add Transaction form submission.
 * Validates the form, shows inline errors if invalid, or constructs and saves
 * a new Transaction object and resets the form on success.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
function handleTransactionFormSubmit(event) {
  event.preventDefault();

  var typeEl        = document.getElementById('tx-type');
  var categoryEl    = document.getElementById('tx-category');
  var amountEl      = document.getElementById('tx-amount');
  var descriptionEl = document.getElementById('tx-description');

  var formData = {
    type:        typeEl        ? typeEl.value        : '',
    category:    categoryEl    ? categoryEl.value    : '',
    amount:      amountEl      ? amountEl.value      : '',
    description: descriptionEl ? descriptionEl.value : '',
  };

  var errors = validateForm(formData);

  if (errors.length > 0) {
    showFormErrors(errors);
    return;
  }

  // Clear any previous errors
  clearFormErrors();

  // Construct the transaction object
  var id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Date.now().toString();

  var tx = {
    id:          id,
    type:        formData.type,
    category:    formData.category,
    amount:      parseFloat(formData.amount),
    description: formData.description.trim(),
    date:        new Date().toISOString(),
  };

  addTransaction(tx);

  // Reset form to default state (Requirement 1.4)
  if (typeEl)        typeEl.value        = 'expense';
  if (categoryEl)    categoryEl.selectedIndex = 0;
  if (amountEl)      amountEl.value      = '';
  if (descriptionEl) descriptionEl.value = '';
}

/**
 * Handle spending limit save button click.
 * Validates the input, shows inline error if invalid, or saves the limit
 * and re-renders the spending limit warning.
 *
 * Requirements: 9.1, 9.2, 9.3
 */
function handleSpendingLimitSave() {
  var inputEl = document.getElementById('spending-limit-input');
  var errorEl = document.getElementById('spending-limit-error');
  var value   = inputEl ? inputEl.value : '';

  var error = validateSpendingLimit(value);

  if (error) {
    if (errorEl) errorEl.textContent = error.message;
    return;
  }

  // Clear error
  if (errorEl) errorEl.textContent = '';

  setSpendingLimit(parseFloat(value));
  renderSpendingLimitWarning();
}

/**
 * Handle dark mode toggle button click.
 * Toggles between 'light' and 'dark' themes, persists the preference,
 * updates the chart legend color, and updates the toggle button indicator.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7
 */
function handleThemeToggle() {
  var currentlyDark = document.body.classList.contains('theme-dark');
  var newTheme = currentlyDark ? 'light' : 'dark';

  // Persist and apply the theme. setTheme() calls applyTheme() internally.
  setTheme(newTheme);

  // Recreate the chart with the correct legend colour for the new theme,
  // and re-render all other UI sections from current state.
  renderAll();

  // Update toggle button visual indicator (Requirement 7.7)
  var toggleBtn   = document.getElementById('theme-toggle');
  var iconEl      = toggleBtn ? toggleBtn.querySelector('.theme-toggle__icon')  : null;
  var labelEl     = toggleBtn ? toggleBtn.querySelector('.theme-toggle__label') : null;

  if (newTheme === 'dark') {
    if (iconEl)  iconEl.textContent  = '☀️';
    if (labelEl) labelEl.textContent = 'Light Mode';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to light mode');
  } else {
    if (iconEl)  iconEl.textContent  = '🌙';
    if (labelEl) labelEl.textContent = 'Dark Mode';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
  }
}

/**
 * Handle sort select change event.
 * Persists the new sort order and re-renders the transaction list.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
function handleSortChange(event) {
  var newOrder = event.target.value;
  setSortOrder(newOrder);
  renderTransactionList();
}

// =============================================================================
// SECTION 9: INITIALISATION
// =============================================================================

/**
 * Full DOMContentLoaded initialization.
 * - Applies saved theme
 * - Populates spending limit input from state
 * - Sets sort control to state.sortOrder
 * - Attaches all event handlers
 * - Calls renderAll()
 *
 * Requirements: 5.5, 7.4, 8.3, 9.4
 */
document.addEventListener('DOMContentLoaded', function () {
  // 1. Apply saved theme as early as possible to avoid flash of wrong theme
  var savedTheme = loadTheme();
  applyTheme(savedTheme);

  // Update toggle button indicator to match the loaded theme
  var toggleBtn = document.getElementById('theme-toggle');
  var iconEl    = toggleBtn ? toggleBtn.querySelector('.theme-toggle__icon')  : null;
  var labelEl   = toggleBtn ? toggleBtn.querySelector('.theme-toggle__label') : null;

  if (savedTheme === 'dark') {
    if (iconEl)  iconEl.textContent  = '☀️';
    if (labelEl) labelEl.textContent = 'Light Mode';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to light mode');
  } else {
    if (iconEl)  iconEl.textContent  = '🌙';
    if (labelEl) labelEl.textContent = 'Dark Mode';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
  }

  // 2. Populate spending limit input from persisted state (Requirement 9.4)
  var spendingLimitInput = document.getElementById('spending-limit-input');
  if (spendingLimitInput && state.spendingLimit !== null && state.spendingLimit !== undefined) {
    spendingLimitInput.value = state.spendingLimit;
  }

  // 3. Set sort control to state.sortOrder (Requirement 8.3)
  var sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = state.sortOrder || 'newest';
  }

  // 4. Attach event handlers

  // Add Transaction form submit
  var transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', handleTransactionFormSubmit);
  }

  // Spending limit save button
  var spendingLimitSaveBtn = document.getElementById('spending-limit-save');
  if (spendingLimitSaveBtn) {
    spendingLimitSaveBtn.addEventListener('click', handleSpendingLimitSave);
  }

  // Dark mode toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleThemeToggle);
  }

  // Sort select change
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  // 5. Render the full UI from current state
  renderAll();
});
