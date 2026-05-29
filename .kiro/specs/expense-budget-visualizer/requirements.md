# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal income and expenses, visualize spending patterns through charts, and manage a personal budget — all without a backend or database. All data is persisted in the browser's Local Storage. The app is built with plain HTML, a single CSS file, and a single JavaScript file, using Chart.js for data visualization. The design is minimalist, modern, and mobile-first.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single financial record with a description, amount, category, and type (income or expense).
- **Balance**: The running total calculated as the sum of all income minus the sum of all expenses.
- **Category**: A user-selected label that groups transactions (e.g., Food, Transport, Salary).
- **Spending_Limit**: An optional user-defined maximum total expense amount per month.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Chart**: The Chart.js-powered pie chart that visualizes expense distribution by category.
- **Storage**: The browser's Local Storage API used to persist all application data.
- **Dark_Mode**: An alternative color theme that uses dark backgrounds and light text.
- **Sort_Control**: The UI control that changes the display order of the Transaction_List.

---

## Requirements

### Requirement 1: Add Transaction

**User Story:** As a user, I want to add a new income or expense transaction, so that I can track my financial activity.

#### Acceptance Criteria

1. WHEN the user submits the Add Transaction form, THE App SHALL create a new transaction entry with the provided type, category, amount (a positive number between 0.01 and 999,999,999.99), and description (1–100 characters, non-whitespace-only), and save it to Storage.
2. WHEN a transaction is successfully saved, THE App SHALL append the new transaction entry to the Transaction_List without reloading the page.
3. IF the user submits the form with a missing required field, a whitespace-only description, a non-numeric amount, or an amount outside the valid range, THEN THE App SHALL display an inline validation error for each invalid field and SHALL NOT save the transaction.
4. WHEN the user opens the Add Transaction form, THE App SHALL display the form in its default state: type set to "Expense", category set to the first available option, amount field empty, and description field empty.
5. WHEN a transaction is successfully saved, THE App SHALL recalculate and update the summary values to reflect the new transaction.

---

### Requirement 2: Delete Transaction

**User Story:** As a user, I want to delete a transaction, so that I can remove incorrect or unwanted entries from my records.

#### Acceptance Criteria

1. THE App SHALL render a delete control for each transaction entry displayed in the Transaction_List.
2. WHEN the user clicks the delete control for a transaction entry, THE App SHALL display a confirmation prompt before proceeding.
3. WHEN the user confirms the deletion, THE App SHALL remove the transaction entry from Storage and from the Transaction_List.
4. IF Storage deletion fails, THEN THE App SHALL re-insert the transaction entry in the Transaction_List and display an error message indicating the deletion failed.
5. WHEN a transaction is successfully deleted, THE App SHALL recalculate and update all summary values within 1 second.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total balance, income, and expenses, so that I can understand my overall financial position at a glance.

#### Acceptance Criteria

1. THE App SHALL display three summary values — Balance, total income, and total expenses — each formatted to two decimal places with a currency symbol (e.g., $0.00).
2. WHEN a transaction is added or deleted, THE App SHALL recalculate and update all three summary values.
3. IF the Balance is negative, THEN THE App SHALL apply a CSS class that renders the Balance value in red.
4. IF the Balance is zero or positive, THEN THE App SHALL apply a CSS class that renders the Balance value in green.
5. WHEN no transactions exist, THE App SHALL display $0.00 for Balance, total income, and total expenses.

---

### Requirement 4: Transaction List

**User Story:** As a user, I want to view a list of all my transactions, so that I can review my financial history.

#### Acceptance Criteria

1. THE App SHALL display each transaction entry in the Transaction_List showing the transaction type, category, amount formatted to two decimal places with a currency symbol (e.g., $0.00), date in locale date format (e.g., MM/DD/YYYY), and description.
2. THE App SHALL apply a green CSS class to income transaction amounts and a red CSS class to expense transaction amounts in the Transaction_List.
3. WHEN the Transaction_List contains more entries than the visible area, THE App SHALL provide a scrollable container so all entries remain accessible.
4. WHEN no transactions exist, THE App SHALL display a placeholder message in the Transaction_List indicating that no transactions have been recorded.

---

### Requirement 5: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL display a pie chart that represents the proportion of total expenses attributed to each expense category.
2. WHEN a transaction is added or deleted, THE App SHALL update the pie chart to reflect the current expense data.
3. WHEN no expense transactions exist, THE App SHALL hide the chart canvas element and display a placeholder text message "No expense data to display".
4. THE App SHALL assign each expense category a consistent, pre-defined color in the JavaScript code so that the same category always appears in the same color in the pie chart.
5. WHEN the App is loaded, THE App SHALL initialize the Chart using expense transactions retrieved from Storage.

---

### Requirement 6: Responsive Design

**User Story:** As a user, I want the app to work on both desktop and mobile devices, so that I can manage my finances from any device.

#### Acceptance Criteria

1. THE App SHALL render all content without overlapping elements or clipped text on viewport widths from 320px to 2560px.
2. WHEN the viewport width is 768px or wider, THE App SHALL arrange the main content sections in at least a 2-column arrangement.
3. WHEN the viewport width is less than 768px, THE App SHALL arrange the main content sections in a single-column layout.
4. THE App SHALL scale all interactive controls (buttons, inputs, dropdowns) to remain fully tappable at viewport widths below 768px, with a minimum touch target size of 44×44 CSS pixels.
5. THE App SHALL use CSS overflow properties to prevent any content from extending beyond the viewport width.

---

### Requirement 7: Dark Mode Toggle

**User Story:** As a user, I want to toggle between light and dark mode, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the display between light mode and dark mode.
2. WHEN dark mode is active, THE App SHALL apply a dark theme to all UI components, including background, text, form fields, transaction list items, summary cards, and the Chart background.
3. WHEN light mode is active, THE App SHALL apply a light theme to all UI components, including background, text, form fields, transaction list items, summary cards, and the Chart background.
4. WHEN the App is loaded, THE App SHALL read the saved theme preference from Storage and apply the corresponding theme. IF no theme preference is saved in Storage, THEN THE App SHALL default to light mode.
5. WHEN the user activates dark mode, THE App SHALL save the value "dark" to Storage under the key "theme".
6. WHEN the user activates light mode, THE App SHALL save the value "light" to Storage under the key "theme".
7. THE toggle control SHALL display a visual indicator (e.g., icon or label) that reflects the currently active theme.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transactions by date or amount, so that I can find and review entries more easily.

#### Acceptance Criteria

1. THE App SHALL provide a Sort_Control that allows the user to select one of the following sort options: Newest First, Oldest First, Amount (High to Low), Amount (Low to High).
2. WHEN the user selects a sort option, THE App SHALL re-render the Transaction_List in the selected order; for equal dates, the App SHALL fall back to insertion order descending; for equal amounts, the App SHALL fall back to date descending.
3. WHEN the App is loaded, THE App SHALL display transactions sorted by Newest First and the Sort_Control SHALL visually indicate "Newest First" as the active option.
4. THE Sort_Control SHALL always display a visual indicator of the currently active sort option.
5. WHEN a new transaction is added, THE App SHALL insert it into the Transaction_List in the position consistent with the currently active sort order.

---

### Requirement 9: Spending Limit Warning

**User Story:** As a user, I want to set a monthly spending limit and receive a warning when I approach or exceed it, so that I can manage my budget proactively.

#### Acceptance Criteria

1. THE App SHALL provide a Spending_Limit input field that accepts a positive number between 0.01 and 999,999,999.
2. IF the user enters a non-numeric value, zero, or a negative number as the Spending_Limit, THEN THE App SHALL display an inline validation error and SHALL NOT save the value.
3. WHEN the user saves a valid Spending_Limit, THE App SHALL persist the value to Storage.
4. WHEN the App is loaded, THE App SHALL retrieve the Spending_Limit from Storage and populate the Spending_Limit input field with the saved value.
5. WHEN total monthly expenses reach or exceed 80% of the Spending_Limit but remain below 100%, THE App SHALL display a warning banner with yellow/amber background indicating the user is approaching the spending limit.
6. WHEN total monthly expenses reach or exceed 100% of the Spending_Limit, THE App SHALL display an alert banner with red background indicating the spending limit has been exceeded.
7. IF the Spending_Limit is zero or is not set, THEN THE App SHALL NOT display any spending limit warning or alert banners.
8. WHEN total monthly expenses drop below 80% of the Spending_Limit, THE App SHALL hide any spending limit warning or alert banners.
