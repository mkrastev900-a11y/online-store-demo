const SCHEMA_ERROR_MARKERS = [
  "PrismaClientValidationError",
  "Invalid `tx.order.create()` invocation",
  "Unknown argument",
  "does not exist in the current database",
  "The column",
];

export function publicCheckoutError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (!message || SCHEMA_ERROR_MARKERS.some((marker) => message.includes(marker)) || message.includes("\n")) {
    return "Системата за поръчки се обновява. Моля, опитай отново след малко.";
  }
  return message.length <= 260 ? message : "Поръчката не беше създадена. Моля, опитай отново.";
}
