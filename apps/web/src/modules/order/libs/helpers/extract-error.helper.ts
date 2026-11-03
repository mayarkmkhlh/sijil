/** 408 is a client timeout. 422 is a schema failure. 502 is the model call failing. */
export function extractErrorMessage(
  httpStatus: number,
  detail: string | null,
  messages: { schema: string; model: string; timeout: string },
): string | null {
  if (httpStatus === 408) return messages.timeout;
  if (httpStatus === 422) return messages.schema;
  if (httpStatus === 502) return messages.model;
  return detail;
}
