import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clsx } from 'clsx';
import { AlertTriangle, Check, X, Building2, Calendar, DollarSign, FileText, ChevronRight, Layers, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { profile } = useAuth(); // Need profile to filter documents by org if needed, though RLS handles it

    const [documents, setDocuments] = useState([]);
    const [services, setServices] = useState([]);
    const [costCenters, setCostCenters] = useState([]); // All cost centers available
    const [selectedDocId, setSelectedDocId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        service_id: '',
        cost_center_id: '',
        total_amount: '',
        issued_at: '',
        emitente_name: '',
        emitente_cnpj: ''
    });

    useEffect(() => {
        if (profile?.organization_id) {
            fetchInitialData();
        }
    }, [profile]);

    // Update form when selected document changes
    useEffect(() => {
        if (selectedDocId) {
            const doc = documents.find(d => d.id === selectedDocId);
            if (doc) {
                setFormData({
                    service_id: doc.service_id || '',
                    cost_center_id: doc.cost_center_id || '',
                    total_amount: doc.extracted_data?.detalhes_fiscais?.valor_total || '',
                    issued_at: doc.extracted_data?.detalhes_fiscais?.data_emissao || '',
                    emitente_name: doc.extracted_data?.emitente?.razao_social || '',
                    emitente_cnpj: doc.extracted_data?.emitente?.cnpj_cpf || ''
                });
            }
        }
    }, [selectedDocId, documents]);

    // Data Fetching
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Parallel Fetch
            const [docsResponse, servicesResponse, ccResponse] = await Promise.all([
                supabase
                    .from('documents')
                    .select('*, services(name), cost_centers(name, code)')
                    .in('status', ['review_needed', 'processing'])
                    .order('created_at', { ascending: false }),

                supabase
                    .from('services')
                    .select('*')
                    .eq('is_active', true)
                    .order('name'),

                supabase
                    .from('cost_centers')
                    .select('*')
                    .order('code')
            ]);

            if (docsResponse.data) {
                setDocuments(docsResponse.data);
                if (docsResponse.data.length > 0) setSelectedDocId(docsResponse.data[0].id);
            }
            if (servicesResponse.data) setServices(servicesResponse.data);
            if (ccResponse.data) setCostCenters(ccResponse.data);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const activeDoc = documents.find(d => d.id === selectedDocId);

    // Cascading Select Logic: Filter Cost Centers based on selected Service
    const availableCostCenters = formData.service_id
        ? costCenters.filter(cc => cc.service_id === formData.service_id)
        : [];

    const handleApprove = async () => {
        if (!activeDoc) return;
        setSaving(true);

        // Merge inputs into current extracted_data object
        const updatedExtractedData = {
            ...(activeDoc.extracted_data || {}),
            emitente: {
                ...(activeDoc.extracted_data?.emitente || {}),
                razao_social: formData.emitente_name,
                cnpj_cpf: formData.emitente_cnpj
            },
            detalhes_fiscais: {
                ...(activeDoc.extracted_data?.detalhes_fiscais || {}),
                valor_total: formData.total_amount ? parseFloat(formData.total_amount) : 0,
                data_emissao: formData.issued_at
            }
        };

        const { error } = await supabase
            .from('documents')
            .update({
                status: 'approved',
                service_id: formData.service_id || null,
                cost_center_id: formData.cost_center_id || null,
                extracted_data: updatedExtractedData,
                updated_at: new Date().toISOString() // Optional explicit timestamp
            })
            .eq('id', selectedDocId);

        if (!error) {
            removeDocFromList(selectedDocId);
        } else {
            alert("Erro ao aprovar: " + error.message);
        }
        setSaving(false);
    };

    const handleReject = async () => {
        if (!activeDoc) return;
        setSaving(true);
        const { error } = await supabase
            .from('documents')
            .update({ status: 'rejected' })
            .eq('id', selectedDocId);

        if (!error) {
            removeDocFromList(selectedDocId);
        } else {
            alert("Erro ao rejeitar: " + error.message);
        }
        setSaving(false);
    };

    const removeDocFromList = (id) => {
        const nextDocs = documents.filter(d => d.id !== id);
        setDocuments(nextDocs);
        if (nextDocs.length > 0) setSelectedDocId(nextDocs[0].id);
        else setSelectedDocId(null);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full text-gray-500 gap-2">
            <Loader2 className="animate-spin h-5 w-5 text-indigo-600" />
            Carregando documentos...
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">

            {/* LEFT COLUMN - LIST */}
            <div className="w-[320px] flex flex-col bg-white border-r border-gray-200 z-10">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Layers size={16} className="text-indigo-500" />
                        Pendentes ({documents.length})
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {documents.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            <div className="mb-2 flex justify-center"><Check className="h-8 w-8 text-gray-200" /></div>
                            Tudo em dia!
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {documents.map(doc => {
                                const isLowConfidence = doc.ai_metadata?.confianca === 'BAIXA';
                                return (
                                    <div
                                        key={doc.id}
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className={clsx(
                                            "p-4 cursor-pointer transition-colors relative group",
                                            selectedDocId === doc.id ? "bg-indigo-50" : "hover:bg-gray-50"
                                        )}
                                    >
                                        {/* Status Indicator Bar */}
                                        {selectedDocId === doc.id && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                                        )}

                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm font-medium text-gray-900 truncate w-32" title={doc.extracted_data?.emitente?.razao_social}>
                                                {doc.extracted_data?.emitente?.razao_social || 'Desconhecido'}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                                R$ {doc.extracted_data?.detalhes_fiscais?.valor_total || '0'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mt-2">
                                            {isLowConfidence && (
                                                <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                    <AlertTriangle size={10} />
                                                    Revisar
                                                </div>
                                            )}
                                            <span className="text-xs text-gray-400 ml-auto">
                                                {new Date(doc.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER & RIGHT CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                {activeDoc ? (
                    <>
                        {/* MIDDLE - IMAGE VIEWER */}
                        <div className="flex-1 bg-[#111] relative flex flex-col justify-center items-center overflow-hidden">
                            <div className="absolute top-4 left-4 z-10 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md font-mono">
                                {activeDoc.file_url.split('/').pop()}
                            </div>

                            {activeDoc.file_url ? (
                                <div className="w-full h-full p-8 flex items-center justify-center">
                                    <img
                                        src={activeDoc.file_url}
                                        alt="Invoice"
                                        className="max-w-full max-h-full object-contain shadow-2xl"
                                    />
                                </div>
                            ) : (
                                <div className="text-gray-500">Imagem não carregada</div>
                            )}
                        </div>

                        {/* RIGHT - FORM */}
                        <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col h-full shadow-xl">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900">Validar Informações</h2>
                                <p className="text-sm text-gray-500">Aprovação com atualização de JSON e Relacionamento.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                {/* CASCADING SELECTS SECTION */}
                                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Classificação</h3>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <Building2 size={16} className="text-indigo-500" />
                                            Obra / Serviço
                                        </label>
                                        <select
                                            value={formData.service_id}
                                            onChange={e => {
                                                setFormData({
                                                    ...formData,
                                                    service_id: e.target.value,
                                                    cost_center_id: '' // RESET CHILD WHEN PARENT CHANGES
                                                });
                                            }}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="">Selecione...</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <ChevronRight size={16} className="text-gray-400" />
                                            Centro de Custo (Vinculado)
                                        </label>
                                        <select
                                            value={formData.cost_center_id}
                                            onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })}
                                            disabled={!formData.service_id} // Disable if no parent selected
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400"
                                        >
                                            <option value="">
                                                {formData.service_id ? 'Selecione o sub-item...' : 'Selecione uma obra primeiro'}
                                            </option>
                                            {availableCostCenters.map(cc => (
                                                <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* FINANCIAL DATA */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Financeiro</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                <DollarSign size={16} className="text-emerald-600" />
                                                Valor
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.total_amount}
                                                onChange={e => setFormData({ ...formData, total_amount: e.target.value })}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                <Calendar size={16} className="text-orange-500" />
                                                Data
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.issued_at}
                                                onChange={e => setFormData({ ...formData, issued_at: e.target.value })}
                                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* EMITENTE */}
                                <div className="space-y-3 pt-2 border-t border-gray-100">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">Emitente (Razão Social)</label>
                                        <input
                                            value={formData.emitente_name}
                                            onChange={e => setFormData({ ...formData, emitente_name: e.target.value })}
                                            className="w-full p-2 border border-gray-200 rounded text-sm focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">CNPJ</label>
                                        <input
                                            value={formData.emitente_cnpj}
                                            onChange={e => setFormData({ ...formData, emitente_cnpj: e.target.value })}
                                            className="w-full p-2 border border-gray-200 rounded text-sm focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* ACTION FOOTER */}
                            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={saving}
                                    className="flex-1 py-2.5 px-4 rounded-md border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                                >
                                    <X size={16} /> Rejeitar
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={saving || !formData.service_id} // Require Service ID
                                    className="flex-[2] py-2.5 px-4 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {saving ? (
                                        <Loader2 className="animate-spin h-4 w-4" />
                                    ) : (
                                        <><Check size={16} /> Aprovar Nota</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 text-gray-400">
                        <FileText size={48} className="text-gray-200 mb-4" />
                        <p>Selecione um documento da lista para iniciar a revisão.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
