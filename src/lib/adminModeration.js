import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { moderateReview } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { moderateReviewPg } from '@/lib/pgStore';

export async function handleAdminModeration(request, params, { action, defaultReason = '' }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const payload = {
    id,
    action,
    adminId: admin.username,
    reason: body.reason || defaultReason,
  };

  try {
    const result = hasDatabase()
      ? await moderateReviewPg(payload)
      : moderateReview(payload);

    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
    }
    return NextResponse.json({ review: result.review });
  } catch (error) {
    console.error(`Admin moderation (${action}) error:`, error);
    return NextResponse.json({ message: 'Failed to update review status.' }, { status: 500 });
  }
}
