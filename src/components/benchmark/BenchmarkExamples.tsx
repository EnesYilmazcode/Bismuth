import { SuggestionPills } from '@/components/chat/SuggestionPills';

// Five curated starters chosen to show distinct kinds of CAD reasoning:
// figural / iconic (knight), hollow body with asymmetric feature (mug),
// helical structure (staircase), mechanical meshing (gears), and organic
// rotational geometry (vase). Phrased as plain objects, no slider or
// "adjustable X" language, since the benchmark renders one static pane
// per model. Less is more, the user has to read every pill to pick one.
const EXAMPLES = [
  'A chess knight',
  'A coffee mug with a heart-shaped handle',
  'A spiral staircase',
  'A pair of meshing gears',
  'A faceted vase',
];

interface BenchmarkExamplesProps {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}

export function BenchmarkExamples({
  disabled,
  onSelect,
}: BenchmarkExamplesProps) {
  return (
    <SuggestionPills
      disabled={disabled}
      suggestions={EXAMPLES}
      onSelect={onSelect}
      wrap
    />
  );
}
