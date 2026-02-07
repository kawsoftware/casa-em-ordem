-- Criar a tabela de fila de convites
CREATE TABLE IF NOT EXISTS public.invite_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT,
    organization_id UUID,
    invite_link TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.invite_queue ENABLE ROW LEVEL SECURITY;

-- Política: Apenas o serviço role (Edge Functions/N8N) e Admins podem ver a fila
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invite_queue' AND policyname = 'Admins and Service Role can access queue'
    ) THEN
        CREATE POLICY "Admins and Service Role can access queue" ON public.invite_queue
            FOR ALL USING (
                auth.jwt() ->> 'role' = 'admin' 
                OR (auth.jwt() ->> 'role' IS NULL) -- Allow service_role
            );
    END IF;
END
$$;

-- Habilitar Realtime para o N8N (opcional, mas recomendado)
ALTER PUBLICATION supabase_realtime ADD TABLE public.invite_queue;
