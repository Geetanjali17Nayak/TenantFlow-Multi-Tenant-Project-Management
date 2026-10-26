// Normalises backend error messages: class-validator returns an array, other errors a string.
export const getApiErrorMessages = (err: any, fallback: string): string[] => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return message.map(String);
  if (typeof message === 'string' && message) return [message];
  return [fallback];
};
