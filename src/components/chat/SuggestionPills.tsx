import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestionPillsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionPills({
  disabled,
  suggestions,
  onSelect,
}: SuggestionPillsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className={cn(
            'shrink-0 rounded-full border border-adam-neutral-700 bg-adam-neutral-800 text-xs text-white hover:text-white hover:opacity-80',
            disabled ? 'opacity-50' : '',
          )}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
