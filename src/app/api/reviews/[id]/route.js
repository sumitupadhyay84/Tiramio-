import { NextResponse } from 'next/server';
import { getReviewForCustomerEdit, updateCustomerReview } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getReviewForCustomerEditPg, updateCustomerReviewPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || request.headers.get('x-review-edit-token') || '';

    const review = hasDatabase()
      ? await getReviewForCustomerEditPg(id, token)
      : getReviewForCustomerEdit(id, token);
    if (!review) {
      return NextResponse.json(
        { message: 'Review not found or your edit link token is invalid.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('GET /api/reviews/[id] error:', error);
    return NextResponse.json({ message: 'Failed to load review.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const editToken = request.headers.get('x-review-edit-token') || body.editToken || '';

    const result = hasDatabase()
      ? await updateCustomerReviewPg(id, editToken, body)
      : updateCustomerReview(id, editToken, body);
    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: result.statusCode || 400 });
    }

    return NextResponse.json({
      message: 'Your review has been updated and queued for moderation. Your previous version is preserved in audit history.',
      review: result.review
    });
  } catch (error) {
    console.error('PATCH /api/reviews/[id] error:', error);
    return NextResponse.json({ message: 'Failed to update review.' }, { status: 500 });
  }
}
