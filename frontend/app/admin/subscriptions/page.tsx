import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import SubscriptionsClient from './SubscriptionsClient';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <SubscriptionsClient currentUser={user} />;
}
