import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { updateReviewStatus } from '@/lib/reviewsStore';

export async function PATCH(request, { params }) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const moderatedBy = body.moderatedBy || 'Store Admin';

  const updated = updateReviewStatus(id, 'APPROVED', moderatedBy);
  if (!updated) {
    return NextResponse.json({ message: 'Review not found.' }, { status: 404 });
  }

  return NextResponse.json({ review: updated });
}
