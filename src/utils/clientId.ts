// Cliente ID único para identificar usuários no navegador
export function getOrCreateClientId(): string {
  const key = 'cc-client-id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}