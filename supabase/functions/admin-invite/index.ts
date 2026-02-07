import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("[Admin Invite] Início da execução...");

        // 2. Verify Caller Authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error("CABEÇALHO_FALTANDO: Authorization header não encontrado.")

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

        const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !caller) throw new Error("Sessão inválida ou expirada")

        // --- VALIDAÇÃO DE ROLE ---
        const { data: profileCaller, error: profileErrorCaller } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name')
            .eq('id', caller.id)
            .single()

        if (profileErrorCaller || !profileCaller) {
            console.error("[Admin Invite] Erro ao buscar perfil do chamador:", profileErrorCaller)
            throw new Error("Não foi possível validar seu perfil de acesso.")
        }

        console.log(`[Admin Invite] Chamada por: ${caller.email} | Role: ${profileCaller.role}`);

        const allowedRoles = ['admin', 'owner'];
        if (!allowedRoles.includes(profileCaller.role)) {
            return new Response(
                JSON.stringify({
                    error: 'ACESSO_NEGADO',
                    details: `Seu cargo é '${profileCaller.role}'. Apenas Administradores ou Donos podem convidar usuários.`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
        }

        const payload = await req.json()
        const { email, fullName, role, organization_id } = payload

        if (!email) throw new Error("Email é obrigatório")

        // 3. Determine Redirect Path via Environment Variable
        const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:3000';
        const redirectTo = `${frontendUrl.replace(/\/$/, '')}/definir-senha`;

        // 4. Gerar o link de convite
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: { redirectTo }
        })

        if (linkError) {
            console.error("[Admin Invite] Erro ao gerar link:", linkError)
            return new Response(JSON.stringify({
                error: "ERRO_GERACAO_LINK",
                details: linkError.message
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }

        const inviteLink = linkData.properties.action_link
        const invitedUser = linkData.user

        // 5. Registrar na fila
        const { error: queueError } = await supabaseAdmin
            .from('invite_queue')
            .insert({
                email,
                full_name: fullName,
                role: role,
                organization_id: organization_id,
                invite_link: inviteLink,
                status: 'pending'
            })

        if (queueError) {
            console.warn("[Admin Invite] Falha ao registrar na fila, mas continuando...", queueError)
        }

        // 6. Criar/Atualizar Perfil do Convidado
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: invitedUser.id,
                full_name: fullName,
                role: role,
                organization_id: organization_id,
                email: email
            })

        if (profileError) {
            console.error("[Admin Invite] Erro ao criar perfil do convidado:", profileError)
        }

        // 7. Disparar Webhook do N8N
        const n8nWebhookUrl = Deno.env.get('N8N_INVITE_WEBHOOK') ||
            Deno.env.get('N8N-INVITE-WEBHOOK') ||
            Deno.env.get('N8N_ENVIA_EMAIL_WEBHOOK') ||
            Deno.env.get('N8N-ENVIA-EMAIL-WEBHOOK');

        let n8nStatus = 'not_attempted';
        let n8nDetails = '';

        if (n8nWebhookUrl) {
            console.log(`[Admin Invite] Disparando N8N para ${email} através de ${n8nWebhookUrl}`);
            try {
                const n8nRes = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'system_invite',
                        email,
                        fullName,
                        role,
                        inviteLink,
                        organization_id,
                        invitedBy: caller.id,
                        invitedByName: profileCaller.full_name
                    })
                });

                n8nStatus = n8nRes.ok ? 'success' : `failed_${n8nRes.status}`;
                if (n8nRes.ok) {
                    await supabaseAdmin
                        .from('invite_queue')
                        .update({ status: 'sent' })
                        .eq('email', email)
                        .eq('status', 'pending');
                    console.log(`[Admin Invite] N8N executado com sucesso.`);
                } else {
                    n8nDetails = await n8nRes.text().catch(() => 'Erro no corpo da resposta N8N');
                    console.error(`[Admin Invite] N8N retornou erro: ${n8nDetails}`);
                }
            } catch (n8nErr) {
                console.error("[Admin Invite] Falha de rede no Webhook N8N:", n8nErr);
                n8nStatus = 'network_error';
                n8nDetails = n8nErr.message;
            }
        } else {
            console.warn("[Admin Invite] Nenhum Webhook N8N configurado.");
            n8nStatus = 'not_configured';
        }

        return new Response(
            JSON.stringify({
                message: "Convite processado com sucesso.",
                id: invitedUser.id,
                n8nStatus,
                n8nDetails: n8nDetails.slice(0, 100)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error("[Admin Invite] Erro Global:", error.message)
        return new Response(
            JSON.stringify({
                error: "ERRO_NA_FUNCAO",
                message: error.message,
                details: error.details || String(error)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
