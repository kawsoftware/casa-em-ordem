import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('checking'); // checking, ready, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const isFirstRun = useRef(true);
    const navigate = useNavigate();

    useEffect(() => {
        // --- PREVENÇÃO CRÍTICA CONTRA TOKEN QUEIMADO ---
        if (!isFirstRun.current) return;
        isFirstRun.current = false;

        const handleAuth = async () => {
            // 1. Verificar se estamos no fluxo PKCE (tem um 'code' na URL)
            const queryParams = new URLSearchParams(window.location.search);
            const code = queryParams.get('code');

            if (code) {
                console.log("Detectado fluxo PKCE, trocando código por sessão...");
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("Erro na troca do código:", error);
                    setStatus('error');
                    setErrorMsg("Não foi possível validar seu código de acesso. O link pode ter expirado ou já foi usado.");
                    return;
                }
                // Limpa a URL do código para estética e segurança
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            // 2. Verificar Sessão (Implicit ou já trocada via PKCE)
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                // Se não houver sessão, checar se o Supabase injetou erro na hash
                const hash = window.location.hash;
                if (hash.includes('error_code=otp_expired') || hash.includes('access_denied')) {
                    setStatus('error');
                    setErrorMsg("O link de convite expirou ou o acesso foi negado. Por favor, solicite um novo convite ao administrador.");
                } else {
                    setStatus('error');
                    setErrorMsg("Sessão não encontrada. Certifique-se de usar o link original enviado por e-mail.");
                }
            } else {
                // Link válido, usuário autenticado
                setStatus('ready');
            }
        };

        handleAuth();
    }, []);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();

        if (password.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            setStatus('success');
            toast.success("Senha definida com sucesso!");

            // Redireciona após 3 segundos
            setTimeout(() => {
                navigate('/dashboard');
            }, 3000);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao atualizar senha: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'checking') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-gray-600 font-medium">Validando seu acesso...</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle className="text-red-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Ops! Algo deu errado</h2>
                    <p className="text-gray-600 mb-8">{errorMsg}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors"
                    >
                        Voltar para o Login
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-green-100">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce">
                        <CheckCircle2 className="text-green-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Tudo pronto!</h2>
                    <p className="text-gray-600 mb-8">Sua senha foi definida. Você será redirecionado para o painel em instantes.</p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-3000 w-full ease-linear" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/50 relative">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-gray-100 rotate-3 animate-in fade-in zoom-in duration-500">
                    <Lock className="text-indigo-600" size={40} />
                </div>

                <div className="mt-8 text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Definir Senha</h2>
                    <p className="text-gray-500 mt-2">Escolha uma senha forte para seu primeiro acesso.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Nova Senha</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 hover:bg-white"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Confirmar Senha</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 hover:bg-white"
                            placeholder="Repita sua senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2 group disabled:opacity-70 mt-4"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Ativar minha conta
                                <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-gray-400">
                    Casa em Ordem &copy; 2024 - Sistema de Gestão de Obras
                </p>
            </div>
        </div>
    );
}
