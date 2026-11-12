import { fetchTickets } from '@/lib/gas';
import { Dashboard } from '@/components/Dashboard';

// Always SSR the page fresh — matches the API route policy and ensures the
// initial render reflects latest ledger state.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const data = await fetchTickets();
  return <Dashboard initialData={data} />;
}
