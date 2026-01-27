/**
 * Safe data utility functions to prevent runtime errors from undefined/null data
 */

/**
 * Safely handles array operations
 * @param {*} val - Value to check
 * @returns {Array} - Returns array or empty array
 */
export const safeArray = (val) => {
  return Array.isArray(val) ? val : [];
};

/**
 * Safely handles numeric values
 * @param {*} val - Value to convert to number
 * @returns {number} - Returns number or 0
 */
export const safeNumber = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

/**
 * Safely handles date values
 * @param {*} val - Date string or value
 * @returns {Date|null} - Returns Date object or null
 */
export const safeDate = (val) => {
  if (!val) return null;
  try {
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/**
 * Safely formats numbers with locale string
 * @param {*} val - Numeric value
 * @param {string} locale - Locale string (default: 'id-ID')
 * @returns {string} - Formatted number or '0'
 */
export const safeLocaleString = (val, locale = 'id-ID') => {
  return (safeNumber(val)).toLocaleString?.(locale) ?? '0';
};

/**
 * Safely formats dates with locale string
 * @param {*} val - Date value
 * @param {object} options - Date formatting options
 * @returns {string} - Formatted date or '-'
 */
export const safeDateString = (val, options = {}) => {
  const date = safeDate(val);
  if (!date) return '-';

  try {
    return date.toLocaleDateString('id-ID', options);
  } catch {
    return '-';
  }
};

/**
 * Safely gets array length
 * @param {*} val - Array value
 * @returns {number} - Array length or 0
 */
export const safeLength = (val) => {
  return safeArray(val).length;
};

/**
 * Safely maps over array with fallback
 * @param {*} val - Array value
 * @param {Function} callback - Map callback function
 * @param {Array} fallback - Fallback array if val is not array
 * @returns {Array} - Mapped array or fallback
 */
export const safeMap = (val, callback, fallback = []) => {
  const arr = safeArray(val);
  return arr.length > 0 ? arr.map(callback) : fallback;
};

/**
 * Safely filters array
 * @param {*} val - Array value
 * @param {Function} callback - Filter callback function
 * @returns {Array} - Filtered array or empty array
 */
export const safeFilter = (val, callback) => {
  return safeArray(val).filter(callback);
};

/**
 * Safely finds item in array
 * @param {*} val - Array value
 * @param {Function} callback - Find callback function
 * @returns {*} - Found item or undefined
 */
export const safeFind = (val, callback) => {
  return safeArray(val).find(callback);
};

/**
 * Safely gets nested object property
 * @param {object} obj - Object to access
 * @param {string} path - Dot notation path (e.g., 'user.profile.name')
 * @param {*} fallback - Fallback value
 * @returns {*} - Property value or fallback
 */
export const safeGet = (obj, path, fallback = undefined) => {
  if (!obj || typeof obj !== 'object') return fallback;

  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : fallback;
  }, obj);
};

/**
 * Safely checks if value exists and is truthy
 * @param {*} val - Value to check
 * @returns {boolean} - True if value exists and is truthy
 */
export const safeExists = (val) => {
  return val !== null && val !== undefined && val !== '';
};