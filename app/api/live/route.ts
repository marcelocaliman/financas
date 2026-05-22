import { NextResponse } from "next/server";
import { getLivePortfolio } from "@/services/live-yield";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const live = await getLivePortfolio();
    return NextResponse.json({
      perSecond: live.totalPerSecond,
      dailyYield: live.totalDailyYield,
      marketBalance: live.totalMarketBalance,
    });
  } catch {
    return NextResponse.json({ perSecond: 0, dailyYield: 0, marketBalance: 0 }, { status: 200 });
  }
}
