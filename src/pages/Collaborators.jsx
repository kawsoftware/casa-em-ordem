import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Search, MapPin, CheckCircle, Clock, UserPlus, X, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function Collaborators() {
    const { profile } = useAuth(); // Logged-in admin
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDriver, setNewDriver] = useState({ fullName: '', whatsapp: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        if (profile?.organization_id) {
            fetchProfiles();
        }
    }, [profile]);

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*,cost_centers(name, code)')
                .eq('role', 'driver')
                .eq('organization_id', profile.organization_id) // RLS usually handles this, but good to be explicit
                .order('full_name');

            if (error) throw error;
            setProfiles(data || []);
        } catch (err) {
            console.error("Error fetching profiles:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDriver = async (e) => {
        e.preventDefault();
        if (!profile?.organization_id) {
            alert("Erro: Organização não identificada no seu perfil.");
            return;
        }
        if (!newDriver.fullName || !newDriver.whatsapp) return;

        setSubmitLoading(true);
        try {
            const newId = crypto.randomUUID(); // Generate ID manually for Ghost User

            const { error } = await supabase.from('profiles').insert({
                id: newId,
                full_name: newDriver.fullName,
                whatsapp_number: newDriver.whatsapp,
                role: 'driver',
                organization_id: profile.organization_id
            });

            if (error) throw error;

            // Success
            setNewDriver({ fullName: '', whatsapp: '' });
            setIsModalOpen(false);
            fetchProfiles();

        } catch (err) {
            console.error("Error creating driver:", err);
            alert("Erro ao criar colaborador. Verifique se o WhatsApp já está cadastrado ou se você tem permissão.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.whatsapp_number?.includes(searchTerm)
    );

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Colaboradores</h1>
                    <p className="text-gray-500 mt-1">Gestão da força de trabalho em campo.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    Novo Colaborador
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou whatsapp..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">WhatsApp</th>
                                <th className="px-6 py-3">Status de Alocação</th>
                                <th className="px-6 py-3">Organização</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Carregando colaboradores...</td></tr>
                            ) : filteredProfiles.length === 0 ? (
                                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Nenhum colaborador encontrado.</td></tr>
                            ) : (
                                filteredProfiles.map(p => {
                                    const isAllocated = !!p.current_cost_center_id;
                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
                                                        {p.full_name?.charAt(0)}
                                                    </div>
                                                    {p.full_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                                {p.whatsapp_number || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isAllocated ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        <MapPin size={12} />
                                                        {p.cost_centers?.code || 'Alocado'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                        <Clock size={12} />
                                                        Disponível
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">
                                                ID: {p.organization_id?.slice(0, 8)}...
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Create */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Novo Colaborador</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreateDriver} className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-700 flex gap-2">
                                <AlertCircle size={16} className="shrink-0" />
                                Este usuário não terá acesso ao sistema. Ele será usado apenas para vinculação de despesas.
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Nome Completo</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Ex: João da Silva"
                                    value={newDriver.fullName}
                                    onChange={e => setNewDriver({ ...newDriver, fullName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">WhatsApp (com DDD)</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Ex: 5511999998888"
                                    value={newDriver.whatsapp}
                                    onChange={e => setNewDriver({ ...newDriver, whatsapp: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitLoading}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 text-sm flex justify-center items-center disabled:opacity-70"
                                >
                                    {submitLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Criar Cadatro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
