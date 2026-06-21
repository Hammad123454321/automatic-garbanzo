import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '@/lib/api';

export default function BillingPage() {
  const { data } = useQuery({ queryKey: ['billing'], queryFn: () => api.get('/super-admin/billing').then((r) => r.data.data) });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing Events</h1>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Date</th><th>Merchant</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {!data?.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No billing events yet</td></tr>}
            {data?.map((e: { id: string; createdAt: string; merchant: { name: string }; type: string; description: string; amount: number }) => (
              <tr key={e.id}>
                <td className="text-gray-500 text-xs">{format(new Date(e.createdAt), 'MMM d, yyyy')}</td>
                <td className="font-medium">{e.merchant.name}</td>
                <td><span className="badge-blue">{e.type}</span></td>
                <td className="text-gray-600">{e.description}</td>
                <td className="text-right font-medium">${parseFloat(String(e.amount)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
