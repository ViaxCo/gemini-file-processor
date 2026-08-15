import type { DriveUploadRequest, DriveUploadResult, UploadStatus } from '@/hooks/useGoogleDrive';
import { selectAutomaticUploadBatch } from '@/utils/automaticUploads';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

const EMPTY_UPLOAD_STATUSES: Record<string, UploadStatus> = {};

export function useAutomaticDriveUploads({
  requests,
  uploadStatuses = EMPTY_UPLOAD_STATUSES,
  isDriveAuthenticated,
  isUploadSessionActive,
  uploadToGoogleDocs,
  onWaitingForConnectionChange,
}: {
  requests: readonly DriveUploadRequest[];
  uploadStatuses?: Record<string, UploadStatus>;
  isDriveAuthenticated: boolean;
  isUploadSessionActive: boolean;
  uploadToGoogleDocs?: (
    uploads: DriveUploadRequest[],
  ) => Promise<PromiseSettledResult<DriveUploadResult>[]>;
  onWaitingForConnectionChange?: (isWaiting: boolean) => void;
}) {
  const isStartingRef = useRef(false);
  const batch = useMemo(
    () => selectAutomaticUploadBatch(requests, uploadStatuses),
    [requests, uploadStatuses],
  );
  const isWaitingForConnection = !isDriveAuthenticated && batch.length > 0;

  useEffect(() => {
    onWaitingForConnectionChange?.(isWaitingForConnection);
  }, [isWaitingForConnection, onWaitingForConnectionChange]);

  useEffect(() => {
    if (
      !uploadToGoogleDocs ||
      !isDriveAuthenticated ||
      isUploadSessionActive ||
      isStartingRef.current ||
      batch.length === 0
    ) {
      return;
    }

    isStartingRef.current = true;
    void uploadToGoogleDocs(batch)
      .then((results) => {
        const failedCount = results.filter((result) => result.status === 'rejected').length;
        if (failedCount > 0) {
          toast.error(
            `${failedCount} automatic upload${failedCount === 1 ? '' : 's'} need attention.`,
          );
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Automatic upload failed');
      })
      .finally(() => {
        isStartingRef.current = false;
      });
  }, [batch, isDriveAuthenticated, isUploadSessionActive, uploadToGoogleDocs]);
}
