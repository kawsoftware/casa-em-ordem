import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error("CABEÇALHO_FALTANDO: Authorization header não encontrado.");

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const n8nUrl = Deno.env.get('N8N_INVITE_WEBHOOK') ||
            Deno.env.get('N8N_ALLOCATION_WEBHOOK') ||
            Deno.env.get('N8N_ENVIA_EMAIL_WEBHOOK') ||
            Deno.env.get('N8N-INVITE-WEBHOOK') ||
            Deno.env.get('N8N-ENVIA-EMAIL-WEBHOOK');

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

        // 1. Identificar Usuário (Quem convida)
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error(`AUTH_ERROR: Sessão inválida`);

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name, organization_id')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) throw new Error("PERFIL_DE_ACESSO_NAO_ENCONTRADO");

        // 2. Processar Payload do Front-end
        const body = await req.json().catch(() => ({}));
        const { profile_id, service_id, date_time } = body

        if (!profile_id || !service_id) {
            throw new Error(`PAYLOAD_INVALIDO: 'profile_id' e 'service_id' são obrigatórios.`);
        }

        // 3. Buscar Detalhes do Destino (Colaborador e Serviço)
        const [targetProfileRes, serviceRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('full_name, email, whatsapp_number').eq('id', profile_id).single(),
            supabaseAdmin.from('services').select('name').eq('id', service_id).single()
        ])

        const targetProfile = targetProfileRes.data || {};
        const targetService = serviceRes.data || {};

        // 4. Disparar Webhook com dados FORÇADOS
        if (n8nUrl) {
            console.log(`[Invite User] Enviando convite para ${targetProfile.full_name || 'Colaborador'}`);

            const payload = {
                type: 'allocation_invite',
                profile_id: profile_id,           // ID do Colaborador (Tabela profile_services)
                service_id: service_id,           // ID da Obra/Serviço (Tabela profile_services)
                email: targetProfile.email || "", // Fallback para não ir null
                fullName: targetProfile.full_name || "Colaborador",
                whatsapp: targetProfile.whatsapp_number || "",
                serviceName: targetService.name || "Serviço não identificado",
                dateTime: date_time || new Date().toISOString(),
                organization_id: profile.organization_id,
                invitedBy: user.id,               // ID do Admin/Owner
                invitedByName: profile.full_name || user.email || "Administrador"
            };

            const n8nRes = await fetch(n8nUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!n8nRes.ok) {
                console.error(`[N8N] Falha: ${n8nRes.status}`);
            }
        }

        return new Response(JSON.stringify({ message: 'OK' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error("[CRITICAL]", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
})