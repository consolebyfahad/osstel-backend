export function normalizePhoneForMatch(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function phonesMatch(phoneA, phoneB) {
  const a = normalizePhoneForMatch(phoneA);
  const b = normalizePhoneForMatch(phoneB);
  return Boolean(a) && a === b;
}
