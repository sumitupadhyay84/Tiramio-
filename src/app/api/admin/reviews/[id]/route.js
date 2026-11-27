import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAdminReviewDetails, deleteReview } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getAdminReviewDetailsPg, deleteReviewPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const details = hasDatabase() ? await getAdminReviewDetailsPg(id) : getAdminReviewDetails(id);
    if (!details) {
      return NextResponse.json({ message: 'Review not found.' }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error) {
    console.error('GET /api/admin/reviews/[id] error:', error);
    return NextResponse.json({ message: 'Failed to load review details.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  // Strict Customer Review Integrity rule: admins can never rewrite customer feedback or force verification
  return NextResponse.json(
    { message: 'Forbidden: Administrators cannot modify original customer review text, ratings, timestamps, or purchase verification.' },
    { status: 403 }
  );
}

export async function DELETE(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const reasonCategory = body.reasonCategory || searchParams.get('reasonCategory') || '';
    const reason = body.reason || searchParams.get('reason') || '';
    const payload = { adminId: admin.username, reasonCategory, reason };

    const result = hasDatabase()
      ? await deleteReviewPg(id, payload)
      : deleteReview(id, payload);

    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/reviews/[id] error:', error);
    return NextResponse.json({ message: 'Failed to delete review.' }, { status: 500 });
  }
}
