import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function GoogleDriveCreateFolderForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const nameInputId = useId();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    try {
      await onCreate(trimmedName);
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
        placeholder="e.g. Reports"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || isCreating}
          className="text-xs sm:text-sm"
        >
          {isCreating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Create
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
