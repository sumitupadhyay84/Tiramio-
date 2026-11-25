import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { moderateReview } from '@/lib/reviewsStore';

export async function PATCH(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = moderateReview({
    id,
    action: 'HIDE',
    adminId: admin.username,
    reason: body.reason || ''
  });

  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({ review: result.review });
}
