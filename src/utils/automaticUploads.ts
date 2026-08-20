import type { DriveUploadRequest, UploadStatus } from '@/hooks/useGoogleDrive';
import { GoogleDriveUnknownUploadError } from '../services/googleDriveService';

export const AUTOMATIC_UPLOAD_BATCH_SIZE = 10;

export const getUploadFailureCopy = (fileName: string, error: unknown, failureCount = 1) => {
  if (failureCount > 1) {
    return {
      title: `${failureCount} uploads need attention`,
      description: `First file: "${fileName}".`,
    };
  }

  const isUnknown = error instanceof GoogleDriveUnknownUploadError;
  return {
    title: isUnknown ? `Could not confirm "${fileName}"` : `Upload failed: "${fileName}"`,
    description: isUnknown
      ? 'The file might already exist in Drive. Check Drive before you retry.'
      : error instanceof Error
        ? error.message
        : 'Check the file before you retry.',
  };
};

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
