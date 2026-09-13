export function serializeOrderFormValues(values: Record<string, string>): string {
  return JSON.stringify(values)
}
