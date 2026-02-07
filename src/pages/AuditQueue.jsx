import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Check, X, AlertTriangle, FileText, LayoutTemplate,
    Loader2, Inbox, User, Building, Phone, Calendar, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

export default function AuditQueue() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    // Audit State
    const [profiles, setProfiles] = useState([]); // Cache of profiles

    // Selection State
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [userService, setUserService] = useState(null); // The service linked to the selected user
    const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState('');
    const [expenseOptions, setExpenseOptions] = useState([]);

    const navigate = useNavigate();

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Load Document Queue
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Documents
            const { data: docs, error: docError } = await supabase
                .from('documents')
                .select(`
                    *,
                    profiles:profile_id ( full_name, whatsapp_number ),
                    services:service_id ( name )
                `)
                .eq('status', 'review_needed')
                .order('created_at', { ascending: true })
                .limit(50);

            if (docError) throw docError;
            setDocuments(docs || []);

            // 2. Fetch Profiles AND their linked Services in one go
            // structure: profile -> profile_services -> service(name)
            const { data: profs, error: profError } = await supabase
                .from('profiles')
                .select(`
                    id, full_name, phone, whatsapp_number, cpf,
                    profile_services (
                        service:services ( id, name )
                    )
                `);

            if (!profError) setProfiles(profs || []);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar dados da auditoria");
        } finally {
            setLoading(false);
        }
    };

    const currentDoc = documents[0];

    // Effect: Auto-Match Profile via View
    useEffect(() => {
        if (!currentDoc) return;

        // Reset
        setSelectedProfileId('');
        setUserService(null);

        const identifyProfile = async () => {
            let matchedId = currentDoc.profile_id;

            // If not already linked, check the view
            if (!matchedId) {
                const { data: match } = await supabase
                    .from('view_document_matches')
                    .select('profile_id, full_name')
                    .eq('document_id', currentDoc.id)
                    .maybeSingle();

                if (match) {
                    matchedId = match.profile_id;
                    toast.success(`Perfil identificado: ${match.full_name}`);
                }
            }

            if (matchedId) {
                setSelectedProfileId(matchedId);
                updateServiceFromProfile(matchedId);
            }
        };

        identifyProfile();
    }, [currentDoc?.id, profiles]);

    // Helper to extract service from the cached profile object
    const updateServiceFromProfile = (pid) => {
        const profile = profiles.find(p => p.id === pid);
        if (profile?.profile_services?.length > 0) {
            // Assume 1 service per profile as per new rule
            const s = profile.profile_services[0].service;
            if (s) {
                setUserService(s);
                fetchExpenseOptions(s.id);
            }
        } else {
            setUserService(null);
            setExpenseOptions([]);
        }
    };

    const fetchExpenseOptions = async (serviceId) => {
        const { data } = await supabase
            .from('service_expense_types')
            .select('expense_type:expense_types(id, name)')
            .eq('service_id', serviceId);

        if (data) {
            const types = data.map(item => item.expense_type).filter(Boolean);
            setExpenseOptions(types);
            if (types.length === 1) setSelectedExpenseTypeId(types[0].id); // Auto-select if only one
        }
    };

    const handleProfileChange = (e) => {
        const pid = e.target.value;
        setSelectedProfileId(pid);
        updateServiceFromProfile(pid);
    };

    const handleAction = async (action) => {
        if (action === 'approved') {
            if (!selectedProfileId) {
                toast.error("Identifique o Responsável para continuar.");
                return;
            }
            if (!userService) {
                toast.error("Este colaborador não está alocado em nenhum Serviço/Obra.");
                return;
            }
            if (!selectedExpenseTypeId) {
                toast.error("Selecione o Tipo de Despesa.");
                return;
            }
        }

        setProcessingId(currentDoc.id);
        try {
            const updatePayload = {
                status: action,
                // Only update relationships if approved
                ...(action === 'approved' && {
                    profile_id: selectedProfileId,
                    service_id: userService.id,
                    expense_type_id: selectedExpenseTypeId,
                    approved_at: new Date()
                })
            };

            const { error } = await supabase
                .from('documents')
                .update(updatePayload)
                .eq('id', currentDoc.id);

            if (error) throw error;

            toast.success(action === 'approved' ? "Aprovado!" : "Rejeitado");

            // Next
            setDocuments(prev => prev.filter(d => d.id !== currentDoc.id));

        } catch (err) {
            console.error(err);
            const msg = err.message || "";
            if (msg.includes("rate-limits")) {
                toast.error("Limite IA excedido. Aguarde.");
            } else {
                toast.error("Erro ao salvar: " + msg);
            }
        } finally {
            setProcessingId(null);
        }
    };

    // --- HELPER RENDERS ---

    if (loading) return <LoadingScreen />;
    if (!currentDoc) return <EmptyState onRefresh={fetchInitialData} />;

    return (
        <div className="h-screen bg-gray-100 flex overflow-hidden">
            {/* LEFT: Viewer */}
            <div className="flex-1 bg-gray-900 relative flex flex-col border-r border-gray-800">
                <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 text-gray-400 text-xs justify-between">
                    <span className="truncate max-w-sm font-mono">{currentDoc.file_url?.split('/').pop()}</span>
                    <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">{currentDoc.file_type}</span>
                </div>
                <div className="flex-1 bg-black/50 relative">
                    {currentDoc.file_type?.includes('pdf') ? (
                        <iframe src={currentDoc.file_url} className="w-full h-full border-none" title="PDF" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                            <img src={currentDoc.file_url} className="max-w-full max-h-full object-contain shadow-lg" alt="Doc" />
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Audit Form */}
            <div className="w-[450px] bg-white flex flex-col shadow-2xl z-20 border-l border-gray-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <LayoutTemplate size={20} className="text-indigo-600" />
                        Auditoria
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Valide os dados extraídos pelo OCR</p>

                    {/* Sender Info Badge */}
                    <div className="mt-3 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-xs font-medium border border-indigo-100">
                        <span className="bg-indigo-100 p-1 rounded-full"><Phone size={12} /></span>
                        <span>
                            Enviado por: <strong>{currentDoc.profiles?.full_name || currentDoc.sender_name || 'Desconhecido'}</strong>
                            {(currentDoc.profiles?.whatsapp_number || currentDoc.sender_phone) ? ` (${currentDoc.profiles?.whatsapp_number || currentDoc.sender_phone})` : ''}
                        </span>
                    </div>

                    {/* HIERARCHY INFO */}
                    {currentDoc.services && (
                        <div className="mt-2 flex flex-col gap-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building size={14} className="text-emerald-600" />
                                    <span className="text-xs font-bold text-gray-800">{currentDoc.services.name}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30">

                    {/* SECTION 1: RESPONSIBLE */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <User size={16} className="text-indigo-500" />
                            Responsável & Destino
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Quem gastou?</label>

                                {selectedProfileId ? (
                                    // MATCH FOUND UI
                                    <div className="flex items-center gap-3 p-3 bg-white border border-indigo-200 rounded-lg shadow-sm group">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm uppercase shrink-0">
                                            {profiles.find(p => p.id === selectedProfileId)?.full_name?.slice(0, 2) || <User size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">
                                                {profiles.find(p => p.id === selectedProfileId)?.full_name}
                                            </p>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Phone size={10} className="text-emerald-500" />
                                                <span>{profiles.find(p => p.id === selectedProfileId)?.whatsapp_number || profiles.find(p => p.id === selectedProfileId)?.phone}</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedProfileId('');
                                                setUserService(null);
                                            }}
                                            className="text-xs text-gray-400 hover:text-red-500 underline opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Alterar colaborador"
                                        >
                                            Alterar
                                        </button>
                                    </div>
                                ) : (
                                    // FALLBACK (No Match)
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={14} className="shrink-0" />
                                            <span className="font-bold">{currentDoc.sender_name || 'Nome não informado'}</span>
                                        </div>
                                        {currentDoc.sender_phone && (
                                            <span className="text-xs ml-6 font-mono opacity-80">{currentDoc.sender_phone}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Service Display (Read Only) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Obra / Serviço Atual</label>
                                {userService ? (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 font-bold text-sm">
                                        <Building size={16} />
                                        {userService.name}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 text-sm italic">
                                        {selectedProfileId
                                            ? "Colaborador sem alocação ativa."
                                            : "Selecione um colaborador acima."}
                                    </div>
                                )}
                            </div>

                            {/* Classification: Expense Type */}
                            {userService && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wide">
                                        Classificação da Despesa
                                    </label>
                                    <select
                                        value={selectedExpenseTypeId}
                                        onChange={e => setSelectedExpenseTypeId(e.target.value)}
                                        className={clsx(
                                            "w-full px-3 py-3 border rounded-lg text-sm outline-none focus:ring-2 transition-all font-medium",
                                            !selectedExpenseTypeId ? "border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-500" : "border-gray-300 focus:ring-indigo-500"
                                        )}
                                    >
                                        <option value="">Selecione o Tipo...</option>
                                        {expenseOptions.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    {expenseOptions.length === 0 && (
                                        <p className="text-xs text-red-500 mt-1">
                                            Nenhum tipo de despesa configurado para esta obra.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 2: EXTRACTED DATA */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 px-1">
                            <FileText size={16} className="text-gray-500" />
                            Dados da Nota
                        </h3>

                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            {/* Simplification: Just rendering key fields nicely instead of full JSON tree */}
                            <div className="divide-y divide-gray-100">
                                <FieldRow
                                    icon={DollarSign}
                                    label="Valor Total"
                                    value={RecursiveFinder(currentDoc.extracted_data, ['total', 'amount', 'valor', 'value'])}
                                    isCurrency
                                />
                                <FieldRow
                                    icon={Calendar}
                                    label="Data Emissão"
                                    value={RecursiveFinder(currentDoc.extracted_data, ['date', 'data', 'emissao'])}
                                />
                                <FieldRow
                                    icon={Phone}
                                    label="Telefone Detectado"
                                    value={RecursiveFinder(currentDoc.extracted_data, ['phone', 'tel', 'whatsapp'])}
                                    highlight={!selectedProfileId}
                                />
                                <FieldRow
                                    icon={Building}
                                    label="Fornecedor"
                                    value={RecursiveFinder(currentDoc.extracted_data, ['vendor', 'merchant', 'loja', 'fornecedor', 'nome_fantasia']) || "Não identificado"}
                                />
                            </div>

                            {/* View Full JSON Toggle could be here */}
                            <details className="text-xs p-3 bg-gray-50 border-t border-gray-100">
                                <summary className="cursor-pointer text-gray-400 hover:text-gray-600 font-medium select-none">Ver JSON Completo</summary>
                                <pre className="mt-2 text-[10px] text-gray-500 whitespace-pre-wrap font-mono">
                                    {JSON.stringify(currentDoc.extracted_data, null, 2)}
                                </pre>
                            </details>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3 pb-8">
                    <button
                        onClick={() => handleAction('rejected')}
                        disabled={!!processingId}
                        className="flex-1 py-3 px-4 rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 font-semibold transition-colors disabled:opacity-50"
                    >
                        {processingId ? <Loader2 className="animate-spin mx-auto" /> : "Rejeitar"}
                    </button>
                    <button
                        onClick={() => handleAction('approved')}
                        disabled={!!processingId}
                        className="flex-[2] py-3 px-4 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {processingId ? <Loader2 className="animate-spin mx-auto" /> : "APROVAR & SALVAR"}
                    </button>
                </div>

            </div>
        </div>
    );
}

// --- UTILS & COMPONENTS ---

function RecursiveFinder(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Shallow search
    for (const k of Object.keys(obj)) {
        if (keys.some(candidate => k.toLowerCase().includes(candidate))) {
            const val = obj[k];
            if (typeof val !== 'object') return val;
        }
    }
    // 2. Deep search first level only for performance
    for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'object') {
            for (const subK of Object.keys(obj[k])) {
                if (keys.some(candidate => subK.toLowerCase().includes(candidate))) {
                    const val = obj[k][subK];
                    if (typeof val !== 'object') return val;
                }
            }
        }
    }
    return null;
}

const FieldRow = ({ icon: Icon, label, value, isCurrency, highlight }) => {
    let display = value;
    if (!value) display = <span className="text-gray-300 italic">Vazio</span>;
    else if (isCurrency) {
        // Simple currency parsing visualization
        const num = parseFloat(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!isNaN(num)) display = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        else display = value;
    }

    return (
        <div className={clsx("p-3 flex items-center justify-between group hover:bg-gray-50 transition-colors", highlight && "bg-amber-50")}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <Icon size={14} />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-sm font-medium text-gray-800 text-right max-w-[180px] break-words">
                {display}
            </div>
        </div>
    );
};

const LoadingScreen = () => (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium">Carregando Auditoria...</p>
    </div>
);

const EmptyState = ({ onRefresh }) => (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-md text-center">
            <div className="bg-green-100 p-6 rounded-full mb-6 text-green-600">
                <Inbox size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Fila Zerada!</h2>
            <p className="text-gray-500 mb-8">Todos os documentos foram auditados.</p>
            <button onClick={onRefresh} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                Atualizar
            </button>
        </div>
    </div>
);
