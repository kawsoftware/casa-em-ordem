import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, MapPin, UserPlus, Users, Briefcase, Loader2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

export default function ServiceManager() {
    const { profile } = useAuth();
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState(null);

    // Right Panel Data
    const [costCenters, setCostCenters] = useState([]);
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [allocatedDrivers, setAllocatedDrivers] = useState([]);

    // Forms
    const [newServiceName, setNewServiceName] = useState('');
    const [newCCName, setNewCCName] = useState('');
    const [newCCCode, setNewCCCode] = useState('');
    const [allocationForm, setAllocationForm] = useState({ driverId: '', costCenterId: '' });

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (profile?.organization_id) {
            fetchServices();
            fetchDrivers(); // Pre-fetch drivers list once
        }
    }, [profile]);

    useEffect(() => {
        if (selectedServiceId) {
            fetchServiceDetails(selectedServiceId);
        }
    }, [selectedServiceId]);

    const fetchServices = async () => {
        const { data } = await supabase
            .from('services')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('name');

        if (data) {
            setServices(data);
            if (data.length > 0 && !selectedServiceId) setSelectedServiceId(data[0].id);
        }
        setLoading(false);
    };

    const fetchDrivers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'driver')
            .eq('organization_id', profile.organization_id)
            .order('full_name');
        setAvailableDrivers(data || []);
    };

    const fetchServiceDetails = async (serviceId) => {
        // 1. Fetch Cost Centers
        const { data: ccs } = await supabase
            .from('cost_centers')
            .select('*')
            .eq('service_id', serviceId)
            .order('code');
        setCostCenters(ccs || []);

        // 2. Fetch Currently Allocated Drivers
        if (ccs && ccs.length > 0) {
            const ccIds = ccs.map(c => c.id);
            const { data: allocated } = await supabase
                .from('profiles')
                .select('*, cost_centers(name, code)')
                .in('current_cost_center_id', ccIds)
                .order('full_name');
            setAllocatedDrivers(allocated || []);
        } else {
            setAllocatedDrivers([]);
        }
    };

    const handleCreateService = async (e) => {
        e.preventDefault();
        if (!newServiceName || !profile?.organization_id) return;

        setActionLoading(true);
        const { error } = await supabase.from('services').insert({
            organization_id: profile.organization_id,
            name: newServiceName,
            is_active: true
        });

        if (!error) {
            setNewServiceName('');
            fetchServices();
        } else {
            alert('Erro ao criar serviço: ' + error.message);
        }
        setActionLoading(false);
    }

    const handleCreateCostCenter = async (e) => {
        e.preventDefault();
        if (!newCCName || !newCCCode || !selectedServiceId) return;

        setActionLoading(true);
        const { error } = await supabase.from('cost_centers').insert({
            service_id: selectedServiceId, // Link to Parent Service
            name: newCCName,
            code: newCCCode
        });

        if (!error) {
            setNewCCName('');
            setNewCCCode('');
            fetchServiceDetails(selectedServiceId);
        } else {
            alert('Erro ao criar centro de custo: ' + error.message);
        }
        setActionLoading(false);
    };

    const handleAllocateDriver = async (e) => {
        e.preventDefault();
        if (!allocationForm.driverId || !allocationForm.costCenterId) return;

        setActionLoading(true);
        const { error } = await supabase
            .from('profiles')
            .update({ current_cost_center_id: allocationForm.costCenterId })
            .eq('id', allocationForm.driverId);

        if (!error) {
            setAllocationForm({ driverId: '', costCenterId: '' });
            fetchServiceDetails(selectedServiceId); // Refresh list
        } else {
            alert('Erro na alocação: ' + error.message);
        }
        setActionLoading(false);
    };

    // Helper to remove allocation (set current_cc to null)
    const handleDeallocate = async (driverId) => {
        if (!confirm("Remover colaborador desta obra?")) return;
        const { error } = await supabase
            .from('profiles')
            .update({ current_cost_center_id: null })
            .eq('id', driverId);

        if (!error) {
            fetchServiceDetails(selectedServiceId);
        }
    };

    if (loading) return <div className="p-8 text-gray-500 flex items-center"><Loader2 className="animate-spin mr-2" /> Carregando...</div>;

    return (
        <div className="flex h-full bg-gray-50">
            {/* Left: Services List */}
            <div className="w-[300px] border-r border-gray-200 bg-white flex flex-col h-full z-10 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <Briefcase size={18} className="text-indigo-600" />
                        Gestão de Obras
                    </h2>
                    <form onSubmit={handleCreateService} className="flex gap-2">
                        <input
                            className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500 transition-all"
                            placeholder="Nova Obra..."
                            value={newServiceName}
                            onChange={e => setNewServiceName(e.target.value)}
                        />
                        <button disabled={actionLoading} type="submit" className="bg-indigo-600 text-white rounded px-2 hover:bg-indigo-700 disabled:opacity-50">
                            <Plus size={16} />
                        </button>
                    </form>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {services.map(s => (
                        <div
                            key={s.id}
                            onClick={() => setSelectedServiceId(s.id)}
                            className={clsx(
                                "p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors",
                                selectedServiceId === s.id ? "bg-indigo-50 border-r-2 border-r-indigo-500" : "bg-white"
                            )}
                        >
                            <div className="font-medium text-gray-900">{s.name}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                {s.is_active ? 'Ativa' : 'Inativa'}
                            </div>
                        </div>
                    ))}
                    {services.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">Nenhuma obra cadastrada.</div>}
                </div>
            </div>

            {/* Right: Details */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
                {selectedServiceId ? (
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">

                        {/* Section A: Cost Centers */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <MapPin size={20} className="text-gray-400" />
                                    Centros de Custo
                                </h3>
                                <p className="text-sm text-gray-500 pl-7">Subdivisões da obra para apropriação de custos.</p>
                            </div>

                            {/* Add CC Form */}
                            <form onSubmit={handleCreateCostCenter} className="flex gap-3 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 items-end">
                                <div className="flex-1 max-w-[150px]">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Código</label>
                                    <input
                                        placeholder="Ex: BLOCO-A"
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newCCCode}
                                        onChange={e => setNewCCCode(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome da Frente/Setor</label>
                                    <input
                                        placeholder="Descrição..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newCCName}
                                        onChange={e => setNewCCName(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-black disabled:opacity-50 h-[38px]"
                                >
                                    Criar Frente
                                </button>
                            </form>

                            {/* CC List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {costCenters.map(cc => (
                                    <div key={cc.id} className="p-3 border border-gray-200 rounded-lg flex flex-col hover:shadow-sm bg-white">
                                        <span className="text-xs font-bold text-indigo-600 block mb-1">{cc.code}</span>
                                        <span className="text-sm font-medium text-gray-800 truncate" title={cc.name}>{cc.name}</span>
                                    </div>
                                ))}
                                {costCenters.length === 0 && <span className="text-gray-400 text-sm italic py-2">Nenhum centro de custo nesta obra.</span>}
                            </div>
                        </div>

                        {/* Section B: Allocation */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Users size={20} className="text-gray-400" />
                                    Alocação de Equipe
                                </h3>
                                <p className="text-sm text-gray-500 pl-7">Defina onde cada motorista está trabalhando atualmente.</p>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6">
                                <form onSubmit={handleAllocateDriver} className="flex gap-4 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-indigo-800">Colaborador Disponível</label>
                                        <select
                                            className="w-full p-2 border border-indigo-200 rounded text-sm outline-none bg-white"
                                            value={allocationForm.driverId}
                                            onChange={e => setAllocationForm({ ...allocationForm, driverId: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            {availableDrivers.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.full_name} {d.current_cost_center_id ? '(Já alocado - Mover)' : '(Livre)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-indigo-800">Alocar em (Frente de Trabalho)</label>
                                        <select
                                            className="w-full p-2 border border-indigo-200 rounded text-sm outline-none bg-white"
                                            value={allocationForm.costCenterId}
                                            onChange={e => setAllocationForm({ ...allocationForm, costCenterId: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            {costCenters.map(cc => (
                                                <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="bg-indigo-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-indigo-700 h-[38px] flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-indigo-200"
                                    >
                                        <UserPlus size={16} /> Alocar
                                    </button>
                                </form>
                            </div>

                            {/* Allocated List */}
                            <div className="rounded-lg border border-gray-100 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-gray-500">Colaborador</th>
                                            <th className="px-4 py-2 font-medium text-gray-500">Frente de Trabalho Atual</th>
                                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {allocatedDrivers.map(ad => (
                                            <tr key={ad.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">{ad.full_name.charAt(0)}</div>
                                                    {ad.full_name}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        <MapPin size={10} />
                                                        {ad.cost_centers?.code} / {ad.cost_centers?.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleDeallocate(ad.id)} className="text-gray-400 hover:text-red-500 p-1">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {allocatedDrivers.length === 0 && (
                                            <tr><td colSpan="3" className="p-8 text-center text-gray-400 text-sm">Nenhum colaborador alocado nesta obra ainda.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Briefcase size={48} className="text-gray-200 mb-4" />
                        <p>Selecione ou crie uma Obra para gerenciar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
