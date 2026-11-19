import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { deleteReview } from '@/lib/reviewsStore';

export async function DELETE(request, { params }) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteReview(id);
  if (!deleted) {
    return NextResponse.json({ message: 'Review not found.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
