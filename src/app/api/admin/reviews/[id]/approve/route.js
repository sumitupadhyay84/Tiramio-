import { handleAdminModeration } from '@/lib/adminModeration';

export async function PATCH(request, { params }) {
  return handleAdminModeration(request, params, {
    action: 'APPROVE',
    defaultReason: 'Approved for publication'
  });
}
