import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Briefcase, Plus, Search, Layers, DollarSign, Users,
    ArrowRight, Trash2, CheckCircle, XCircle, AlertCircle, ChevronsRight, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

export default function ServiceManager() {
    const { profile } = useAuth();
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tabs: 'tasks' | 'costs' | 'team'
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

            // Auto-select first if none selected
            if (data?.length > 0 && !selectedService) {
                // Fetch full details for the first one isn't needed yet, just select the object
                // But we will select it in the UI, which triggers data fetching via useEffect below?
                // Better: Just let user select or select first ID
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
        const name = prompt("Nome do novo Serviço / Obra:");
        if (!name) return;

        try {
            const { data, error } = await supabase
                .from('services')
                .insert({ organization_id: profile.organization_id, name, is_active: true })
                .select()
                .single();

            if (error) throw error;
            setServices([...services, data]);
            setSelectedService(data);
            toast.success("Serviço criado com sucesso!");
        } catch (err) {
            toast.error("Erro ao criar serviço");
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
                        <p className="text-sm">Gerencie tarefas, centros de custo e equipe alocada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component for Details to properly handle its own fetching state based on Service ID change
function ServiceDetailView({ service, activeTab, setActiveTab }) {
    const { profile } = useAuth(); // Added missing hook
    const [details, setDetails] = useState({ tasks: [], costCenters: [], team: [] });
    const [loading, setLoading] = useState(false);

    // Inputs
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newCostName, setNewCostName] = useState('');
    const [newCostCode, setNewCostCode] = useState('');

    // Allocation Logic
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [driverToAlloc, setDriverToAlloc] = useState('');
    const [targetCostCenter, setTargetCostCenter] = useState('');

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
            const [tasksReq, costsReq, teamReq] = await Promise.all([
                supabase.from('tasks').select('*').eq('service_id', service.id).order('title'),
                supabase.from('cost_centers').select('*').eq('service_id', service.id).order('code'),
                supabase.from('profiles')
                    .select('*, cost_centers!inner(*)') // Inner join to filter only those linked to THIS service's CostCenters
                    .eq('role', 'driver')
            ]);

            // For Team, we need to filter profiles whose cost_center belongs to this service.
            // But strict filtering in Supabase via foreign table filters can be tricky.
            // Let's do a client side filter to be safe if `!inner` misbehaves or RLS is weird.
            // Wait, the easier way: Get all profiles where current_cost_center_id IN (list of coscenters IDs for this service).

            // Let's refetch Team properly after getting CostCenters
            const costCenterIds = (costsReq.data || []).map(cc => cc.id);
            let teamData = [];

            if (costCenterIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*, cost_centers(name, code)')
                    .in('current_cost_center_id', costCenterIds)
                    .order('full_name');
                teamData = data || [];
            }

            setDetails({
                tasks: tasksReq.data || [],
                costCenters: costsReq.data || [],
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
        // Fetch drivers who are NOT allocated (current_cost_center_id is null)
        // Or maybe we want to allow stealing from other services? usually yes.
        // For now, let's just list ALL drivers for the allocation select.
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

    const addCostCenter = async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('cost_centers')
                .insert({
                    service_id: service.id,
                    organization_id: profile.organization_id, // Added required field
                    name: newCostName,
                    code: newCostCode
                })
                .select().single();
            if (error) throw error;
            setDetails(prev => ({ ...prev, costCenters: [...prev.costCenters, data] }));
            setNewCostName(''); setNewCostCode('');
            toast.success("Centro de Custo adicionado");
        } catch (e) {
            console.error("CC Error:", e);
            toast.error("Erro ao criar CC: " + (e.message || e.details));
        }
    };

    const allocateDriver = async (e) => {
        e.preventDefault();
        if (!driverToAlloc || !targetCostCenter) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ current_cost_center_id: targetCostCenter })
                .eq('id', driverToAlloc);

            if (error) throw error;
            toast.success("Colaborador alocado com sucesso!");
            fetchDetails(); // Refresh team list
            setDriverToAlloc('');
        } catch (e) { toast.error("Erro ao alocar"); }
    };

    const deallocateDriver = async (driverId) => {
        if (!confirm("Remover alocação deste colaborador?")) return;
        try {
            const { error } = await supabase.from('profiles').update({ current_cost_center_id: null }).eq('id', driverId);
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
                        onClick={() => setActiveTab('costs')}
                        className={clsx(
                            "pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'costs' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <DollarSign size={18} />
                        Centros de Custo ({details.costCenters.length})
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

                {/* --- TAB: COSTS --- */}
                {activeTab === 'costs' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign size={20} className="text-gray-400" />
                                Centros de Custo
                            </h3>

                            <form onSubmit={addCostCenter} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded-md border border-gray-100 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome (ex: Combustível)</label>
                                    <input
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none"
                                        placeholder="Nome..."
                                        value={newCostName}
                                        onChange={e => setNewCostName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Código (Opcional)</label>
                                    <input
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none font-mono"
                                        placeholder="COD-01"
                                        value={newCostCode}
                                        onChange={e => setNewCostCode(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 font-medium text-sm">Criar</button>
                            </form>

                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-500 bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Código</th>
                                        <th className="px-4 py-2 font-medium">Nome</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {details.costCenters.map(cc => (
                                        <tr key={cc.id}>
                                            <td className="px-4 py-3 font-mono text-gray-500 text-xs">{cc.code || '-'}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{cc.name}</td>
                                        </tr>
                                    ))}
                                    {details.costCenters.length === 0 && <tr><td colSpan="2" className="text-center py-4 text-gray-400">Nenhum centro de custo.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- TAB: TEAM --- */}
                {activeTab === 'team' && (
                    <div className="max-w-4xl space-y-6">
                        {/* Allocation Form */}
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-lg flex items-end gap-4 shadow-sm">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wide">Alocar Colaborador</label>
                                <select
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={driverToAlloc}
                                    onChange={e => setDriverToAlloc(e.target.value)}
                                >
                                    <option value="">Selecione um motorista...</option>
                                    {availableDrivers.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.full_name} {d.current_cost_center_id ? '(Já alocado no contrato atual)' : '(Livre)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wide">Para Centro de Custo</label>
                                <select
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={targetCostCenter}
                                    onChange={e => setTargetCostCenter(e.target.value)}
                                >
                                    <option value="">Selecione o destino...</option>
                                    {details.costCenters.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={allocateDriver}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-indigo-700 shadow-md transition-all"
                            >
                                Confirmar Alocação
                            </button>
                        </div>

                        {/* Allocated List */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-800">Equipe Ativa neste Serviço</h3>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-500 border-b border-gray-200 bg-white">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Colaborador</th>
                                        <th className="px-6 py-3 font-medium">Centro de Custo (Função Hoje)</th>
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
                                                    <div>{member.full_name}</div>
                                                    <div className="text-xs text-gray-400 font-mono">{member.whatsapp_number}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                    <Truck size={12} />
                                                    {member.cost_centers?.name} ({member.cost_centers?.code})
                                                </span>
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
