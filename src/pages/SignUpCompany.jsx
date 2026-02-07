import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
    Building2,
    User,
    Mail,
    Lock,
    FileText,
    ArrowRight,
    Loader2,
    CheckCircle2,
    Users,
    Search
} from 'lucide-react';

export default function SignUpCompany() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingCNPJ, setLoadingCNPJ] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        cnpj: '',
        employeeCount: '',
        fullName: '',
        email: '',
        password: ''
    });

    const maskCNPJ = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    const handleBlurCNPJ = async () => {
        const cleanCNPJ = formData.cnpj.replace(/\D/g, '');

        // Validação básica de tamanho
        if (cleanCNPJ.length !== 14) {
            if (cleanCNPJ.length > 0) {
                toast.error("CNPJ deve ter 14 dígitos.");
            }
            return;
        }

        setLoadingCNPJ(true);
        try {
            // Tenta BrasilAPI
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);

            if (response.status === 404) {
                throw new Error("CNPJ não encontrado na base de dados.");
            }
            if (!response.ok) {
                throw new Error("Erro ao consultar serviço de CNPJ.");
            }

            const data = await response.json();

            const name = data.nome_fantasia || data.razao_social;

            if (name) {
                setFormData(prev => ({ ...prev, companyName: name }));
                toast.success('Dados da empresa carregados!');
            } else {
                toast.warning('Empresa encontrada, mas sem nome disponível.');
            }

        } catch (error) {
            console.error("Erro CNPJ:", error);
            toast.error(error.message || "Erro ao buscar CNPJ.");
        } finally {
            setLoadingCNPJ(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const generateSlug = (name) => {
        const cleanName = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z0-9]/g, '-'); // Replace special chars with hyphens
        const randomString = Math.random().toString(36).substring(2, 6);
        return `${cleanName}-${randomString}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { companyName, cnpj, employeeCount, fullName, email, password } = formData;

        if (!companyName || !cnpj || !employeeCount || !fullName || !email || !password) {
            toast.error("Por favor, preencha todos os campos.");
            setLoading(false);
            return;
        }

        try {
            // 1. Criar Usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Erro ao criar usuário.");

            const userId = authData.user.id;
            console.log(`[SignUp] Usuário criado: ${userId}`);

            // 2. Criar Organização
            const orgSlug = generateSlug(companyName);
            const orgPayload = {
                name: companyName,
                cnpj: cnpj, // Alterado de 'document' para 'cnpj' baseando-se no erro de schema
                size_range: employeeCount,
                slug: orgSlug,
                owner_id: userId
            };

            console.log("Tentando criar organização com payload:", orgPayload);

            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert(orgPayload)
                .select()
                .single();

            if (orgError) {
                console.error("Erro detalhado do Supabase:", JSON.stringify(orgError, null, 2));
                // Show more details in the UI for the user to see
                const detailMsg = orgError.details || orgError.message || "Erro desconhecido";
                const hintMsg = orgError.hint ? ` (${orgError.hint})` : "";

                throw new Error(`Erro ao criar organização: ${detailMsg}${hintMsg}`);
            }

            const orgId = orgData.id;
            console.log(`[SignUp] Organização criada: ${orgId}`);

            // 3. Criar Perfil vinculado (Owner)
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    organization_id: orgId,
                    full_name: fullName,
                    email: email,
                    role: 'owner',
                    is_active: true
                });

            if (profileError) {
                console.error("Erro ao criar perfil:", profileError);
                throw new Error("Erro ao configurar perfil de administrador.");
            }

            toast.success("Cadastro realizado com sucesso!");

            // Pequeno delay para feedback visual antes de redirecionar
            setTimeout(() => {
                navigate('/login');
            }, 1000);

        } catch (err) {
            console.error(err);
            let msg = err.message;
            if (msg.includes("rate limit")) {
                msg = "Muitas tentativas recentes. Aguarde alguns minutos ou use outro email.";
            } else if (msg.includes("already registered")) {
                msg = "Este email já está cadastrado.";
            }
            toast.error(msg || "Ocorreu um erro durante o cadastro.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                    <Building2 className="text-white h-7 w-7" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                    Cadastro Corporativo
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Comece a gerenciar sua operação hoje mesmo.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-gray-100 sm:rounded-xl sm:px-10 border border-gray-100">
                    <form className="space-y-5" onSubmit={handleSubmit}>

                        {/* Seção Empresa */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                Dados da Empresa
                            </label>
                            <div className="space-y-3">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FileText className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        name="cnpj"
                                        type="text"
                                        required
                                        disabled={loadingCNPJ}
                                        autoComplete="off"
                                        className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="CNPJ (apenas números)"
                                        value={formData.cnpj}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cnpj: maskCNPJ(e.target.value) }))}
                                        onBlur={handleBlurCNPJ}
                                        maxLength={18}
                                    />
                                    {/* Botão de Busca Explícita */}
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer" onClick={handleBlurCNPJ}>
                                        {loadingCNPJ ? (
                                            <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                                        ) : (
                                            <Search className="h-5 w-5 text-indigo-500 hover:text-indigo-700 transition-colors" title="Buscar CNPJ" />
                                        )}
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building2 className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        name="companyName"
                                        type="text"
                                        required
                                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                        placeholder="Nome da Empresa (Preenchimento Automático)"
                                        value={formData.companyName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Users className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <select
                                        name="employeeCount"
                                        required
                                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors text-gray-600 bg-white"
                                        value={formData.employeeCount}
                                        onChange={handleChange}
                                    >
                                        <option value="" disabled>Quantidade de Funcionários</option>
                                        <option value="0-20">0-20</option>
                                        <option value="20-50">20-50</option>
                                        <option value="Mais de 50">Mais de 50</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 my-2"></div>

                        {/* Seção Admin */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                Administrador da Conta
                            </label>
                            <div className="space-y-3">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        name="fullName"
                                        type="text"
                                        required
                                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                        placeholder="Nome Completo"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                        placeholder="E-mail Corporativo"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                        placeholder="Senha de Acesso"
                                        minLength={6}
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin h-5 w-5 text-indigo-100" />
                                ) : (
                                    <>
                                        Criar Conta Corporativa
                                        <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">
                                    Já tem uma conta?
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                                Entrar no sistema
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

