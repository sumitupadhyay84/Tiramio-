import { NextResponse } from 'next/server';
import { getPublicStats } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getPublicStatsPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = hasDatabase() ? await getPublicStatsPg() : getPublicStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching public review stats:', error);
    return NextResponse.json({
      averageRating: 0,
      totalReviews: 0,
      verifiedPurchaseCount: 0,
      distribution: {
        5: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        1: { count: 0, percentage: 0 },
      },
      recommendationPercentage: null,
      recommendationResponseCount: 0,
      productAverages: [],
    });
  }
}
