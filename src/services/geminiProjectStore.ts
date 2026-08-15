export type GeminiProjectVerification = 'available' | 'unverified' | 'key_problem';

export type GeminiProject = {
  id: string;
  name: string;
  apiKey: string;
  verification: GeminiProjectVerification;
};

export type GeminiQuotaState = {
  projectId: string;
  model: string;
  pacificDate: string;
  requestsToday: number;
  inputTokensToday: number;
  requestTimestamps: number[];
  cooldownUntil?: number;
  dailyExhaustedUntil?: number;
};

export type GeminiProjectStatus =
  | 'available'
  | 'unverified'
  | 'cooldown'
  | 'daily_exhausted'
  | 'key_problem';

const PROJECTS_KEY = 'ai-file-processor-gemini-projects-v1';
const QUOTA_KEY = 'ai-file-processor-gemini-quota-v1';
const LEGACY_KEY = 'ai-file-processor-api-key-gemini';
const PROJECTS_CHANGE_EVENT = 'gemini-projects-change';
const QUOTA_CHANGE_EVENT = 'gemini-quota-change';

const isBrowser = () => typeof window !== 'undefined';

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const notify = (eventName: string) => {
  if (isBrowser()) window.dispatchEvent(new Event(eventName));
};

const parseArray = <T>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function getPacificDate(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getNextPacificMidnight(now = Date.now()): number {
  const [year, month, day] = getPacificDate(now).split('-').map(Number);
  const nextDay = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const target = {
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
  };
  let candidate = Date.UTC(target.year, target.month - 1, target.day, 8);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(candidate);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
    );
    const desired = Date.UTC(target.year, target.month - 1, target.day);
    candidate += desired - represented;
  }

  return candidate;
}

export function getGeminiProjects(): GeminiProject[] {
  if (!isBrowser()) return [];
  const saved = parseArray<GeminiProject>(localStorage.getItem(PROJECTS_KEY));
  if (saved.length > 0) return saved;

  const legacyKey = localStorage.getItem(LEGACY_KEY)?.trim();
  if (!legacyKey) return [];

  const migrated = [
    {
      id: makeId(),
      name: 'Gemini Project 1',
      apiKey: legacyKey,
      verification: 'unverified' as const,
    },
  ];
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(migrated));
  localStorage.removeItem(LEGACY_KEY);
  return migrated;
}

export function saveGeminiProjects(projects: GeminiProject[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  notify(PROJECTS_CHANGE_EVENT);
}

export function setGeminiProjectVerification(
  projectId: string,
  verification: GeminiProjectVerification,
): void {
  const projects = getGeminiProjects();
  const next = projects.map((project) =>
    project.id === projectId ? { ...project, verification } : project,
  );
  if (next.some((project, index) => project !== projects[index])) saveGeminiProjects(next);
}

export function getGeminiQuotaStates(): GeminiQuotaState[] {
  if (!isBrowser()) return [];
  return parseArray<GeminiQuotaState>(localStorage.getItem(QUOTA_KEY));
}

export function saveGeminiQuotaState(state: GeminiQuotaState): void {
  if (!isBrowser()) return;
  const states = getGeminiQuotaStates();
  const index = states.findIndex(
    (item) => item.projectId === state.projectId && item.model === state.model,
  );
  if (index >= 0) states[index] = state;
  else states.push(state);
  localStorage.setItem(QUOTA_KEY, JSON.stringify(states));
  notify(QUOTA_CHANGE_EVENT);
}

export function getGeminiQuotaState(
  projectId: string,
  model: string,
  now = Date.now(),
): GeminiQuotaState {
  const pacificDate = getPacificDate(now);
  const saved = getGeminiQuotaStates().find(
    (state) => state.projectId === projectId && state.model === model,
  );
  if (!saved || saved.pacificDate !== pacificDate) {
    return {
      projectId,
      model,
      pacificDate,
      requestsToday: 0,
      inputTokensToday: 0,
      requestTimestamps: [],
    };
  }
  return saved;
}

export function getGeminiProjectStatus(
  project: GeminiProject,
  model: string,
  now = Date.now(),
): GeminiProjectStatus {
  if (project.verification === 'key_problem') return 'key_problem';
  const state = getGeminiQuotaState(project.id, model, now);
  if ((state.dailyExhaustedUntil ?? 0) > now) return 'daily_exhausted';
  if ((state.cooldownUntil ?? 0) > now) return 'cooldown';
  return project.verification;
}

export function subscribeToGeminiProjectStore(onChange: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROJECTS_KEY) onChange();
  };
  window.addEventListener(PROJECTS_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PROJECTS_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function subscribeToGeminiQuotaStore(onChange: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUOTA_KEY) onChange();
  };
  window.addEventListener(QUOTA_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(QUOTA_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export const TEST_GEMINI_PROJECTS: GeminiProject[] = [
  'available-1',
  'available-2',
  'available-3',
  'rpm-once',
  'tpm-once',
  'daily-limit',
  'invalid-key',
  'available-4',
].map((behavior, index) => ({
  id: `test-gemini-project-${index + 1}`,
  name: `Test Project ${index + 1}`,
  apiKey: `test-gemini-${behavior}`,
  verification: 'available',
}));
