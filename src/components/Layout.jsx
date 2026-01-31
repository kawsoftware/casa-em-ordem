import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, BarChart2, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

export default function Layout({ children }) {
    const { signOut, profile } = useAuth();
    const location = useLocation();

    const navItems = [
        { label: 'Aprovação de Notas', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Gestão de Serviços', path: '/services', icon: Briefcase },
        { label: 'Colaboradores', path: '/collaborators', icon: Users },
        { label: 'Relatórios', path: '/reports', icon: BarChart2 },
    ];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-900 font-sans">
            <aside className="w-64 bg-[#0F172A] text-gray-400 flex flex-col border-r border-gray-800 shrink-0">
                <div className="p-6 h-16 flex items-center border-b border-gray-800">
                    <div className="flex items-center gap-2 text-white">
                        <Building2 className="h-6 w-6 text-indigo-500" />
                        <span className="font-bold tracking-tight text-lg">CasaEmOrdem</span>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-4">
                    <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Menu Principal</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium",
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                                        : "hover:bg-white/5 hover:text-gray-200"
                                )}
                            >
                                <Icon size={18} className={clsx(isActive ? "text-white" : "text-gray-500")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800 bg-[#0B1120]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                            {profile?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'Usuário'}</p>
                            <p className="text-xs text-gray-500 capitalize truncate">{profile?.role || 'Viewer'}</p>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-xs font-medium transition-colors w-full px-1"
                    >
                        <LogOut size={14} />
                        Encerrar Sessão
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative">
                <div className="flex-1 overflow-auto w-full h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
