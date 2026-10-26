import { Suspense } from "react";
import { OnlineRoom } from "@/components/online/online-room";

// Room codes are made up at runtime, so this page is never prerendered for a code.
export default function RoomPage({ params }: PageProps<"/[lang]/room/[code]">) {
  return (
    <Suspense fallback={null}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: Pick<PageProps<"/[lang]/room/[code]">, "params">) {
  const { code } = await params;
  return <OnlineRoom code={code.toUpperCase()} />;
}
