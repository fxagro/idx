/**
 * Safely renders values in React components to prevent "Objects are not valid as a React child" errors
 * @param {any} value - The value to render
 * @returns {string|number} - Returns the value if it's a string or number, empty string otherwise
 */
export function safeRender(value) {
  return (typeof value === "string" || typeof value === "number") ? value : "";
}