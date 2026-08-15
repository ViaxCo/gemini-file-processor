import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_UPLOAD_BATCH_SIZE,
  canChangeUploadDestination,
  selectAutomaticUploadBatch,
} from './automaticUploads';

const makeRequest = (index: number) => ({
  uploadKey: `upload-${index}`,
  title: `Document ${index}`,
  content: `Content ${index}`,
  folderId: 'folder-1',
});

describe('canChangeUploadDestination', () => {
  it('locks the destination during and after an upload', () => {
    expect(canChangeUploadDestination('uploading')).toBe(false);
    expect(canChangeUploadDestination('verifying')).toBe(false);
    expect(canChangeUploadDestination('unknown')).toBe(false);
    expect(canChangeUploadDestination('completed')).toBe(false);
  });

  it('allows a destination change before upload or after a confirmed failure', () => {
    expect(canChangeUploadDestination()).toBe(true);
    expect(canChangeUploadDestination('idle')).toBe(true);
    expect(canChangeUploadDestination('error')).toBe(true);
  });
});

describe('selectAutomaticUploadBatch', () => {
  it('returns at most ten ready uploads', () => {
    const requests = Array.from({ length: 12 }, (_, index) => makeRequest(index));

    expect(selectAutomaticUploadBatch(requests, {})).toEqual(
      requests.slice(0, AUTOMATIC_UPLOAD_BATCH_SIZE),
    );
  });

  it('does not automatically retry failed uploads', () => {
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)];

    expect(
      selectAutomaticUploadBatch(requests, {
        'upload-0': 'error',
        'upload-1': 'completed',
      }),
    ).toEqual([requests[2]]);
  });

  it('pauses every automatic upload behind an unknown outcome', () => {
    expect(
      selectAutomaticUploadBatch([makeRequest(0)], {
        'another-upload': 'unknown',
      }),
    ).toEqual([]);
  });
});
