import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Search, MapPin, CheckCircle, Clock, UserPlus, X, Loader2, AlertCircle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

export default function Collaborators() {
    const { profile, user } = useAuth(); // Logged-in admin
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
            // Task 1: Fetch ALL profiles for this org, not just drivers
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('full_name');

            if (error) throw error;
            setProfiles(data || []);
        } catch (err) {
            console.error("Error fetching profiles:", err);
            toast.error("Erro ao carregar usuários.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (targetId, newRole) => {
        if (!confirm(`Confirmar alteração de permissão para "${newRole}"?`)) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', targetId);

            if (error) throw error;
            toast.success(`Usuário atualizado para ${newRole}`);
            fetchProfiles();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao atualizar permissão.");
        }
    };

    const handleCreateDriver = async (e) => {
        e.preventDefault();

        // --- Logic Branch: System Access Invite ---
        if (newDriver.type === 'access') {
            if (!newDriver.fullName || !newDriver.email) {
                toast.error("Nome e E-mail são obrigatórios.");
                return;
            }

            setSubmitLoading(true);
            try {
                // 1. Check Session explicitly (to handle the "Refresh token not found" issues)
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    toast.error("Sessão expirada. Por favor, faça login novamente.");
                    window.location.reload();
                    return;
                }

                // 2. Invoke Edge Function
                const { data, error } = await supabase.functions.invoke('admin-invite', {
                    body: {
                        fullName: newDriver.fullName,
                        email: newDriver.email,
                        role: newDriver.accessRole || 'manager',
                        organization_id: profile.organization_id
                    }
                });

                // 3. Handle 4xx/5xx Errors from Edge Function
                if (error) {
                    let errorMessage = "Erro na comunicação com o servidor.";

                    // Try to parse the error response body if it's a FunctionsHttpError
                    if (error.context && typeof error.context.json === 'function') {
                        try {
                            const body = await error.context.json();
                            errorMessage = body.details || body.error || error.message;
                        } catch (e) {
                            console.error("Failed to parse error body", e);
                        }
                    } else {
                        errorMessage = error.message;
                    }

                    throw new Error(errorMessage);
                }

                // 4. Handle Logic Errors returned in 200 JSON
                if (data?.error) {
                    throw new Error(data.details?.message || data.error);
                }

                toast.success("Convite enviado com sucesso!");
                setIsModalOpen(false);
                setNewDriver({ fullName: '', whatsapp: '', email: '', type: 'no_access' });
                fetchProfiles();

            } catch (err) {
                console.error("Detailed Invite Error:", err);
                toast.error(err.message || "Erro ao processar convite.");
            } finally {
                setSubmitLoading(false);
            }
            return;
        }

        // --- Logic Branch: Simple Collaborator (Existing) ---
        // --- JIT Organization Fix ---
        if (!profile?.organization_id) {
            // Use a custom toast with action button instead of browser confirm
            toast('Perfil sem organização vinculada', {
                description: "Deseja criar uma 'Minha Empresa' agora?",
                action: {
                    label: 'Criar Agora',
                    onClick: async () => {
                        setSubmitLoading(true);
                        try {
                            // 1. Create Org
                            let createdOrg = null;

                            const { data: newOrg, error: orgError } = await supabase
                                .from('organizations')
                                .insert({ name: 'Minha Empresa', created_at: new Date() })
                                .select()
                                .single();

                            if (orgError) {
                                if (orgError.message?.includes('violates row-level security')) {
                                    throw new Error("Permissão negada pelo banco de dados. Contate o suporte para liberar criação de empresas.");
                                }
                                throw orgError;
                            }

                            createdOrg = newOrg;

                            if (!createdOrg) {
                                throw new Error("Organização criada, mas não foi possível recuperar o ID (RLS de Select bloqueando?)");
                            }

                            // 2. Link to Profile
                            const { error: profileError } = await supabase
                                .from('profiles')
                                .update({ organization_id: createdOrg.id })
                                .eq('id', user.id);

                            if (profileError) throw profileError;

                            toast.success("Organização criada! Atualizando...");
                            setTimeout(() => window.location.reload(), 1500);

                        } catch (err) {
                            if (err.name !== 'AbortError') {
                                console.error(err);
                                toast.error(err.message || "Erro ao criar organização.");
                            }
                            setSubmitLoading(false);
                        }
                    }
                },
                duration: 8000,
            });
            return;
        }
        // ---------------------------

        if (!newDriver.fullName) return;

        setSubmitLoading(true);
        try {
            const newId = crypto.randomUUID();

            const { error } = await supabase.from('profiles').insert({
                id: newId,
                full_name: newDriver.fullName,
                whatsapp_number: newDriver.whatsapp || null,
                role: 'driver', // Default is driver/collaborator
                organization_id: profile.organization_id
            });

            if (error) throw error;

            toast.success("Colaborador criado com sucesso!");
            setNewDriver({ fullName: '', whatsapp: '' });
            setIsModalOpen(false);
            fetchProfiles();

        } catch (err) {
            console.error("Error creating driver:", err);
            toast.error("Erro ao criar colaborador. Verifique se o WhatsApp já existe.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.whatsapp_number?.includes(searchTerm)
    );

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200"><ShieldCheck size={10} /> Admin</span>;
            case 'manager': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200"><Shield size={10} /> Gerente</span>;
            case 'driver': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Colaborador</span>;
            default: return <span className="text-xs text-gray-400">{role}</span>;
        }
    };

    const isAdmin = profile?.role === 'admin';

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestão de Usuários</h1>
                    <p className="text-gray-500 mt-1">Gerencie permissões e colaboradores da organização.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    Novo Usuário
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
                                <th className="px-6 py-3">Contato</th>
                                <th className="px-6 py-3">Função (Role)</th>
                                <th className="px-6 py-3">Alocação</th>
                                {isAdmin && <th className="px-6 py-3 text-right">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Carregando...</td></tr>
                            ) : filteredProfiles.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Nenhum usuário encontrado.</td></tr>
                            ) : (
                                filteredProfiles.map(p => {
                                    const isAllocated = !!p.current_cost_center_id;
                                    const isMe = p.id === user?.id; // Don't demote yourself perfectly

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
                                                        {p.full_name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold">{p.full_name}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono">ID: {p.id.slice(0, 6)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                                {p.whatsapp_number || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getRoleBadge(p.role)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isAllocated ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        <MapPin size={12} />
                                                        {p.cost_centers?.code || 'Alocado'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                                                        <Clock size={12} />
                                                        Livre
                                                    </span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-4 text-right">
                                                    {!isMe && (
                                                        <div className="flex justify-end gap-2">
                                                            {p.role !== 'manager' && p.role !== 'admin' && (
                                                                <button
                                                                    onClick={() => handleUpdateRole(p.id, 'manager')}
                                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100 hover:border-blue-200 transition-colors"
                                                                >
                                                                    Promover a Gerente
                                                                </button>
                                                            )}
                                                            {p.role === 'manager' && (
                                                                <button
                                                                    onClick={() => handleUpdateRole(p.id, 'driver')}
                                                                    className="text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-100 hover:border-amber-200 transition-colors"
                                                                >
                                                                    Rebaixar
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
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
                            <h3 className="font-bold text-gray-900">Novo Usuário / Colaborador</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="p-6">
                            {/* Tabs for User Type */}
                            <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
                                <button
                                    onClick={() => setNewDriver(prev => ({ ...prev, type: 'no_access' }))}
                                    className={clsx(
                                        "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                                        newDriver.type !== 'access' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Apenas Colaborador
                                </button>
                                <button
                                    onClick={() => setNewDriver(prev => ({ ...prev, type: 'access' }))}
                                    className={clsx(
                                        "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                                        newDriver.type === 'access' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Acesso ao Sistema
                                </button>
                            </div>

                            <form onSubmit={handleCreateDriver} className="space-y-4">
                                {newDriver.type === 'access' ? (
                                    <div className="bg-purple-50 border border-purple-100 rounded-md p-3 text-xs text-purple-700 flex gap-2">
                                        <ShieldCheck size={16} className="shrink-0" />
                                        <div>
                                            Este usuário receberá um <strong>e-mail de convite</strong> para criar sua senha. Ele poderá acessar o painel conforme o nível escolhido.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-700 flex gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <div>
                                            Este usuário <strong>NÃO</strong> terá acesso ao sistema. Ele será usado apenas para cadastro em obras/serviços.
                                        </div>
                                    </div>
                                )}

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

                                {newDriver.type === 'access' ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">E-mail Corporativo</label>
                                            <input
                                                required
                                                type="email"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                placeholder="nome@empresa.com"
                                                value={newDriver.email || ''}
                                                onChange={e => setNewDriver({ ...newDriver, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Nível de Acesso</label>
                                            <select
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                                value={newDriver.accessRole || 'manager'}
                                                onChange={e => setNewDriver({ ...newDriver, accessRole: e.target.value })}
                                            >
                                                <option value="manager">Gerente (Acesso a seus serviços)</option>
                                                <option value="admin">Administrador (Acesso Total)</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
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
                                )}

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
                                        {submitLoading ? <Loader2 className="animate-spin h-4 w-4" /> : (newDriver.type === 'access' ? 'Enviar Convite' : 'Criar Cadastro')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
