import type { ProcessingFailure } from './processingErrors';
import {
  GeminiProject,
  getGeminiProjects,
  getGeminiQuotaState,
  getNextPacificMidnight,
  saveGeminiQuotaState,
  setGeminiProjectVerification,
} from './geminiProjectStore';

export type GeminiQuotaAcquisition =
  | { kind: 'ready'; project: GeminiProject }
  | { kind: 'wait'; nextAt: number }
  | { kind: 'daily_exhausted'; nextAt: number }
  | { kind: 'key_problem' };

export class GeminiQuotaScheduler {
  private cursor = 0;

  constructor(
    private projects: GeminiProject[],
    private model: string,
    private rpmLimit: number,
    private rpmInterval: number,
  ) {}

  acquire(now = Date.now()): GeminiQuotaAcquisition {
    const candidates = this.projects.map((project, index) => {
      if (project.verification === 'key_problem') {
        return { project, index, availableAt: Number.POSITIVE_INFINITY, reason: 'key' as const };
      }

      const state = getGeminiQuotaState(project.id, this.model, now);
      if ((state.dailyExhaustedUntil ?? 0) > now) {
        return {
          project,
          index,
          availableAt: state.dailyExhaustedUntil!,
          reason: 'daily' as const,
        };
      }

      const timestamps = state.requestTimestamps.filter(
        (timestamp) => now - timestamp < this.rpmInterval,
      );
      const rpmAvailableAt =
        timestamps.length < this.rpmLimit ? now : Math.min(...timestamps) + this.rpmInterval;
      const availableAt = Math.max(now, state.cooldownUntil ?? 0, rpmAvailableAt);
      return { project, index, availableAt, reason: 'temporary' as const, state, timestamps };
    });

    const ready = candidates.filter((candidate) => candidate.availableAt <= now);
    if (ready.length > 0) {
      const ordered = [...ready].sort(
        (a, b) =>
          ((a.index - this.cursor + this.projects.length) % this.projects.length) -
          ((b.index - this.cursor + this.projects.length) % this.projects.length),
      );
      const selected = ordered[0]!;
      const state = 'state' in selected ? selected.state : undefined;
      const timestamps = 'timestamps' in selected ? (selected.timestamps ?? []) : [];
      saveGeminiQuotaState({
        ...(state ?? getGeminiQuotaState(selected.project.id, this.model, now)),
        requestsToday: (state?.requestsToday ?? 0) + 1,
        requestTimestamps: [...timestamps, now],
      });
      this.cursor = (selected.index + 1) % this.projects.length;
      return { kind: 'ready', project: selected.project };
    }

    const recoverable = candidates.filter((candidate) => Number.isFinite(candidate.availableAt));
    if (recoverable.length === 0) return { kind: 'key_problem' };
    const nextAt = Math.min(...recoverable.map((candidate) => candidate.availableAt));
    return recoverable.every((candidate) => candidate.reason === 'daily')
      ? { kind: 'daily_exhausted', nextAt }
      : { kind: 'wait', nextAt };
  }

  reportSuccess(projectId: string, inputTokens = 0, now = Date.now()): void {
    const state = getGeminiQuotaState(projectId, this.model, now);
    saveGeminiQuotaState({
      ...state,
      inputTokensToday: state.inputTokensToday + inputTokens,
    });
  }

  reportFailure(projectId: string, failure: ProcessingFailure, now = Date.now()): void {
    if (failure.category === 'authentication') {
      setGeminiProjectVerification(projectId, 'key_problem');
      this.projects = getGeminiProjects();
      return;
    }

    const state = getGeminiQuotaState(projectId, this.model, now);
    if (failure.category === 'daily_quota') {
      saveGeminiQuotaState({
        ...state,
        dailyExhaustedUntil: getNextPacificMidnight(now),
        cooldownUntil: undefined,
      });
      return;
    }

    if (failure.category === 'rate_limit') {
      saveGeminiQuotaState({
        ...state,
        cooldownUntil: now + (failure.retryAfterMs ?? 60_000),
      });
    }
  }
}
