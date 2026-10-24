// The only way state or events leave the engine for a given seat (R-DG-6). Anything not owned by
// the viewer — other players' face-down cards, deck order, RNG state — is stripped here.

import { isAlive } from "./state";
import type { GameEvent, GameState, PhaseView, PlayerId, PlayerView } from "./types";

/** `viewerId` null = spectator (sees only public information). */
export function getPlayerView(state: GameState, viewerId: PlayerId | null): PlayerView {
  const { phase } = state;
  const phaseView: PhaseView =
    phase.kind === "AWAIT_EXCHANGE"
      ? { ...phase, options: phase.playerId === viewerId ? [...phase.options] : null }
      : structuredClone(phase);

  return {
    viewerId,
    players: state.players.map((p) => ({
      id: p.id,
      coins: p.coins,
      eliminated: !isAlive(p),
      cards: p.cards.map((card) =>
        card.revealed
          ? { revealed: true, role: card.role }
          : { revealed: false, role: p.id === viewerId ? card.role : null },
      ),
    })),
    deckSize: state.deck.length,
    turnNumber: state.turnNumber,
    turn: structuredClone(state.turn),
    phase: phaseView,
    phaseId: state.phaseId,
  };
}

/** Removes private details from events for a given viewer. */
export function getEventsForViewer(events: GameEvent[], viewerId: PlayerId | null): GameEvent[] {
  return events.map((event) => {
    if (event.type === "CARD_REPLACED" && event.playerId !== viewerId) {
      return { ...event, newRole: null };
    }
    if (event.type === "EXCHANGE_STARTED" && event.playerId !== viewerId) {
      return { ...event, drawn: null };
    }
    return event;
  });
}
