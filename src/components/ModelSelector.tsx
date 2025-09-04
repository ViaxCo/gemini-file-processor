import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Brain } from 'lucide-react';

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number]['value'];

interface ModelSelectorProps {
  selectedModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
}

export const ModelSelector = ({ selectedModel, onModelChange }: ModelSelectorProps) => {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
        <span className="text-xs font-medium whitespace-nowrap text-muted-foreground sm:text-sm">
          AI Model
        </span>
      </div>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <SelectTrigger className="w-full min-w-[160px] sm:w-auto sm:min-w-[140px]" size="sm">
          <SelectValue placeholder="Select model">
            {GEMINI_MODELS.find((model) => model.value === selectedModel)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {GEMINI_MODELS.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
