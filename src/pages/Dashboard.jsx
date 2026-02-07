import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, FileText, AlertTriangle,
    ArrowRight, Building, Truck, PieChart, Activity,
    ZoomIn, X, AlertCircle, User
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import PdfThumbnail from '../components/ui/PdfThumbnail';

export default function Dashboard() {
    const { profile, user } = useAuth();
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [previewDoc, setPreviewDoc] = useState(null); // Modal state

    // Filter state
    const [filterStatus, setFilterStatus] = useState('review_needed'); // 'review_needed' | 'approved'

    // Master Data
    const [profiles, setProfiles] = useState([]); // Profiles with linked services

    // Cascading Data Cache: { serviceId: { tasks: [], costCenters: [] } }
    // const [cascadingData, setCascadingData] = useState({}); // REMOVED

    useEffect(() => {
        if (profile?.organization_id) {
            fetchInitialData();
            fetchStats();
        }
    }, [profile?.organization_id, filterStatus]);

    const fetchStats = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            let managerServiceIds = null;
            if (profile?.role === 'manager') {
                const { data: myServices } = await supabase.from('services').select('id').eq('manager_id', profile.id);
                managerServiceIds = (myServices || []).map(s => s.id);
                if (managerServiceIds.length === 0) {
                    setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
                    return;
                }
            }

            const applyRbac = (query) => {
                if (managerServiceIds) return query.in('service_id', managerServiceIds);
                return query;
            };

            // 1. Pending
            const { count: pending } = await applyRbac(supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'review_needed'));

            // 2. Approved Today
            const { count: approvedToday } = await applyRbac(supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gte('approved_at', todayISO));

            // 3. Rejected Total
            const { count: rejectedTotal } = await applyRbac(supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'rejected'));

            // 4. Total Processed
            const { count: total } = await applyRbac(supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'review_needed'));

            setStats({
                pending: pending || 0,
                approved: approvedToday || 0,
                rejected: rejectedTotal || 0,
                total: total || 0
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            let managerServiceIds = null;

            // RBAC: If Manager, fetch only allowed Services
            if (profile?.role === 'manager') {
                const { data: myServices } = await supabase
                    .from('services')
                    .select('id')
                    .eq('manager_id', profile.id);

                managerServiceIds = (myServices || []).map(s => s.id);

                // If manager has no services, strict filter to empty list (impossible ID)
                if (managerServiceIds.length === 0) {
                    setDocuments([]);
                    setLoading(false);
                    return;
                }
            }

            // Updated: Query 'documents' directly with relations to ensure fresh data
            let query = supabase
                .from('documents')
                .select(`
                    id,
                    created_at,
                    status,
                    file_url,
                    file_type,
                    extracted_data,
                    sender_name,
                    sender_phone,
                    profile_id,
                    service_id,
                    approved_at,
                    rejection_reason,
                    profiles:profile_id ( full_name, whatsapp_number ),
                    services:service_id ( name )
                `)
                .eq('status', filterStatus);

            // Apply RBAC Filter
            if (managerServiceIds !== null) {
                query = query.in('service_id', managerServiceIds);
            }

            const { data: docs, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            // Normalize data to match expected structure or keep as is and update card
            const normalizedDocs = (docs || []).map(d => ({
                ...d,
                document_id: d.id, // Compatibility
                service_name: d.services?.name, // Flatten for easier access
                responsible_name: d.profiles?.full_name, // Flatten for easier access
                responsible_phone: d.profiles?.whatsapp_number // Flatten for easier access
            }));

            setDocuments(normalizedDocs);

            // Stats Logic...
            // Stats are now fetched independently in fetchStats()

        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
            toast.error("Erro dashboard: " + (err.message || err.details || "Verifique o console"));
        } finally {
            setLoading(false);
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
                    Fila de Aprovação ({stats.pending})
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
                <button
                    onClick={() => setFilterStatus('rejected')}
                    className={clsx(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        filterStatus === 'rejected'
                            ? "border-red-500 text-red-700 bg-red-50/50"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    Rejeitados ({stats.rejected})
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
                                key={doc.document_id}
                                doc={doc}
                                onApprove={() => {
                                    setDocuments(docs => docs.filter(d => d.document_id !== doc.document_id));
                                    toast.success("Documento aprovado!");
                                    // Optimistic update for immediate feedback, then fetch real
                                    setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), approved: prev.approved + 1 }));
                                    fetchStats();
                                }}
                                onPreview={setPreviewDoc}
                                onReject={() => {
                                    setDocuments(docs => docs.filter(d => d.document_id !== doc.document_id));
                                    toast.success("Documento rejeitado!");
                                    setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
                                    fetchStats();
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Layer */}
            {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
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

function DocumentCard({ doc, onApprove, onPreview, onReject }) {
    const [saving, setSaving] = useState(false);
    const aiData = doc.extracted_data || {};

    const findTotalValue = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const candidates = ['total_amount', 'total', 'valor_total', 'amount', 'valor', 'value', 'grand_total'];
        for (const key of Object.keys(obj)) {
            if (candidates.includes(key.toLowerCase())) {
                const val = obj[key];
                if (isValidNumber(val)) return val;
            }
        }
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
                const found = findTotalValue(obj[key]);
                if (found !== null) return found;
            }
        }
        return null;
    };

    const isValidNumber = (val) => {
        if (typeof val === 'number') return true;
        if (typeof val === 'string') return /\d/.test(val);
        return false;
    };

    const parseCurrency = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/[^0-9.,-]/g, '');
        if (str.indexOf(',') > str.lastIndexOf('.')) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
        return parseFloat(str);
    };

    const rawValue = findTotalValue(aiData);
    const numValue = parseCurrency(rawValue);
    // Helper to deeply search for string keys
    const findStringValue = (obj, candidates) => {
        if (!obj || typeof obj !== 'object') return null;
        for (const key of Object.keys(obj)) {
            if (candidates.some(c => key.toLowerCase().includes(c))) {
                const val = obj[key];
                // If it's a string and looks like a name (not a number/date), return it
                if (typeof val === 'string' && val.length > 2 && !val.includes('T') && isNaN(val)) return val;
                // If it's an object, maybe it has 'name' or 'value'
                if (typeof val === 'object' && val?.name) return val.name;
                if (typeof val === 'object' && val?.value) return val.value;
            }
        }
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
                const found = findStringValue(obj[key], candidates);
                if (found) return found;
            }
        }
        return null;
    };

    const aiAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue || 0);

    // Dynamic Data Binding (Recursive Search)
    const merchantCandidates = ['instituicao_financeira', 'instituicao', 'loja', 'estabelecimento', 'fornecedor', 'vendor', 'empresa', 'merchant'];
    const merchantName = findStringValue(aiData, merchantCandidates);

    // Specific fields from the observed JSON structure
    const pagadorNome = aiData.conteudo?.pagador?.nome;
    const tipoDocumento = aiData.tipo_documento;
    const idTransacao = aiData.conteudo?.detalhes_transacao?.id_transacao;
    const horaTransacao = aiData.conteudo?.detalhes_transacao?.hora;

    // Simple date finder (looking for basic keys)
    const dateCandidates = ['date', 'data', 'emissao', 'issue'];
    const findDateValue = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        for (const key of Object.keys(obj)) {
            if (dateCandidates.some(c => key.toLowerCase().includes(c))) {
                const val = obj[key];
                // Simple check for date-like string (YYYY-MM-DD or DD/MM/YYYY)
                if (typeof val === 'string' && (val.includes('-') || val.includes('/')) && val.length >= 8) return val;
            }
        }
        return null;
    };
    // Ensure we check nested 'conteudo.detalhes_transacao.data' specifically
    const rawDate = aiData.conteudo?.detalhes_transacao?.data || findDateValue(aiData);
    const displayDate = rawDate || new Date(doc.created_at).toLocaleDateString('pt-BR');

    // Confidence Logic
    const confidenceScore = aiData.confidence || aiData.score || aiData.confidence_score || aiData.overall_confidence || aiData.confiabilidade;
    // Handle "Alta" string or number
    let confidenceVal = null;
    if (typeof confidenceScore === 'number') {
        confidenceVal = confidenceScore <= 1 ? confidenceScore * 100 : confidenceScore;
    } else if (typeof confidenceScore === 'string') {
        if (confidenceScore.toLowerCase() === 'alta') confidenceVal = 95;
        if (confidenceScore.toLowerCase() === 'media') confidenceVal = 70;
        if (confidenceScore.toLowerCase() === 'baixa') confidenceVal = 40;
    }

    const handleApprove = async () => {
        // With the view, we assume data is correct or use available IDs
        // Note: If profile_id is missing in view logic, we might need a different aproach or the view provides 'responsible_id'
        // For now, assuming the view is for display/review and approve updates status

        setSaving(true);
        try {
            const { error } = await supabase
                .from('documents')
                .update({
                    status: 'approved',
                    approved_at: new Date()
                })
                .eq('id', doc.document_id);

            if (error) throw error;
            onApprove();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao aprovar documento.");
        } finally {
            setSaving(false);
        }
    };

    const isRejected = doc.status === 'rejected';

    return (
        <div className={clsx(
            "bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-300",
            isRejected ? "border-red-200 bg-red-50/10" : "border-gray-200"
        )}>
            {/* Image Preview Side */}
            <div
                className="w-full md:w-64 bg-gray-100 p-4 flex items-center justify-center shrink-0 border-r border-gray-200 cursor-zoom-in group relative"
                onClick={() => onPreview && onPreview(doc)}
            >
                {doc.file_url ? (
                    (doc.file_type === 'application/pdf' || doc.file_url?.toLowerCase().includes('.pdf')) ? (
                        <div className="w-full h-[200px] relative">
                            <PdfThumbnail url={doc.file_url} />
                            {/* Overlay to ensure clickability for zoom modal */}
                            <div className="absolute inset-0 z-30 bg-transparent cursor-zoom-in"></div>
                        </div>
                    ) : (
                        <img src={doc.file_url} alt="Nota Fiscal" className="max-h-48 object-contain rounded shadow-sm group-hover:scale-105 transition-transform duration-300" />
                    )
                ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                        <AlertCircle size={48} />
                        <span className="text-xs mt-2">Sem arquivo</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="text-white drop-shadow-md" size={32} />
                </div>
            </div>

            {/* Content Side */}
            <div className="flex-1 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={16} className="text-indigo-500" />
                            Documento #{doc.document_id?.slice(0, 8)}
                        </h4>

                        {/* NEW HEADER: Service & Responsible */}
                        <div className="mt-3 space-y-2">
                            {/* Service Badge */}
                            {doc.service_name ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                    <Building size={12} />
                                    {doc.service_name}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                    Serviço não vinculado
                                </span>
                            )}

                            {/* Responsible */}
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <User size={14} className="text-gray-400" />
                                {doc.responsible_name ? (
                                    <span className="font-semibold">{doc.responsible_name}</span>
                                ) : (
                                    <span className="text-gray-400 italic">Sem responsável</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{aiAmount}</div>
                        {confidenceVal !== null ? (
                            <div className={`text-xs px-2 py-0.5 rounded-full inline-block font-medium border ${confidenceVal > 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                                IA Confiança: {Math.round(confidenceVal)}%
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full inline-block font-medium border border-gray-100">
                                Processando IA
                            </div>
                        )}
                    </div>
                </div>

                {/* Details / Sender Info (Kept as secondary context) */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4 text-sm text-gray-700 space-y-2">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
                        <span className="font-bold text-gray-600 uppercase tracking-widest text-[10px]">Dados da Extração</span>
                        {tipoDocumento && <span className="text-[10px] bg-gray-200 px-1.5 rounded text-gray-600">{tipoDocumento}</span>}
                    </div>

                    {merchantName && (
                        <div className="flex gap-2">
                            <span className="font-medium text-gray-500 min-w-[70px]">Local:</span>
                            <span className="font-bold">{merchantName}</span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <span className="font-medium text-gray-500 min-w-[70px]">Data:</span>
                        <span>{displayDate} {horaTransacao && <span className="text-gray-400 text-xs">às {horaTransacao}</span>}</span>
                    </div>

                    {idTransacao && (
                        <div className="flex gap-2">
                            <span className="font-medium text-gray-500 min-w-[70px]">ID:</span>
                            <span className="font-mono text-xs">{idTransacao}</span>
                        </div>
                    )}

                    <div className="flex gap-2 border-t border-gray-200 pt-2 mt-2">
                        <span className="font-medium text-gray-500 min-w-[70px]">Enviado:</span>
                        <span className="text-xs text-gray-500">
                            {doc.responsible_name || doc.sender_name || 'Desconhecido'}
                            {' '}
                            {(doc.responsible_phone || doc.sender_phone) && `(${doc.responsible_phone || doc.sender_phone})`}
                        </span>
                    </div>
                </div>

                {/* Rejection Reason (If Rejected) */}
                {doc.status === 'rejected' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-md flex gap-3 text-red-800">
                        <AlertCircle className="shrink-0" size={18} />
                        <div className="text-sm">
                            <span className="font-bold block mb-0.5">Motivo da Recusa:</span>
                            <span>{doc.rejection_reason || "Motivo não informado."}</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex justify-end gap-3">
                    {doc.status === 'review_needed' && (
                        <>
                            <button
                                onClick={async () => {
                                    // 1. Capture Rejection Reason
                                    const reason = window.prompt("Por favor, informe o motivo da rejeição:");
                                    if (reason === null) return; // User cancelled
                                    if (!reason.trim()) {
                                        toast.error("O motivo da rejeição é obrigatório.");
                                        return;
                                    }

                                    setSaving(true);
                                    try {
                                        // 2. Direct DB Update (Async Trigger Pattern)
                                        const { error } = await supabase
                                            .from('documents')
                                            .update({
                                                status: 'rejected',
                                                rejection_reason: reason
                                            })
                                            .eq('id', doc.document_id);

                                        if (error) throw error;
                                        onReject && onReject();
                                    } catch (err) {
                                        console.error(err);
                                        toast.error("Erro ao rejeitar documento.");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-md hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
                            >
                                {saving ? "..." : "Rejeitar"}
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
                            Aprovado
                        </div>
                    )}
                    {doc.status === 'rejected' && (
                        <div className="flex items-center gap-2 text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-md border border-red-100">
                            <XCircle size={18} />
                            Rejeitado
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Minimal Modal Component for Preview
function PreviewModal({ doc, onClose }) {
    if (!doc) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={onClose}>
                <X size={32} />
            </button>
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2 text-gray-700">
                        <FileText size={20} />
                        <span className="font-bold">Visualizar Documento</span>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                        Abrir Original ↗
                    </a>
                </div>
                <div className="flex-1 bg-gray-200 overflow-hidden relative">
                    {doc.file_type?.includes('pdf') ? (
                        <iframe src={doc.file_url} className="w-full h-full border-none" title="PDF Preview" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center overflow-auto">
                            <img src={doc.file_url} className="max-w-full max-h-full object-contain" alt="Preview" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
