import { SuggestionPills } from '@/components/chat/SuggestionPills';

// Five curated starters chosen to show distinct kinds of CAD reasoning:
// hollow body (mug), tight-tolerance threaded fastener (bolt), modular
// storage (gridfinity), parametric organic geometry (vase), and meshing
// constraints (gears). Less is more — the user has to read every pill to
// pick one.
const EXAMPLES = [
  'A coffee mug with a generous handle and wall thickness slider',
  'A hex bolt M8 with adjustable thread length',
  'A gridfinity 1x2 bin with magnet holes',
  'A faceted vase with sliders for height, twist and segment count',
  'A pair of meshing involute gears with adjustable teeth count',
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
