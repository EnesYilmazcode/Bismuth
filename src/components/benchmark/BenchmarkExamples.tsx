import { SuggestionPills } from '@/components/chat/SuggestionPills';

// Curated CAD-flavored starter prompts for the benchmark page. Picked to
// span shape complexity (mug, gear pair) and parametric surface area
// (gridfinity bin, planter) so the side-by-side comparison shows real
// differences between models.
const EXAMPLES = [
  'A coffee mug with a generous handle and wall thickness slider',
  'A hex bolt M8 with adjustable thread length',
  'A gridfinity 1x2 bin with magnet holes',
  'A faceted vase with sliders for height, twist and segment count',
  'A geometric lampshade with cutout pattern',
  'A planter pot with drainage holes and a saucer',
  'A phone stand for a 6-inch phone with cable cutout',
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
