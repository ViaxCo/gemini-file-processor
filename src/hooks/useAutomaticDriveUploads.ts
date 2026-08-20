import type { DriveUploadRequest, DriveUploadResult, UploadStatus } from '@/hooks/useGoogleDrive';
import { getUploadFailureCopy, selectAutomaticUploadBatch } from '@/utils/automaticUploads';
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
  onShowUpload,
}: {
  requests: readonly DriveUploadRequest[];
  uploadStatuses?: Record<string, UploadStatus>;
  isDriveAuthenticated: boolean;
  isUploadSessionActive: boolean;
  uploadToGoogleDocs?: (
    uploads: DriveUploadRequest[],
  ) => Promise<PromiseSettledResult<DriveUploadResult>[]>;
  onWaitingForConnectionChange?: (isWaiting: boolean) => void;
  onShowUpload?: (uploadKey: string) => void;
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
        const failures = results.flatMap((result, index) =>
          result.status === 'rejected' ? [{ result, request: batch[index]! }] : [],
        );
        const first = failures[0];
        if (!first) return;

        const copy = getUploadFailureCopy(
          first.request.title,
          first.result.reason,
          failures.length,
        );
        toast.error(copy.title, {
          description: copy.description,
          action: onShowUpload
            ? { label: 'Show file', onClick: () => onShowUpload(first.request.uploadKey) }
            : undefined,
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Automatic upload failed');
      })
      .finally(() => {
        isStartingRef.current = false;
      });
  }, [batch, isDriveAuthenticated, isUploadSessionActive, onShowUpload, uploadToGoogleDocs]);
}
