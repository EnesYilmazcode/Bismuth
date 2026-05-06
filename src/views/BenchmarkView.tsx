// Benchmark mode — runs one prompt against several AI models in parallel
// and renders each model's OpenSCAD result in its own auto-rotating viewer
// pane. Lives entirely outside the parametric/creative chat history; nothing
// here writes to the conversations table.

export function BenchmarkView() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-adam-background-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 pb-2 pt-10 md:px-20 md:py-6">
        <h1 className="text-2xl font-medium text-adam-neutral-10">Benchmark</h1>
        <p className="text-sm text-adam-neutral-400">
          Compare how different AI models tackle the same CAD prompt, side by
          side.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center text-sm text-adam-neutral-500">
        (UI under construction — picker + viewer panes land in the next commits)
      </div>
    </div>
  );
}
