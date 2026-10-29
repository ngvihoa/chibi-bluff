// Public API of the shared match runner (docs/architecture.md §4).

export { type Clock, Match, type MatchOptions, type MatchSeat, type MatchSnapshot } from "./match";
export { MOMENT_MS, momentPause, PACES, type Pace, type PaceSettings } from "./pacing";
export { type BotSeat, botFor } from "./persona";
