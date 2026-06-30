/**
 * Escape user input before using in MongoDB $regex queries.
 */
export const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildCaseInsensitiveRegex = (value = "") => ({
  $regex: escapeRegex(value.trim()),
  $options: "i",
});
