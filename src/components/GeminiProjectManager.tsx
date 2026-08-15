'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  GeminiProject,
  TEST_GEMINI_PROJECTS,
  getGeminiProjectStatus,
  getGeminiQuotaState,
  subscribeToGeminiQuotaStore,
} from '../services/geminiProjectStore';
import { fetchModels } from '../services/modelFetcher';
import { toProcessingFailure } from '../services/processingErrors';

const statusLabel = {
  available: 'Available',
  unverified: 'Unverified',
  cooldown: 'Cooling down',
  daily_exhausted: 'Daily limit',
  key_problem: 'Key problem',
};

interface GeminiProjectManagerProps {
  projects: GeminiProject[];
  model: string;
  disabled?: boolean;
  onChange: (projects: GeminiProject[]) => void;
}

export function GeminiProjectManager({
  projects,
  model,
  disabled = false,
  onChange,
}: GeminiProjectManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const rows = useMemo(
    () =>
      projects.map((project) => {
        const quota = getGeminiQuotaState(project.id, model, now);
        return { project, quota, status: getGeminiProjectStatus(project, model, now) };
      }),
    [model, now, projects],
  );
  const nextStatusChangeAt = Math.min(
    ...rows.flatMap(({ quota }) =>
      [quota.cooldownUntil, quota.dailyExhaustedUntil].filter(
        (value): value is number => value !== undefined && value > now,
      ),
    ),
    Number.POSITIVE_INFINITY,
  );

  useEffect(() => setNow(Date.now()), [model, projects]);

  useEffect(() => subscribeToGeminiQuotaStore(() => setNow(Date.now())), []);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (open || !Number.isFinite(nextStatusChangeAt)) return;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextStatusChangeAt - Date.now()) + 50,
    );
    return () => clearTimeout(timeout);
  }, [nextStatusChangeAt, open]);

  const availableCount = rows.filter(
    ({ status }) => status === 'available' || status === 'unverified',
  ).length;
  const hasOnlyTestProjects = projects.every((project) => project.id.startsWith('test-gemini-'));

  const resetForm = () => {
    setEditingId(undefined);
    setName('');
    setApiKey('');
    setShowKey(false);
    setError('');
  };

  const startEdit = (project: GeminiProject) => {
    setEditingId(project.id);
    setName(project.name);
    setApiKey(project.apiKey);
    setError('');
  };

  const saveProject = async () => {
    const key = apiKey.trim();
    if (!key) return;
    if (projects.some((project) => project.apiKey === key && project.id !== editingId)) {
      setError('This API key is already saved.');
      return;
    }

    setIsSaving(true);
    setError('');
    const id = editingId ?? crypto.randomUUID();
    const project: GeminiProject = {
      id,
      name:
        name.trim() ||
        `Gemini Project ${editingId ? projects.findIndex((p) => p.id === id) + 1 : projects.length + 1}`,
      apiKey: key,
      verification: 'unverified',
    };
    let next = editingId
      ? projects.map((item) => (item.id === editingId ? project : item))
      : [...projects, project];

    try {
      await fetchModels('gemini', key);
      next = next.map((item) =>
        item.id === id ? { ...item, verification: 'available' as const } : item,
      );
    } catch (validationError) {
      const failure = toProcessingFailure(validationError, 'gemini', model);
      next = next.map((item) =>
        item.id === id
          ? {
              ...item,
              verification:
                failure.category === 'authentication'
                  ? ('key_problem' as const)
                  : ('unverified' as const),
            }
          : item,
      );
    } finally {
      onChange(next);
      setIsSaving(false);
      resetForm();
    }
  };

  const removeProject = (project: GeminiProject) => {
    onChange(projects.filter((item) => item.id !== project.id));
    if (editingId === project.id) resetForm();
  };

  const loadTestProjects = () => {
    onChange(TEST_GEMINI_PROJECTS);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-2 px-3"
          disabled={disabled}
          data-recovery-target="api-key"
        >
          <span className="flex min-w-0 items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {projects.length} Gemini project{projects.length === 1 ? '' : 's'}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{availableCount} available</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(85dvh,720px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gemini projects</DialogTitle>
          <DialogDescription>
            Add one key from each Google project. Different keys from the same project share quota.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Add a Gemini project before processing files.
            </div>
          ) : (
            rows.map(({ project, quota, status }) => (
              <div
                key={project.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <Badge variant={status === 'key_problem' ? 'destructive' : 'outline'}>
                      {statusLabel[status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>••••••••{project.apiKey.slice(-4)}</span>
                    <span>
                      {quota.requestsToday} request{quota.requestsToday === 1 ? '' : 's'} sent today
                    </span>
                    {status === 'cooldown' && quota.cooldownUntil ? (
                      <span>{Math.max(1, Math.ceil((quota.cooldownUntil - now) / 1000))}s</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1 sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(project)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit {project.name}</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove {project.name}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {project.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the API key and stops new requests from using this project.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => removeProject(project)}
                        >
                          Remove project
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}

          <div className="space-y-3 rounded-lg border bg-muted/25 p-3">
            <div className="text-sm font-medium">
              {editingId ? 'Edit Gemini project' : 'Add Gemini project'}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Project name (optional)
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Gemini Project 1"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                API key
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="AIza..."
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-9 w-9"
                    onClick={() => setShowKey((value) => !value)}
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span className="sr-only">{showKey ? 'Hide' : 'Show'} API key</span>
                  </Button>
                </div>
              </label>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={saveProject}
                disabled={!apiKey.trim() || isSaving}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
                {editingId ? 'Save changes' : 'Add project'}
              </Button>
              {editingId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Keys are stored in this browser and are not encrypted. The app cannot detect whether two
            different keys belong to the same Google project.
          </p>

          {process.env.NODE_ENV !== 'production' &&
          (projects.length === 0 || hasOnlyTestProjects) ? (
            <Button type="button" variant="secondary" size="sm" onClick={loadTestProjects}>
              Load 8 simulated projects
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
