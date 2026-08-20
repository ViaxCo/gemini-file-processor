const STORAGE_KEY = 'google_drive_pending_upload_operations_v1';

const getStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const readOperations = () => {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
};

const writeOperations = (operations: Record<string, string>) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (Object.keys(operations).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(operations));
  } catch {
    // Duplicate protection still works in memory when browser storage is unavailable.
  }
};

export const makeDriveUploadOperationId = (
  uploadKey: string,
  title: string,
  folderId?: string | null,
) => JSON.stringify([uploadKey.replace(/^\d+::\d+::/, ''), title, folderId ?? null]);

export const getDriveUploadOperation = (operationId: string) => readOperations()[operationId];

export const rememberDriveUploadOperation = (operationId: string, operationKey: string) => {
  writeOperations({ ...readOperations(), [operationId]: operationKey });
};

export const forgetDriveUploadOperation = (operationId: string) => {
  const operations = readOperations();
  delete operations[operationId];
  writeOperations(operations);
};
