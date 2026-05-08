import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestionPillsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
  /**
   * When true, pills wrap onto multiple rows so every suggestion stays
   * visible. Default (false) keeps the original horizontal-scroll
   * behavior used by the parametric chat where vertical space is tight.
   */
  wrap?: boolean;
}

export function SuggestionPills({
  disabled,
  suggestions,
  onSelect,
  wrap = false,
}: SuggestionPillsProps) {
  if (!suggestions.length) return null;

  return (
    <div
      className={cn(
        'flex gap-2 pb-2',
        wrap
          ? 'flex-wrap'
          : 'scrollbar-hide overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
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
