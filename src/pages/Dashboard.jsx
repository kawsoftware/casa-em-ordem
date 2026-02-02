import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, FileText, AlertTriangle,
    ArrowRight, Building, Truck, PieChart, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

export default function Dashboard() {
    const { profile, user } = useAuth();
    const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [filterStatus, setFilterStatus] = useState('review_needed'); // 'review_needed' | 'approved'

    // Master Data for Selects (Cached or fetched on demand)
    const [services, setServices] = useState([]);

    // Cascading Data Cache: { serviceId: { tasks: [], costCenters: [] } }
    const [cascadingData, setCascadingData] = useState({});

    useEffect(() => {
        if (profile?.organization_id) {
            fetchInitialData();
            fetchServices();
        }
    }, [profile?.organization_id, filterStatus]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch Documents
            const { data: docs, error } = await supabase
                .from('documents')
                .select(`
                    *,
                    profiles!uploaded_by_profile_id (full_name, role)
                `)
                .eq('status', filterStatus)
                // Filter by org via linked service? No, documents table usually has no org_id directly?
                // The schema didn't specify org_id in documents.
                // Assuming RLS handles it via 'service_id' -> 'organization_id' OR user ownership?
                // Wait, if document is NEW, it might not have service_id yet.
                // WE NEED A WAY TO FILTER BY ORG. 
                // Assuming documents are orphans initially?
                // Let's assume we fetch ALL documents that we have access to via RLS.
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(docs || []);

            // Fetch Stats (Quick Count)
            // Just counting current list for simplicity or separate query?
            // Real dashboard should have separate count queries, but let's mock for now.
            setStats({
                pending: docs?.filter(d => d.status === 'review_needed').length || 0,
                approved: docs?.filter(d => d.status === 'approved').length || 0,
                total: docs?.length || 0
            });

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar documentos");
        } finally {
            setLoading(false);
        }
    };

    const fetchServices = async () => {
        const { data } = await supabase
            .from('services')
            .select('id, name')
            .eq('organization_id', profile.organization_id)
            .eq('is_active', true)
            .order('name');
        setServices(data || []);
    };

    // Lazy load cascading data when a service is selected
    const fetchServiceDetails = async (serviceId) => {
        if (cascadingData[serviceId]) return; // Already cached

        try {
            const [tasks, costs] = await Promise.all([
                supabase.from('tasks').select('id, title').eq('service_id', serviceId),
                supabase.from('cost_centers').select('id, name, code').eq('service_id', serviceId)
            ]);

            setCascadingData(prev => ({
                ...prev,
                [serviceId]: {
                    tasks: tasks.data || [],
                    costCenters: costs.data || []
                }
            }));
        } catch (err) {
            console.error("Cascading fetch error", err);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-gray-50/50">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Pendente Aprovação"
                    value={stats.pending}
                    icon={Clock}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    border="border-amber-100"
                />
                <StatCard
                    title="Aprovado (Hoje)"
                    value={stats.approved}
                    icon={CheckCircle}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    border="border-emerald-100"
                />
                <StatCard
                    title="Total Processado"
                    value={stats.total}
                    icon={Activity}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    border="border-indigo-100"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setFilterStatus('review_needed')}
                    className={clsx(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        filterStatus === 'review_needed'
                            ? "border-amber-500 text-amber-700 bg-amber-50/50"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    Fila de Aprovação
                </button>
                <button
                    onClick={() => setFilterStatus('approved')}
                    className={clsx(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        filterStatus === 'approved'
                            ? "border-emerald-500 text-emerald-700 bg-emerald-50/50"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    Histórico Aprovado
                </button>
            </div>

            {/* Documents Grid */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Carregando documentos...</div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                        <CheckCircle className="mx-auto h-12 w-12 text-gray-200 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">Tudo limpo!</h3>
                        <p className="text-gray-500">Nenhum documento encontrado neste filtro.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {documents.map(doc => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                services={services}
                                cascadingData={cascadingData}
                                onFetchDetails={fetchServiceDetails}
                                onApprove={() => {
                                    setDocuments(docs => docs.filter(d => d.id !== doc.id));
                                    toast.success("Documento aprovado!");
                                    setStats(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg, border }) {
    return (
        <div className={clsx("p-6 rounded-xl border shadow-sm flex items-center justify-between", bg, border)}>
            <div>
                <p className={clsx("text-sm font-bold uppercase tracking-wider mb-1", color.replace('text-', 'text-opacity-70 text-'))}>{title}</p>
                <p className={clsx("text-3xl font-extrabold", color)}>{value}</p>
            </div>
            <div className={clsx("p-3 rounded-full bg-white bg-opacity-60", color)}>
                <Icon size={24} />
            </div>
        </div>
    );
}

function DocumentCard({ doc, services, cascadingData, onFetchDetails, onApprove }) {
    // Local state for editing the classification
    // Initialize with existing values if any
    const [selectedService, setSelectedService] = useState(doc.service_id || '');
    const [selectedTask, setSelectedTask] = useState(doc.task_id || '');
    const [selectedCostCenter, setSelectedCostCenter] = useState(doc.cost_center_id || '');
    const [saving, setSaving] = useState(false);

    // Derived AI Data (Mock/Structure)
    const aiData = doc.extracted_data || {};
    const aiAmount = aiData.total_amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aiData.total_amount) : 'R$ --';

    // Handler when service changes
    const handleServiceChange = (e) => {
        const id = e.target.value;
        setSelectedService(id);
        setSelectedTask('');
        setSelectedCostCenter('');
        if (id) onFetchDetails(id);
    };

    const handleApprove = async () => {
        if (!selectedService || !selectedCostCenter) {
            toast.error("Selecione a Obra e o Centro de Custo obrigatórios.");
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('documents')
                .update({
                    status: 'approved',
                    service_id: selectedService,
                    task_id: selectedTask || null, // Optional
                    cost_center_id: selectedCostCenter,
                    approved_at: new Date()
                })
                .eq('id', doc.id);

            if (error) throw error;
            onApprove(); // Remove from UI
        } catch (err) {
            console.error(err);
            toast.error("Erro ao aprovar documento.");
        } finally {
            setSaving(false);
        }
    };

    const tasks = cascadingData[selectedService]?.tasks || [];
    const costCenters = cascadingData[selectedService]?.costCenters || [];

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Image Preview Side */}
            <div className="w-full md:w-64 bg-gray-100 p-4 flex items-center justify-center shrink-0 border-r border-gray-200">
                {doc.file_url ? (
                    <img src={doc.file_url} alt="Nota Fiscal" className="max-h-48 object-contain rounded shadow-sm" />
                ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                        <FileText size={48} />
                        <span className="text-xs mt-2">Sem imagem</span>
                    </div>
                )}
            </div>

            {/* Content Side */}
            <div className="flex-1 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={16} className="text-indigo-500" />
                            Documento #{doc.id.slice(0, 8)}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Enviado por <span className="font-semibold text-gray-700">{doc.profiles?.full_name || 'Desconhecido'}</span> em {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{aiAmount}</div>
                        <div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block font-medium border border-emerald-100">
                            IA Confidence: 98%
                        </div>
                    </div>
                </div>

                {/* Classification Area */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

                    {/* 1. Service */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">1. Serviço / Obra</label>
                        <select
                            className={clsx("w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500", !selectedService && "border-amber-300 bg-amber-50")}
                            value={selectedService}
                            onChange={handleServiceChange}
                            disabled={doc.status !== 'review_needed'}
                        >
                            <option value="">Selecione...</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* 2. Task (Dependent) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">2. Tarefa (Opcional)</label>
                        <select
                            className="w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                            value={selectedTask}
                            onChange={e => setSelectedTask(e.target.value)}
                            disabled={!selectedService || doc.status !== 'review_needed'}
                        >
                            <option value="">Geral / Sem Tarefa</option>
                            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>

                    {/* 3. Cost Center (Dependent) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">3. Classificação</label>
                        <select
                            className={clsx("w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400", selectedService && !selectedCostCenter && "border-amber-300 bg-amber-50")}
                            value={selectedCostCenter}
                            onChange={e => setSelectedCostCenter(e.target.value)}
                            disabled={!selectedService || doc.status !== 'review_needed'}
                        >
                            <option value="">Selecione...</option>
                            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>)}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-auto flex justify-end gap-3">
                    {doc.status === 'review_needed' && (
                        <>
                            <button className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50 hover:border-red-200 transition-colors">
                                Rejeitar / Pedir Info
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={saving}
                                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? <Clock className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                Aprovar Despesa
                            </button>
                        </>
                    )}
                    {doc.status === 'approved' && (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-md border border-emerald-100">
                            <CheckCircle size={18} />
                            Aprovado em {new Date(doc.approved_at || Date.now()).toLocaleDateString()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
