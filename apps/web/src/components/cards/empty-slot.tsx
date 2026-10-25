/** A dashed card outline: a hand slot waiting for its card (e.g. a replacement being picked). */
export function EmptySlot({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`aspect-[2/3] animate-pulse rounded-[12%/8%] border-3 border-dashed border-muted/70 bg-panel/40 ${className}`}
    />
  );
}
