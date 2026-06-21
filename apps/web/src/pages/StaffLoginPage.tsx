import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Keyboard, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [storeId, setStoreId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePinKey(key: string) {
    if (key === 'C') { setPin(''); return; }
    if (key === '⌫') { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 6) setPin((p) => p + key);
  }

  async function handlePinSubmit() {
    if (!storeId || pin.length < 4) { toast.error('Enter store ID and PIN'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/staff/pin-login', { pin, storeId });
      setAuth({ id: data.data.user.id, type: 'staff', firstName: data.data.user.firstName, lastName: data.data.user.lastName, username: data.data.user.username, merchantId: data.data.user.merchantId, storeId: data.data.user.storeId, businessMode: data.data.user.businessMode, roles: data.data.user.roles }, data.data.accessToken, data.data.refreshToken);
      navigate('/pos');
    } catch (err) {
      toast.error(extractError(err)); setPin('');
    } finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) { toast.error('Store ID required'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/staff/login', { username, password, storeId });
      setAuth({ id: data.data.user.id, type: 'staff', firstName: data.data.user.firstName, lastName: data.data.user.lastName, username: data.data.user.username, merchantId: data.data.user.merchantId, storeId: data.data.user.storeId, businessMode: data.data.user.businessMode, roles: data.data.user.roles }, data.data.accessToken, data.data.refreshToken);
      navigate('/pos');
    } catch (err) {
      toast.error(extractError(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3">
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Staff Login</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="mb-4">
            <label className="label">Store ID</label>
            <input className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="Enter your store ID" />
          </div>

          {/* Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
            <button onClick={() => setMode('pin')} className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${mode === 'pin' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              <Keyboard className="w-3.5 h-3.5" /> PIN
            </button>
            <button onClick={() => setMode('password')} className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${mode === 'password' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              <User className="w-3.5 h-3.5" /> Username
            </button>
          </div>

          {mode === 'pin' ? (
            <div>
              <div className="flex justify-center mb-4">
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${i < pin.length ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50'}`}>
                      {i < pin.length ? '●' : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PIN_KEYS.map((key) => (
                  <button key={key} onClick={() => handlePinKey(key)} className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${key === 'C' ? 'bg-warning-50 text-warning-600 hover:bg-warning-100' : key === '⌫' ? 'bg-danger-50 text-danger-600 hover:bg-danger-100' : 'bg-gray-50 text-gray-800 hover:bg-gray-100 border border-gray-200'}`}>
                    {key}
                  </button>
                ))}
              </div>
              <button onClick={handlePinSubmit} disabled={loading || pin.length < 4} className="btn-primary w-full btn-lg">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="label">Username</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full btn-lg mt-2">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            <Link to="/login" className="text-primary-600 hover:underline">← Admin / Super Admin login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
