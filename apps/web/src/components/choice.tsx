/** A toggle button in a row of options (setup screens, room settings). */
export function Choice({
  selected,
  onSelect,
  label,
  hint,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className="flex min-h-12 flex-col items-center justify-center rounded-2xl border-3 border-outline bg-panel px-2 py-1 font-extrabold lg:min-h-16 lg:py-2 text-muted shadow-hard-sm transition active:translate-y-0.5 aria-pressed:bg-gold aria-pressed:text-outline disabled:active:translate-y-0 disabled:[&:not([aria-pressed=true])]:opacity-60"
    >
      <span className="text-lg lg:text-xl">{label}</span>
      {hint && (
        <span className="text-center text-xs font-medium leading-tight lg:text-sm">{hint}</span>
      )}
    </button>
  );
}
