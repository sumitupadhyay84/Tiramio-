import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAdminReviewDetails, deleteReview } from '@/lib/reviewsStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { id } = await params;
  const details = getAdminReviewDetails(id);
  if (!details) {
    return NextResponse.json({ message: 'Review not found.' }, { status: 404 });
  }

  return NextResponse.json(details);
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

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { searchParams } = new URL(request.url);
  const reasonCategory = body.reasonCategory || searchParams.get('reasonCategory') || '';
  const reason = body.reason || searchParams.get('reason') || '';

  const result = deleteReview(id, {
    adminId: admin.username,
    reasonCategory,
    reason
  });

  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({ deleted: true });
}
