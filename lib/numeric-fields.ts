export function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

export function phoneCharactersOnly(value: unknown) {
  const text = String(value ?? "");
  const prefix = text.includes("+") ? "+" : "";
  return `${prefix}${digitsOnly(text)}`;
}

export function hasOnlyDigits(value: unknown) {
  const text = String(value ?? "");
  return text === "" || /^[0-9]+$/.test(text);
}

export function isValidPhoneCharacters(value: unknown) {
  const text = String(value ?? "");
  return text === "" || /^\+?[0-9]+$/.test(text);
}
