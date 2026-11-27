import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAdminReviews } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getAdminReviewsPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '15',
      status: searchParams.get('status') || '',
      product: searchParams.get('product') || '',
      rating: searchParams.get('rating') || '',
      verification: searchParams.get('verification') || '',
      flagged: searchParams.get('flagged') || '',
      search: searchParams.get('search') || '',
      sort: searchParams.get('sort') || 'newest',
    };

    const data = hasDatabase() ? await getAdminReviewsPg(query) : getAdminReviews(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/admin/reviews error:', error);
    return NextResponse.json({ message: 'Failed to load reviews.' }, { status: 500 });
  }
}
