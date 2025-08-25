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

// Perfil do usuário (nome e avatar escolhidos)
export interface Profile {
  displayName: string;
  avatar: string | null;
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem('cc-profile', JSON.stringify(profile));
}

export function loadProfile(): Profile {
  try {
    const stored = localStorage.getItem('cc-profile');
    return stored ? JSON.parse(stored) : { displayName: '', avatar: null };
  } catch {
    return { displayName: '', avatar: null };
  }
}

// Helpers para usar perfil padrão se vazio
export function getDisplayNameOrDefault(profile: Profile): string {
  return profile.displayName || `Galinha ${Math.floor(Math.random() * 1000)}`;
}

export function getAvatarOrDefault(profile: Profile): string {
  return profile.avatar || '🐔';
}