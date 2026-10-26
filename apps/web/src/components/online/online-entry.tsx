"use client";

import { PROTOCOL_VERSION, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@chibi-bluff/protocol";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameButton } from "@/components/game-button";
import { useI18n } from "@/i18n/client";
import {
  acquireSocket,
  releaseSocket,
  request,
  savedName,
  saveName,
  saveSeat,
} from "@/online/connection";
import { markAutoJoin } from "@/online/room-client";
import { useErrorText } from "./error-text";

const keepCodeChars = (raw: string) =>
  [...raw.toUpperCase()]
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);

/** Create a room, or type a code to join one (docs/architecture.md §6). */
export function OnlineEntry() {
  const { locale, dict } = useI18n();
  const t = dict.online;
  const router = useRouter();
  const errorText = useErrorText();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect early so creating a room feels instant; the room page takes the socket over.
  useEffect(() => {
    setName(savedName());
    acquireSocket();
    return releaseSocket;
  }, []);

  const playerName = () => name.trim().slice(0, 16) || dict.game.setup.defaultName;

  const create = async () => {
    setBusy(true);
    setError(null);
    const ack = await request(acquireSocket(), "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: playerName(),
      locale,
    });
    releaseSocket();
    setBusy(false);
    if (!ack.ok) {
      setError(errorText(ack.error));
      return;
    }
    saveName(playerName());
    saveSeat(ack.code, { seatId: ack.seatId, sessionToken: ack.sessionToken });
    router.push(`/${locale}/room/${ack.code}`);
  };

  const join = () => {
    saveName(playerName());
    markAutoJoin(code);
    router.push(`/${locale}/room/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl">{t.title}</h1>
      </div>

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

      <section className="flex flex-col gap-2">
        <GameButton variant="gold" onClick={create} disabled={busy}>
          {t.create}
        </GameButton>
        <p className="text-center text-sm text-muted">{t.createHint}</p>
      </section>

      <form
        className="flex flex-col gap-2 rounded-3xl border-3 border-outline bg-panel p-4 shadow-hard-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === ROOM_CODE_LENGTH) join();
        }}
      >
        <h2 className="text-game-sm text-xl">{t.joinTitle}</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(keepCodeChars(e.target.value))}
            placeholder={t.codePlaceholder}
            aria-label={t.code}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border-3 border-outline bg-bg px-4 text-center font-mono text-2xl font-extrabold tracking-[0.3em] text-ink uppercase placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-muted/60"
          />
          <GameButton
            type="submit"
            variant="neutral"
            disabled={code.length !== ROOM_CODE_LENGTH}
            className="w-auto! shrink-0"
          >
            {t.join}
          </GameButton>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-center font-bold text-danger">
          {error}
        </p>
      )}
    </main>
  );
}
