import type { DriveUploadRequest, UploadStatus } from '@/hooks/useGoogleDrive';

export const AUTOMATIC_UPLOAD_BATCH_SIZE = 10;

export const canChangeUploadDestination = (status?: UploadStatus) =>
  !status || status === 'idle' || status === 'error';

export const selectAutomaticUploadBatch = (
  requests: readonly DriveUploadRequest[],
  statuses: Readonly<Record<string, UploadStatus>>,
): DriveUploadRequest[] => {
  if (Object.values(statuses).includes('unknown')) return [];

  return requests
    .filter(({ uploadKey }) => {
      const status = statuses[uploadKey];
      return !status || status === 'idle';
    })
    .slice(0, AUTOMATIC_UPLOAD_BATCH_SIZE);
};
