import { NextResponse } from "next/server";
import { ENGINE_CONFIG } from "@/config/engine";
import { getSnapshot } from "@/lib/data";
import { runEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    const strategies = runEngine(snapshot);
    return NextResponse.json(
      {
        fetchedAt: snapshot.fetchedAt,
        source: snapshot.source,
        stale: snapshot.stale ?? false,
        dustPriceUsd: snapshot.dustPriceUsd,
        principalUsd: ENGINE_CONFIG.principalUsd,
        minNetApr: ENGINE_CONFIG.minNetApr,
        strategies,
        // Raw rates, so the page can re-run the (pure) engine for a different amount.
        snapshot,
      },
      // Lets a CDN (e.g. Vercel) share one response across visitors for a minute.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("[api/strategies]", err);
    return NextResponse.json({ error: "Could not load live rates right now. Please try again shortly." }, { status: 503 });
  }
}
