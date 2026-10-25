import { notFound } from "next/navigation";
import { ScenarioTable } from "@/components/dev/scenario-table";

// Developer page: the real game table in a hand-built situation. Not shipped in production.
export default function DevTablePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ScenarioTable />;
}
