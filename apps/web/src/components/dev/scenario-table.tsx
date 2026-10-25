"use client";

import { getTheme } from "@chibi-bluff/themes";
import { useEffect, useState } from "react";
import { GameTable } from "@/components/table/game-table";
import { ScenarioHost, stagedGame } from "@/game/scenario-host";
import { useI18n } from "@/i18n/client";

type Scenario = "replacement";

/** Builds the host for a scenario by playing the engine up to the interesting moment. */
function build(scenario: Scenario, names: { you: string }): ScenarioHost {
  const theme = getTheme();
  const seats = [
    { id: "you", name: names.you, kind: "human" as const, avatar: "contessa" as const },
    {
      id: "bot-1",
      name: theme.roles.duke.botName.vi,
      kind: "bot" as const,
      avatar: "duke" as const,
    },
    {
      id: "bot-2",
      name: theme.roles.captain.botName.vi,
      kind: "bot" as const,
      avatar: "captain" as const,
    },
  ];
  const state = stagedGame(
    {
      you: ["duke", "contessa"],
      "bot-1": ["captain", "assassin"],
      "bot-2": ["ambassador", "captain"],
    },
    "you",
  );
  const host = new ScenarioHost(seats, state, "you");
  if (scenario === "replacement") {
    // You claim Duke truthfully, bot-1 challenges and loses a card: you now pick a replacement.
    host.apply({ type: "DECLARE", playerId: "you", action: "tax" });
    host.apply({ type: "CHALLENGE", playerId: "bot-1" });
    host.apply({ type: "CHOOSE_LOSS", playerId: "bot-1", cardIndex: 1 });
  }
  return host;
}

export function ScenarioTable() {
  const { dict } = useI18n();
  const [host, setHost] = useState<ScenarioHost | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void round;
    const next = build("replacement", { you: dict.game.setup.defaultName });
    setHost(next);
    return () => next.dispose();
  }, [round, dict]);

  if (!host) return null;
  return <GameTable host={host} theme={getTheme()} onNewGame={() => setRound((r) => r + 1)} />;
}
