import { NextResponse } from 'next/server';
import { getPublicReviews, createReview } from '@/lib/reviewsStore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '6';
  const product = searchParams.get('product') || '';
  const rating = searchParams.get('rating') || '';
  const sort = searchParams.get('sort') || 'newest';

  const data = getPublicReviews({ page, limit, product, rating, sort });
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let payload = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        if (key === 'feedbackTags') {
          try { payload[key] = JSON.parse(val); } catch { payload[key] = []; }
        } else if (key !== 'image') {
          payload[key] = val;
        }
      });
    } else {
      payload = await request.json().catch(() => ({}));
    }

    // Honeypot check (anti-bot)
    if (payload.honeypot) {
      return NextResponse.json({ message: 'Thank you for your review!' }, { status: 200 });
    }

    // Validation
    const customerName = String(payload.customerName || '').trim();
    const productName = payload.productName;
    const overallRating = Number(payload.overallRating);
    const comment = String(payload.comment || '').trim();

    if (!customerName || customerName.length < 2) {
      return NextResponse.json({ message: 'Please provide a valid name.' }, { status: 400 });
    }
    if (!productName) {
      return NextResponse.json({ message: 'Please select the product purchased.' }, { status: 400 });
    }
    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return NextResponse.json({ message: 'Overall rating must be between 1 and 5 stars.' }, { status: 400 });
    }
    if (!comment || comment.length < 10) {
      return NextResponse.json({ message: 'Your review comment should be at least 10 characters.' }, { status: 400 });
    }

    // Strip HTML tags (XSS prevention)
    const cleanComment = comment.replace(/<[^>]*>/g, '').trim();
    const cleanName = customerName.replace(/<[^>]*>/g, '').trim();

    const review = createReview({
      ...payload,
      customerName: cleanName,
      comment: cleanComment
    });

    return NextResponse.json({
      message: 'Thank you for your review! It will appear after moderation.',
      reviewId: review.id
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to submit review. Please try again.' }, { status: 500 });
  }
}
