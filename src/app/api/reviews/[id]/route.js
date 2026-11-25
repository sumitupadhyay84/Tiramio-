import { NextResponse } from 'next/server';
import { getReviewForCustomerEdit, updateCustomerReview } from '@/lib/reviewsStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || request.headers.get('x-review-edit-token') || '';

  const review = getReviewForCustomerEdit(id, token);
  if (!review) {
    return NextResponse.json(
      { message: 'Review not found or your edit link token is invalid.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ review });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const editToken = request.headers.get('x-review-edit-token') || body.editToken || '';

  const result = updateCustomerReview(id, editToken, body);
  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({
    message: 'Your review has been updated and queued for moderation. Your previous version is preserved in audit history.',
    review: result.review
  });
}
