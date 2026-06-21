import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, DollarSign, Play, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Payroll { id: string; staffId: string; periodStart: string; periodEnd: string; regularHours: number; baseWages: number; tips: number; commissions: number; netPay: number; isPaid: boolean }
interface TimeEntry { id: string; clockIn: string; clockOut?: string; hoursWorked?: number; staff: { firstName: string; lastName: string } }

export default function PayrollPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const merchantId = user?.merchantId!;
  const storeId = user?.storeId!;
  const [tab, setTab] = useState<'timeclock' | 'payroll'>('timeclock');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const { data: activeStaff } = useQuery({ queryKey: ['timeclock-active', storeId], queryFn: () => api.get(`/timeclock/active?storeId=${storeId}`).then((r) => r.data.data), refetchInterval: 30000 });
  const { data: entries } = useQuery({ queryKey: ['timeclock', storeId], queryFn: () => api.get(`/timeclock?storeId=${storeId}&limit=50`).then((r) => r.data.data) });
  const { data: payrolls } = useQuery({ queryKey: ['payrolls', merchantId], queryFn: () => api.get(`/timeclock/payroll?merchantId=${merchantId}&storeId=${storeId}`).then((r) => r.data.data) });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/timeclock/payroll/generate', { merchantId, storeId, periodStart, periodEnd }),
    onSuccess: () => { toast.success('Payroll generated'); qc.invalidateQueries({ queryKey: ['payrolls'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/timeclock/payroll/${id}/pay`),
    onSuccess: () => { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['payrolls'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payroll & Time Clock</h1>

      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 mb-6 w-64">
        <button onClick={() => setTab('timeclock')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'timeclock' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Time Clock</button>
        <button onClick={() => setTab('payroll')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'payroll' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Payroll</button>
      </div>

      {tab === 'timeclock' && (
        <div className="space-y-5">
          {activeStaff?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-success-500" /> Currently Clocked In ({activeStaff.length})</h2>
              <div className="flex flex-wrap gap-2">
                {activeStaff.map((e: { id: string; clockIn: string; staff: { firstName: string; lastName: string } }) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-success-50 border border-success-200 rounded-xl text-sm">
                    <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                    <span className="font-medium text-success-700">{e.staff.firstName} {e.staff.lastName}</span>
                    <span className="text-success-500 text-xs">since {format(new Date(e.clockIn), 'h:mm a')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="card-header"><h2 className="font-semibold">Recent Time Entries</h2></div>
            <table className="table">
              <thead><tr><th>Staff</th><th>Clock In</th><th>Clock Out</th><th className="text-right">Hours</th></tr></thead>
              <tbody>
                {(entries || []).map((e: TimeEntry) => (
                  <tr key={e.id}>
                    <td className="font-medium">{e.staff.firstName} {e.staff.lastName}</td>
                    <td className="text-sm">{format(new Date(e.clockIn), 'MMM d, h:mm a')}</td>
                    <td className="text-sm">{e.clockOut ? format(new Date(e.clockOut), 'h:mm a') : <span className="badge-green">Active</span>}</td>
                    <td className="text-right font-mono">{e.hoursWorked ? parseFloat(String(e.hoursWorked)).toFixed(2) : '—'}</td>
                  </tr>
                ))}
                {!entries?.length && <tr><td colSpan={4} className="text-center py-6 text-gray-400">No entries</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Generate Payroll</h2>
            <div className="flex gap-3 items-end">
              <div><label className="label">Period Start</label><input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
              <div><label className="label">Period End</label><input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
              <button className="btn-primary" onClick={() => generateMutation.mutate()} disabled={!periodStart || !periodEnd || generateMutation.isPending}>
                <Play className="w-4 h-4" />{generateMutation.isPending ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>Staff</th><th>Period</th><th className="text-right">Hours</th><th className="text-right">Wages</th><th className="text-right">Tips</th><th className="text-right">Commissions</th><th className="text-right">Net Pay</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(payrolls || []).map((p: Payroll) => (
                  <tr key={p.id}>
                    <td className="text-sm font-medium">{p.staffId.slice(0, 8)}…</td>
                    <td className="text-xs text-gray-500">{format(new Date(p.periodStart), 'MMM d')} – {format(new Date(p.periodEnd), 'MMM d')}</td>
                    <td className="text-right text-sm">{parseFloat(String(p.regularHours)).toFixed(2)}</td>
                    <td className="text-right text-sm">${parseFloat(String(p.baseWages)).toFixed(2)}</td>
                    <td className="text-right text-sm text-success-600">${parseFloat(String(p.tips)).toFixed(2)}</td>
                    <td className="text-right text-sm text-primary-600">${parseFloat(String(p.commissions)).toFixed(2)}</td>
                    <td className="text-right font-bold">${parseFloat(String(p.netPay)).toFixed(2)}</td>
                    <td>{p.isPaid ? <span className="badge-green flex items-center gap-1"><CheckCircle className="w-3 h-3" />Paid</span> : <span className="badge-yellow">Pending</span>}</td>
                    <td>{!p.isPaid && <button onClick={() => markPaidMutation.mutate(p.id)} className="btn-success btn-sm"><DollarSign className="w-3.5 h-3.5" />Pay</button>}</td>
                  </tr>
                ))}
                {!payrolls?.length && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No payroll records yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
