// Public API of the rules engine (docs/architecture.md §3).

export { applyInput, createGame } from "./game";
export { getLegalInputs } from "./legal";
export * from "./rng";
export * from "./rules";
export { alivePlayers, findPlayer, hiddenRoles, isAlive } from "./state";
export * from "./types";
export { getEventsForViewer, getPlayerView } from "./view";
