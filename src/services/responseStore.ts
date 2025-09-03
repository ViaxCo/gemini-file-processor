// A singleton, non-reactive store for AI responses to avoid React state bloat
// and reduce re-renders during large batch processing.

export type ResponseKey = string;

class ResponseStore {
  private static _instance: ResponseStore | null = null;
  private responses: Map<ResponseKey, string> = new Map();
  private updatedAt: Map<ResponseKey, number> = new Map();

  private constructor() {}

  static get instance(): ResponseStore {
    if (!this._instance) {
      this._instance = new ResponseStore();
    }
    return this._instance;
  }

  // Initialize or replace response entry
  addResponse(key: ResponseKey, initial: string = ''): void {
    this.responses.set(key, initial);
    this.updatedAt.set(key, Date.now());
  }

  // Append or replace content for an existing response entry
  updateResponse(key: ResponseKey, chunk: string, append: boolean = true): void {
    if (!this.responses.has(key)) {
      // Create if missing to be safe
      this.responses.set(key, '');
    }
    const existing = this.responses.get(key) || '';
    this.responses.set(key, append ? existing + chunk : chunk);
    this.updatedAt.set(key, Date.now());
  }

  // Retrieve full response content
  getResponse(key: ResponseKey): string {
    return this.responses.get(key) || '';
  }

  // Remove a single response to free memory
  clearResponse(key: ResponseKey): void {
    this.responses.delete(key);
    this.updatedAt.delete(key);
  }

  // Optional cleanup: purge stale entries to prevent memory leaks
  cleanupStale(maxAgeMs: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, ts] of this.updatedAt.entries()) {
      if (ts < cutoff) {
        this.responses.delete(key);
        this.updatedAt.delete(key);
      }
    }
  }

  // Remove everything (e.g., when clearing all results)
  clearAll(): void {
    this.responses.clear();
    this.updatedAt.clear();
  }
}

export const responseStore = ResponseStore.instance;

// Utility to create a reasonably unique key for a File
export const makeFileKey = (file: File): ResponseKey => {
  return `${file.name}::${file.size}::${file.lastModified}`;
};
