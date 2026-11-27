import { handleAdminModeration } from '@/lib/adminModeration';

export async function PATCH(request, { params }) {
  return handleAdminModeration(request, params, {
    action: 'RESTORE',
    defaultReason: 'Restored to published state by administrator'
  });
}
