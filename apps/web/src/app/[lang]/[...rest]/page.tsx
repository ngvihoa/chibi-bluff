import { notFound } from "next/navigation";

// Always a 404, so there is no navigation worth validating for instant UI.
export const instant = false;

// Unknown paths under a locale render the localized [lang]/not-found page.
export default function CatchAll() {
  notFound();
}
