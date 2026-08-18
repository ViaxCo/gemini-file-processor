import { beforeEach, describe, expect, it } from 'vitest';
import type { ProcessingFailure } from './processingErrors';
import {
  GeminiProject,
  getGeminiProjectStatus,
  getGeminiProjects,
  getGeminiQuotaState,
  getNextPacificMidnight,
  saveGeminiProjects,
  saveGeminiQuotaState,
  subscribeToGeminiProjectStore,
} from './geminiProjectStore';
import { GeminiQuotaScheduler } from './geminiQuotaScheduler';

const storage = new Map<string, string>();
const localStorageFake = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

const projects: GeminiProject[] = [1, 2, 3].map((number) => ({
  id: `project-${number}`,
  name: `Project ${number}`,
  apiKey: `key-${number}`,
  verification: 'available',
}));

const failure = (
  category: ProcessingFailure['category'],
  retryAfterMs?: number,
): ProcessingFailure => ({
  kind: category === 'daily_quota' ? 'deferred' : 'temporary',
  category,
  title: category,
  message: category,
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  technicalMessage: category,
  retryable: category === 'rate_limit',
  retryAfterMs,
});

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: new EventTarget(),
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageFake,
  });
  saveGeminiProjects(projects);
});

describe('GeminiQuotaScheduler', () => {
  it('routes equal projects in round-robin order', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);

    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[0] });
    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[1] });
    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[2] });
    expect(getGeminiQuotaState('project-1', 'gemini-2.5-flash', now).requestsToday).toBe(1);
  });

  it('waits when every project reaches its RPM limit', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 1, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    projects.forEach(() => scheduler.acquire(now));

    expect(scheduler.acquire(now)).toEqual({ kind: 'wait', nextAt: now + 60_000 });
  });

  it('cools only the project that receives a short-term quota failure', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    const first = scheduler.acquire(now);
    expect(first.kind).toBe('ready');
    scheduler.reportFailure('project-1', failure('rate_limit', 30_000), now);

    expect(getGeminiProjectStatus(projects[0]!, 'gemini-2.5-flash', now)).toBe('cooldown');
    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[1] });
  });

  it('does not erase a cooldown when a parallel request succeeds', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    scheduler.reportFailure('project-1', failure('rate_limit', 30_000), now);

    scheduler.reportSuccess('project-1', 100, now + 10);

    expect(getGeminiProjectStatus(projects[0]!, 'gemini-2.5-flash', now + 10)).toBe('cooldown');
    expect(getGeminiQuotaState('project-1', 'gemini-2.5-flash', now + 10).inputTokensToday).toBe(
      100,
    );
  });

  it('marks daily exhaustion per project and model', () => {
    const scheduler = new GeminiQuotaScheduler([projects[0]!], 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    scheduler.reportFailure('project-1', failure('daily_quota'), now);

    expect(scheduler.acquire(now)).toMatchObject({ kind: 'daily_exhausted' });
    expect(
      new GeminiQuotaScheduler([projects[0]!], 'gemini-2.5-pro', 5, 60_000).acquire(now),
    ).toMatchObject({ kind: 'ready' });
  });

  it('disables only the project with an authentication failure', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    scheduler.reportFailure('project-1', failure('authentication'), now);

    expect(getGeminiProjects()[0]?.verification).toBe('key_problem');
    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[1] });
  });

  it('routes around a project that cannot use the selected model', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    scheduler.reportFailure('project-1', failure('model_unavailable'), now);

    expect(scheduler.acquire(now)).toMatchObject({ kind: 'ready', project: projects[1] });
    expect(
      new GeminiQuotaScheduler([projects[0]!], 'gemini-2.5-pro', 5, 60_000).acquire(now),
    ).toMatchObject({ kind: 'ready', project: projects[0] });
  });

  it('reports model unavailability only after every usable project rejects the model', () => {
    const scheduler = new GeminiQuotaScheduler(projects, 'gemini-2.5-flash', 5, 60_000);
    const now = Date.UTC(2026, 7, 15, 12);
    projects.forEach((project) =>
      scheduler.reportFailure(project.id, failure('model_unavailable'), now),
    );

    expect(scheduler.acquire(now)).toEqual({ kind: 'model_unavailable' });
  });
});

describe('Gemini project migration', () => {
  it('moves the old Gemini key into the first project', () => {
    storage.clear();
    localStorage.setItem('ai-file-processor-api-key-gemini', 'legacy-key');

    expect(getGeminiProjects()).toMatchObject([
      { name: 'Gemini Project 1', apiKey: 'legacy-key', verification: 'unverified' },
    ]);
    expect(localStorage.getItem('ai-file-processor-api-key-gemini')).toBeNull();
  });

  it('keeps quota updates separate from project changes', () => {
    let projectChanges = 0;
    const unsubscribe = subscribeToGeminiProjectStore(() => {
      projectChanges += 1;
    });

    saveGeminiQuotaState({
      projectId: 'project-1',
      model: 'gemini-2.5-flash',
      pacificDate: '2026-08-15',
      requestsToday: 1,
      inputTokensToday: 10,
      requestTimestamps: [],
    });
    expect(projectChanges).toBe(0);

    saveGeminiProjects([...projects]);
    expect(projectChanges).toBe(1);
    unsubscribe();
  });
});

describe('Pacific quota reset', () => {
  it('uses daylight time in August and standard time in January', () => {
    expect(getNextPacificMidnight(Date.UTC(2026, 7, 15, 12))).toBe(Date.UTC(2026, 7, 16, 7));
    expect(getNextPacificMidnight(Date.UTC(2026, 0, 15, 12))).toBe(Date.UTC(2026, 0, 16, 8));
  });
});
