import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAdminReviews } from '@/lib/reviewsStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '15';
  const status = searchParams.get('status') || '';
  const product = searchParams.get('product') || '';
  const rating = searchParams.get('rating') || '';
  const verification = searchParams.get('verification') || '';
  const flagged = searchParams.get('flagged') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'newest';

  const data = getAdminReviews({ page, limit, status, product, rating, verification, flagged, search, sort });
  return NextResponse.json(data);
}
