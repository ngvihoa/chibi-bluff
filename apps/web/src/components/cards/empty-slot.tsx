/** A dashed card outline: a hand slot waiting for its card (e.g. a replacement being picked). */
export function EmptySlot({
  label,
  slot,
  className = "",
}: {
  label: string;
  /** Hand position, so animations can land a card here (`[data-hand-slot]`). */
  slot?: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      data-hand-slot={slot}
      className={`aspect-[2/3] animate-pulse rounded-[12%/8%] border-3 border-dashed border-muted/70 bg-panel/40 ${className}`}
    />
  );
}
