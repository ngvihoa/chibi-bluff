"use client";

import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { GameButton } from "@/components/game-button";
import { GameTable } from "@/components/table/game-table";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { savedName } from "@/online/connection";
import { RoomClient, type RoomState } from "@/online/room-client";
import { useErrorText } from "./error-text";
import { Lobby } from "./lobby";

/** /room/[code]: asks for a name if needed, then the lobby, then the shared game table. */
export function OnlineRoom({ code }: { code: string }) {
  const { locale } = useI18n();
  const [client, setClient] = useState<RoomClient | null>(null);

  // One client per room page visit; it takes a remembered seat back on its own.
  useEffect(() => {
    const theme = getTheme();
    const next = new RoomClient(code, (avatar) => theme.roles[avatar].botName[locale]);
    setClient(next);
    // Next tick: a mount React throws away at once (dev Strict Mode) never sends a join, so
    // a guest without a saved seat cannot end up sitting twice.
    const timer = setTimeout(() => next.start(), 0);
    return () => {
      clearTimeout(timer);
      next.dispose();
    };
  }, [code, locale]);

  if (!client) return null;
  return <RoomScreen client={client} />;
}

/** Nothing to show while prerendering: the room only exists in the browser. */
const NO_STATE = () => null;

function RoomScreen({ client }: { client: RoomClient }) {
  const { locale, dict } = useI18n();
  const t = dict.online;
  const router = useRouter();
  const errorText = useErrorText();
  const theme = getTheme();
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, NO_STATE);
  if (!state) return null;

  const leave = async () => {
    await client.leave();
    router.push(`/${locale}`);
  };
  const newRoom = async () => {
    await client.leave();
    router.push(`/${locale}/online`);
  };

  let screen: ReactNode;
  if (state.stage === "needName") {
    screen = <NameForm code={state.code} onJoin={(name) => client.join(name)} />;
  } else if (state.stage === "failed" || state.stage === "kicked" || state.stage === "replaced") {
    screen = (
      <Message
        text={
          state.stage === "kicked"
            ? t.kicked
            : state.stage === "replaced"
              ? t.replaced
              : errorText(state.error ?? "other")
        }
        homeLabel={t.home}
        homeHref={`/${locale}`}
      />
    );
  } else if (state.stage !== "inRoom" || !state.room) {
    screen = <Message text={t.connecting} />;
  } else if (state.room.status !== "lobby" && state.game) {
    screen = (
      <GameTable
        host={state.game}
        theme={theme}
        onNewGame={newRoom}
        againLabel={t.lobby.newRoom}
        leaveConfirm={t.lobby.tableLeaveConfirm}
      />
    );
  } else {
    screen = <Lobby room={state.room} client={client} theme={theme} onLeave={leave} />;
  }

  return (
    <>
      {screen}
      <OfflineBanner state={state} text={t.offline} />
    </>
  );
}

/** Shown while the connection is down; the socket keeps retrying on its own. */
function OfflineBanner({ state, text }: { state: RoomState; text: string }) {
  if (state.stage !== "inRoom" || state.online) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-3 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md rounded-2xl border-3 border-outline bg-gold px-3 py-1.5 text-center text-sm font-extrabold text-outline shadow-hard-sm"
    >
      {text}
    </p>
  );
}

function NameForm({ code, onJoin }: { code: string; onJoin: (name: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.online;
  const [name, setName] = useState("");
  useEffect(() => setName(savedName()), []);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-6">
      <h1 className="text-game text-center text-3xl">{format(t.joinRoomTitle, { code })}</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(name.trim().slice(0, 16) || dict.game.setup.defaultName);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="font-bold">{t.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={dict.game.setup.defaultName}
            maxLength={16}
            autoComplete="nickname"
            className="min-h-12 rounded-2xl border-3 border-outline bg-panel px-4 text-lg text-ink placeholder:text-muted/60"
          />
        </label>
        <GameButton type="submit" variant="primary">
          {t.join}
        </GameButton>
      </form>
      <Link
        href={`/${locale}`}
        className="text-center font-bold text-gold underline underline-offset-4"
      >
        {t.home}
      </Link>
    </main>
  );
}

function Message({
  text,
  homeLabel,
  homeHref,
}: {
  text: string;
  homeLabel?: string;
  homeHref?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-game-sm text-2xl">{text}</p>
      {homeHref && homeLabel && (
        <GameButton href={homeHref} variant="neutral">
          {homeLabel}
        </GameButton>
      )}
    </main>
  );
}
