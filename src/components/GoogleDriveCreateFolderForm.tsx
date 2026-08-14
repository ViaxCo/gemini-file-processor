import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { formatSeriesFolderName } from '@/utils/driveFolderName';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function GoogleDriveCreateFolderForm({
  onCreate,
  onCancel,
  submitLabel,
  initialName,
}: {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  initialName: string;
}) {
  const nameInputId = useId();
  const [name, setName] = useState(() => formatSeriesFolderName(initialName));
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    const folderName = formatSeriesFolderName(name);
    if (!folderName || isCreating) return;

    setIsCreating(true);
    try {
      await onCreate(folderName);
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={createFolder} className="space-y-2 rounded-md bg-muted/50 p-2 sm:p-3">
      <label htmlFor={nameInputId} className="text-xs font-medium sm:text-sm">
        Folder name
      </label>
      <Input
        id={nameInputId}
        autoFocus
        disabled={isCreating}
        placeholder="Enter a series folder name"
        value={name}
        onChange={(event) => setName(event.target.value.toUpperCase())}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || isCreating}
          className="text-xs sm:text-sm"
        >
          {isCreating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs sm:text-sm"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
