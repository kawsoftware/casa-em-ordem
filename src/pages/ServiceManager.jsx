import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Briefcase, Plus, Search, Layers, DollarSign, Users, Send, UserPlus,
    ArrowRight, Trash2, CheckCircle, XCircle, AlertCircle, ChevronsRight, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import StatusBadge from '../components/StatusBadge';

export default function ServiceManager() {
    const { user, profile } = useAuth();
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tabs: 'tasks' | 'expenses' | 'team'
    const [activeTab, setActiveTab] = useState('tasks');

    useEffect(() => {
        if (profile?.organization_id) {
            fetchServices();
        }
    }, [profile?.organization_id]);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('name');

            if (error) throw error;
            setServices(data || []);

            if (data?.length > 0 && !selectedService) {
                // setSelectedService(data[0]); 
            }
        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar serviços");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateService = async () => {
        if (!user || !profile?.organization_id) {
            toast.error("Erro de autenticação ou perfil incompleto.");
            return;
        }

        const name = prompt("Nome do novo Serviço / Obra:");
        if (!name) return;

        try {
            console.log(`[ServiceManager] Criando serviço para owner/manager: ${user.id}`);
            const { data, error } = await supabase
                .from('services')
                .insert({
                    organization_id: profile.organization_id,
                    name,
                    is_active: true,
                    manager_id: user.id // Injeção obrigatória do ID do criador como gestor inicial
                })
                .select()
                .single();

            if (error) throw error;
            setServices([...services, data]);
            setSelectedService(data);
            toast.success("Serviço criado com sucesso!");
        } catch (err) {
            console.error("Erro ao criar serviço:", err);
            toast.error("Erro ao criar serviço: " + (err.message || "Tente novamente"));
        }
    };

    const handleDeleteService = async (id) => {
        if (!confirm("Tem certeza? Isso pode quebrar vínculos de documentos existentes.")) return;
        try {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            setServices(services.filter(s => s.id !== id));
            if (selectedService?.id === id) setSelectedService(null);
            toast.success("Serviço removido.");
        } catch (err) {
            toast.error("Erro ao remover: verifique se há dependências.");
        }
    };

    const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="h-[calc(100vh-64px)] bg-gray-50 flex overflow-hidden">
            {/* Sidebar List */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-100 space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <Briefcase size={20} className="text-indigo-600" />
                            Serviços / Obras
                        </h2>
                        <button onClick={handleCreateService} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-md transition-colors">
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Buscar serviço..."
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="text-center p-4 text-gray-400 text-sm">Carregando...</div>
                    ) : filteredServices.length === 0 ? (
                        <div className="text-center p-8 text-gray-400 text-sm">Nenhum serviço encontrado.</div>
                    ) : (
                        filteredServices.map(service => (
                            <div
                                key={service.id}
                                onClick={() => setSelectedService(service)}
                                className={clsx(
                                    "p-3 rounded-lg cursor-pointer transition-all border border-transparent group relative",
                                    selectedService?.id === service.id
                                        ? "bg-indigo-50 border-indigo-200 shadow-sm"
                                        : "hover:bg-gray-50 hover:border-gray-200"
                                )}
                            >
                                <div className="flex justify-between items-start">
                                    <h3 className={clsx("font-medium text-sm", selectedService?.id === service.id ? "text-indigo-900" : "text-gray-700")}>
                                        {service.name}
                                    </h3>
                                    {selectedService?.id === service.id && <ChevronsRight size={16} className="text-indigo-400" />}
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className={clsx(
                                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
                                        service.is_active
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                            : "bg-gray-100 text-gray-600 border-gray-200"
                                    )}>
                                        {service.is_active ? 'ATIVO' : 'INATIVO'}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteService(service.id); }}
                                    className="absolute right-2 bottom-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {selectedService ? (
                    <ServiceDetailView service={selectedService} activeTab={activeTab} setActiveTab={setActiveTab} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <Briefcase size={48} className="mb-4 text-gray-200" />
                        <p className="text-lg font-medium text-gray-500">Selecione um Serviço</p>
                        <p className="text-sm">Gerencie tarefas, tipos de despesa e equipe alocada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component for Details to properly handle its own fetching state based on Service ID change
function ServiceDetailView({ service, activeTab, setActiveTab }) {
    const { profile } = useAuth();
    const [details, setDetails] = useState({ tasks: [], expenseTypes: [], team: [] });
    const [allExpenseTypes, setAllExpenseTypes] = useState([]); // Global list
    const [loading, setLoading] = useState(false);

    // Inputs
    const [newTaskTitle, setNewTaskTitle] = useState('');

    // Allocation Logic
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [driverToAlloc, setDriverToAlloc] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');

    // Quick Add Logic
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickPhone, setQuickPhone] = useState('');
    const [isSavingQuick, setIsSavingQuick] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [service.id]);

    useEffect(() => {
        if (activeTab === 'team') fetchAvailableDrivers();
    }, [activeTab]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // Parallel fetch
            const [tasksReq, typesReq, serviceTypesReq, teamReq] = await Promise.all([
                supabase.from('tasks').select('*').eq('service_id', service.id).order('title'),
                supabase.from('expense_types').select('*').order('name'), // Global types
                supabase.from('service_expense_types').select('expense_type_id').eq('service_id', service.id), // Linked types
                supabase.from('profile_services')
                    .select('status, profile:profiles(*)')
                    .eq('service_id', service.id)
            ]);

            // Flatten team data from relation
            const teamData = (teamReq.data || []).map(item => ({
                ...item.profile,
                invite_status: item.status
            })).filter(Boolean);

            setAllExpenseTypes(typesReq.data || []);

            // Map linked types to IDs for easy lookup
            const linkedTypeIds = (serviceTypesReq.data || []).map(t => t.expense_type_id);

            setDetails({
                tasks: tasksReq.data || [],
                expenseTypes: linkedTypeIds, // Store IDs of enabled types
                team: teamData
            });

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar detalhes");
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableDrivers = async () => {
        // Fetch all drivers 
        const { data } = await supabase.from('profiles').select('*').eq('role', 'driver').order('full_name');
        setAvailableDrivers(data || []);
    };

    // --- Actions ---

    const addTask = async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    service_id: service.id,
                    organization_id: profile.organization_id, // Added required field
                    title: newTaskTitle,
                    status: 'pending'
                })
                .select().single();
            if (error) throw error;
            setDetails(prev => ({ ...prev, tasks: [...prev.tasks, data] }));
            setNewTaskTitle('');
            toast.success("Tarefa adicionada");
        } catch (e) {
            console.error("Task Error:", e);
            toast.error("Erro ao criar tarefa: " + (e.message || e.details || "Verifique os dados"));
        }
    };

    const toggleExpenseType = async (typeId, isEnabled) => {
        try {
            if (isEnabled) {
                // Remove (Unlink)
                const { error } = await supabase
                    .from('service_expense_types')
                    .delete()
                    .eq('service_id', service.id)
                    .eq('expense_type_id', typeId);
                if (error) throw error;
                setDetails(prev => ({ ...prev, expenseTypes: prev.expenseTypes.filter(id => id !== typeId) }));
                toast.success("Tipo removido");
            } else {
                // Add (Link)
                const { error } = await supabase
                    .from('service_expense_types')
                    .insert({ service_id: service.id, expense_type_id: typeId });
                if (error) throw error;
                setDetails(prev => ({ ...prev, expenseTypes: [...prev.expenseTypes, typeId] }));
                toast.success("Tipo adicionado");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao atualizar tipo de despesa");
        }
    };

    const allocateDriver = async (e) => {
        e.preventDefault();
        if (!driverToAlloc) {
            toast.error("Selecione um colaborador.");
            return;
        }
        if (!scheduledAt) {
            toast.error("Informe a data e hora de início.");
            return;
        }

        try {
            // Check if already allocated to avoid duplicates unique constraint error
            const { data: existing } = await supabase
                .from('profile_services')
                .select('id')
                .eq('service_id', service.id)
                .eq('profile_id', driverToAlloc)
                .maybeSingle();

            if (existing) {
                toast.info("Colaborador já está alocado neste serviço.");
                return;
            }

            const { error } = await supabase
                .from('profile_services')
                .insert({
                    service_id: service.id,
                    profile_id: driverToAlloc,
                    scheduled_at: scheduledAt
                });

            if (error) throw error;

            // Trigger Supabase Edge Function (Secure Proxy to N8N)
            try {
                console.log("🚀 Iniciando envio de convite via Edge Function...");

                const { error: fnError } = await supabase.functions.invoke('invite-user', {
                    body: {
                        profile_id: driverToAlloc,
                        service_id: service.id,
                        date_time: new Date(scheduledAt).toISOString()
                    }
                });

                if (fnError) throw fnError;

                toast.success("Convite enviado com sucesso!");
            } catch (webhookErr) {
                console.error("❌ Erro na Edge Function:", webhookErr);
                toast.success("Colaborador alocado, mas erro no envio do convite.");
            }

            fetchDetails(); // Refresh team list
            setDriverToAlloc('');
            setScheduledAt('');
        } catch (e) {
            console.error(e);
            toast.error("Erro ao alocar colaborador");
        }
    };

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        if (!quickName || !quickPhone) return;

        setIsSavingQuick(true);
        try {
            // Basic phone validation/cleanup
            const cleanPhone = quickPhone.replace(/\D/g, '');

            // Create new profile (driver by default)
            const { data, error } = await supabase
                .from('profiles')
                .insert({
                    full_name: quickName,
                    whatsapp_number: cleanPhone,
                    role: 'driver', // Default role for new quick adds
                    organization_id: profile.organization_id
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Colaborador cadastrado!");

            // Refresh drivers list and auto-select
            await fetchAvailableDrivers();
            setDriverToAlloc(data.id);

            // Close modal
            setShowQuickAdd(false);
            setQuickName('');
            setQuickPhone('');

        } catch (err) {
            console.error(err);
            toast.error("Erro ao cadastrar: " + (err.message || "Verifique os dados"));
        } finally {
            setIsSavingQuick(false);
        }
    };

    const deallocateDriver = async (driverId) => {
        if (!confirm("Remover alocação deste colaborador?")) return;
        try {
            const { error } = await supabase
                .from('profile_services')
                .delete()
                .eq('service_id', service.id)
                .eq('profile_id', driverId);

            if (error) throw error;
            toast.success("Desalocado.");
            fetchDetails();
        } catch (e) { toast.error("Erro ao desalocar"); }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-gray-900">{service.name}</h2>
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold border border-green-200 uppercase tracking-wide">
                                {service.is_active ? 'Em Andamento' : 'Concluído'}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-1 font-mono">ID: {service.id}</p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="mt-8 flex gap-6 border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={clsx(
                            "pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'tasks' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Layers size={18} />
                        Tarefas / OS ({details.tasks.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={clsx(
                            "pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'expenses' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <DollarSign size={18} />
                        Tipos de Despesa
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={clsx(
                            "pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'team' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Users size={18} />
                        Equipe Alocada ({details.team.length})
                    </button>
                    {(profile?.role === 'admin' || profile?.role === 'manager') && (
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={clsx(
                                "pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2",
                                activeTab === 'settings' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <Briefcase size={18} />
                            Configurações
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">

                {/* --- TAB: TASKS --- */}
                {activeTab === 'tasks' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Layers size={20} className="text-gray-400" />
                                Lista de Tarefas
                            </h3>

                            <form onSubmit={addTask} className="flex gap-2 mb-6">
                                <input
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Nova Tarefa (ex: Viagem SP-RJ, Manutenção Gerador...)"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    required
                                />
                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium text-sm">Adicionar</button>
                            </form>

                            <ul className="divide-y divide-gray-100">
                                {details.tasks.map(task => (
                                    <li key={task.id} className="py-3 flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                                            <span className="text-gray-700 text-sm">{task.title}</span>
                                        </div>
                                        <span className="text-xs text-gray-400 uppercase">{task.status}</span>
                                    </li>
                                ))}
                                {details.tasks.length === 0 && <p className="text-gray-400 text-sm italic py-2">Nenhuma tarefa cadastrada.</p>}
                            </ul>
                        </div>
                    </div>
                )}

                {/* --- TAB: EXPENSES --- */}
                {activeTab === 'expenses' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign size={20} className="text-gray-400" />
                                Tipos de Despesa Permitidos
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Selecione quais categorias de despesa são aceitas neste serviço/obra.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {allExpenseTypes.map(type => {
                                    const isEnabled = details.expenseTypes.includes(type.id);
                                    return (
                                        <div
                                            key={type.id}
                                            onClick={() => toggleExpenseType(type.id, isEnabled)}
                                            className={clsx(
                                                "p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between group",
                                                isEnabled
                                                    ? "bg-indigo-50 border-indigo-200 shadow-sm"
                                                    : "bg-white border-gray-200 hover:border-indigo-300"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                                    isEnabled ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"
                                                )}>
                                                    <DollarSign size={16} />
                                                </div>
                                                <span className={clsx("font-medium text-sm", isEnabled ? "text-indigo-900" : "text-gray-600")}>
                                                    {type.name}
                                                </span>
                                            </div>
                                            <div className={clsx(
                                                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                isEnabled ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"
                                            )}>
                                                {isEnabled && <CheckCircle size={12} className="text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                                {allExpenseTypes.length === 0 && (
                                    <p className="text-gray-400 col-span-2 text-center text-sm py-4">Nenhum tipo de despesa cadastrado no sistema global.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: TEAM --- */}
                {activeTab === 'team' && (
                    <div className="max-w-4xl space-y-6">
                        {/* Allocation Form */}
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-lg flex items-end gap-4 shadow-sm">
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wide">Alocar Colaborador</label>
                                    <button
                                        onClick={() => setShowQuickAdd(true)}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1"
                                    >
                                        <Plus size={12} /> Novo
                                    </button>
                                </div>
                                <select
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={driverToAlloc}
                                    onChange={e => setDriverToAlloc(e.target.value)}
                                >
                                    <option value="">Selecione um colaborador...</option>
                                    {availableDrivers.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.full_name} {d.phone || d.whatsapp_number ? `(${d.phone || d.whatsapp_number})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-48">
                                <label className="block text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wide">Início Previsto</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={scheduledAt}
                                    onChange={e => setScheduledAt(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={allocateDriver}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-indigo-700 shadow-md transition-all h-[38px] flex items-center gap-2"
                            >
                                <Send size={16} />
                                Convidar Colaborador
                            </button>
                        </div>

                        {/* Quick Add Modal */}
                        {showQuickAdd && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <UserPlus size={20} className="text-indigo-600" />
                                        Novo Colaborador
                                    </h3>
                                    <form onSubmit={handleQuickAdd} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                            <input
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Ex: João da Silva"
                                                value={quickName}
                                                onChange={e => setQuickName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Telefone</label>
                                            <input
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Ex: 11999998888"
                                                value={quickPhone}
                                                onChange={e => setQuickPhone(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickAdd(false)}
                                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                                                disabled={isSavingQuick}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                                disabled={isSavingQuick}
                                            >
                                                {isSavingQuick ? 'Salvando...' : 'Salvar e Selecionar'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Allocated List */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-800">Equipe Ativa neste Serviço</h3>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-500 border-b border-gray-200 bg-white">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Colaborador</th>
                                        <th className="px-6 py-3 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {details.team.map(member => (
                                        <tr key={member.id} className="group hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                                                    {member.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span>{member.full_name}</span>
                                                        <StatusBadge status={member.invite_status} />
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono">{member.whatsapp_number || member.phone}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => deallocateDriver(member.id)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Remover alocação"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {details.team.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="p-8 text-center text-gray-400">
                                                Nenhum colaborador alocado nesta obra/serviço. <br />Use o formulário acima para trazer pessoas para este time.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {/* --- TAB: SETTINGS (Admin/Manager Only) --- */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Briefcase size={20} className="text-gray-400" />
                                Configurações do Serviço
                            </h3>

                            <ServiceSettingsForm service={service} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ServiceSettingsForm({ service }) {
    const { profile } = useAuth();
    const [managers, setManagers] = useState([]);
    const [selectedManager, setSelectedManager] = useState(service.manager_id || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchManagers();
    }, []);

    const fetchManagers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['admin', 'manager'])
            .eq('organization_id', profile.organization_id)
            .order('full_name');
        setManagers(data || []);
    };

    const handleUpdateManager = async () => {
        setLoading(true);
        try {
            const val = selectedManager === '' ? null : selectedManager;
            const { error } = await supabase
                .from('services')
                .update({ manager_id: val })
                .eq('id', service.id);

            if (error) throw error;
            toast.success("Gestor atualizado com sucesso");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao atualizar gestor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gestor Responsável</label>
                <p className="text-xs text-gray-500 mb-2">Este usuário terá acesso privilegiado a este serviço.</p>
                <div className="flex gap-2">
                    <select
                        value={selectedManager}
                        onChange={e => setSelectedManager(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">-- Sem Gestor Definido --</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.full_name} ({m.role === 'admin' ? 'Admin' : 'Gerente'})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleUpdateManager}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
                <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md border border-yellow-100 flex gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <div>
                        <strong>Atenção:</strong> Definir um Gestor limita a visualização deste serviço apenas a ele e aos administradores. Outros gerentes não verão este serviço.
                    </div>
                </div>
            </div>
        </div>
    );
}

// Ensure crypto randomUUID polyfill if needed (usually available in modern browsers)
if (!crypto.randomUUID) {
    crypto.randomUUID = () => {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    };
}
