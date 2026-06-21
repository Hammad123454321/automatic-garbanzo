import { Outlet, useNavigate } from 'react-router-dom';
import { Settings, ClipboardList, Map, BookOpen, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useAuthStore as useAuth } from '@/stores/authStore';

export default function PosLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <header className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-primary-400">POS</span>
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{user?.businessMode || 'RETAIL'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/pos')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
            <BookOpen className="w-3.5 h-3.5" /> Register
          </button>
          <button onClick={() => navigate('/pos/table-map')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
            <Map className="w-3.5 h-3.5" /> Tables
          </button>
          <button onClick={() => navigate('/pos/held-orders')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
            <ClipboardList className="w-3.5 h-3.5" /> Held
          </button>
          <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
            <Settings className="w-3.5 h-3.5" /> Admin
          </button>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          <span className="text-xs text-gray-400">{user?.firstName} {user?.lastName}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
