import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, Clock, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Appointment { id: string; customerName: string; customerPhone?: string; status: string; startTime: string; endTime: string; services: { service: { name: string; price: number }; staff?: { firstName: string; lastName: string } }[] }
interface Service { id: string; name: string; price: number; duration: number }
interface Staff { id: string; firstName: string; lastName: string }

const STATUS_COLORS: Record<string, string> = { PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', IN_PROGRESS: 'badge-blue', COMPLETED: 'badge-green', CANCELLED: 'badge-red', NO_SHOW: 'badge-gray' };

export default function AppointmentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const storeId = user?.storeId!;
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', startTime: '', serviceId: '', staffId: '' });

  const { data: appts } = useQuery<Appointment[]>({ queryKey: ['appointments', storeId, date], queryFn: () => api.get(`/salon/appointments?storeId=${storeId}&date=${date}`).then((r) => r.data.data) });
  const { data: services } = useQuery<Service[]>({ queryKey: ['services', storeId], queryFn: () => api.get(`/products/services?storeId=${storeId}`).then((r) => r.data.data) });
  const { data: staff } = useQuery<Staff[]>({ queryKey: ['staff', user?.merchantId], queryFn: () => api.get(`/staff?merchantId=${user?.merchantId}&limit=100`).then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form & { storeId: string; services: unknown[] }) => api.post('/salon/appointments', body),
    onSuccess: () => { toast.success('Appointment booked'); qc.invalidateQueries({ queryKey: ['appointments'] }); setShowForm(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/salon/appointments/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (e) => toast.error(extractError(e)),
  });

  function handleCreate() {
    const service = services?.find((s) => s.id === form.serviceId);
    if (!service) { toast.error('Select a service'); return; }
    createMutation.mutate({ ...form, storeId, services: [{ serviceId: service.id, staffId: form.staffId || undefined, duration: service.duration, price: service.price }] });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Booking</button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <Calendar className="w-4 h-4 text-gray-400" />
        <input className="input w-48" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="text-sm text-gray-500">{appts?.length || 0} appointments</span>
      </div>

      {showForm && (
        <div className="card mb-5 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Appointment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Customer Name *</label><input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></div>
            <div><label className="label">Date & Time *</label><input className="input" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="label">Service *</label>
              <select className="select" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                <option value="">Select service</option>
                {(services || []).map((s) => <option key={s.id} value={s.id}>{s.name} — ${s.price} ({s.duration}min)</option>)}
              </select>
            </div>
            <div><label className="label">Staff (optional)</label>
              <select className="select" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Any staff</option>
                {(staff || []).map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? 'Booking…' : 'Book Appointment'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {!appts?.length && <div className="text-center py-12 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No appointments for this day</p></div>}
        {(appts || []).map((appt) => (
          <div key={appt.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">{appt.customerName[0]}</div>
                <div>
                  <p className="font-semibold text-gray-900">{appt.customerName}</p>
                  {appt.customerPhone && <p className="text-xs text-gray-400">{appt.customerPhone}</p>}
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{format(parseISO(appt.startTime), 'h:mm a')} – {format(parseISO(appt.endTime), 'h:mm a')}</span>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {appt.services.map((svc, i) => (
                      <div key={i} className="text-xs text-gray-600">{svc.service.name} — ${svc.service.price}{svc.staff && ` with ${svc.staff.firstName}`}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={STATUS_COLORS[appt.status] || 'badge-gray'}>{appt.status}</span>
                <div className="flex gap-1">
                  {['CONFIRMED','IN_PROGRESS','COMPLETED','NO_SHOW','CANCELLED'].filter((s) => s !== appt.status).map((s) => (
                    <button key={s} onClick={() => updateStatusMutation.mutate({ id: appt.id, status: s })} className={`btn-sm ${s === 'CANCELLED' || s === 'NO_SHOW' ? 'btn-danger' : s === 'COMPLETED' ? 'btn-success' : 'btn-secondary'}`} title={s}>{s.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
