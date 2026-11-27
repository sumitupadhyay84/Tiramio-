import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { getAdminStats } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getAdminStatsPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const stats = hasDatabase() ? await getAdminStatsPg() : getAdminStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('GET /api/admin/reviews/stats error:', error);
    return NextResponse.json({ message: 'Failed to load review statistics.' }, { status: 500 });
  }
}
