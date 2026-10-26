"use client";

import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";

/** Turns a server error code into a sentence for players. */
export function useErrorText() {
  const { dict } = useI18n();
  const errors: Record<string, string> = dict.online.errors;
  return (code: string) => errors[code] ?? format(dict.online.errors.other, { code });
}
