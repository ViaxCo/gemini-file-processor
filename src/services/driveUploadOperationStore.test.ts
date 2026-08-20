import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetDriveUploadOperation,
  getDriveUploadOperation,
  makeDriveUploadOperationId,
  rememberDriveUploadOperation,
} from './driveUploadOperationStore';

const values = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  },
});

describe('Drive upload operation store', () => {
  beforeEach(() => values.clear());

  it('uses the source file and destination instead of the temporary batch position', () => {
    const first = makeDriveUploadOperationId('1::0::lesson.txt::42::1000', 'Lesson', 'folder-a');
    const later = makeDriveUploadOperationId('7::12::lesson.txt::42::1000', 'Lesson', 'folder-a');

    expect(later).toBe(first);
    expect(makeDriveUploadOperationId('1::0::lesson.txt::42::1000', 'Lesson', 'folder-b')).not.toBe(
      first,
    );
  });

  it('keeps an unresolved operation until it is confirmed or discarded', () => {
    const operationId = makeDriveUploadOperationId('1::0::lesson.txt::42::1000', 'Lesson');

    rememberDriveUploadOperation(operationId, 'operation-key');
    expect(getDriveUploadOperation(operationId)).toBe('operation-key');

    forgetDriveUploadOperation(operationId);
    expect(getDriveUploadOperation(operationId)).toBeUndefined();
  });
});
