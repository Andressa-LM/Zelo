# Zelo

Aplicação React mobile-first para acompanhar medicamentos, estoque, consultas,
perfil e adesão semanal. A autenticação e os dados em nuvem usam Supabase.

## Executar localmente

Requer Node.js compatível com a versão instalada do Vite.

```powershell
cd zelo
npm install
npm run dev
```

Valide as alterações com `npm run lint` e `npm run build`.

## Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No SQL Editor, crie a tabela e as políticas de acesso:

   ```sql
   create table public.user_data (
     user_id uuid primary key references auth.users(id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );

   alter table public.user_data enable row level security;
   grant select, insert, update on public.user_data to authenticated;

   create policy "Cada pessoa acessa somente seus próprios dados"
     on public.user_data
     for all
     to authenticated
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

3. Copie `.env.example` para `.env.local` e preencha:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
   VITE_GOOGLE_AUTH_ENABLED=false
   VITE_APP_URL=
   ```

   O app também aceita `VITE_SUPABASE_ANON_KEY` para compatibilidade. Use apenas
   a chave pública `publishable`/`anon` no frontend; nunca use `service_role`,
   `secret` ou outras credenciais privadas.
4. Em **Authentication → URL Configuration**, configure **Site URL** com o
   endereço publicado do app e adicione em **Redirect URLs** o domínio publicado
   (por exemplo, `https://seu-projeto.vercel.app/**`) e, para desenvolvimento,
   `http://localhost:5173/**`.
5. Para testar confirmação de e-mail num celular, publique primeiro o app e
   cadastre-se pelo endereço HTTPS publicado. `localhost` no link de confirmação
   aponta para o próprio celular, não para o computador que está rodando o Vite.
   Se precisar enviar o retorno para outro endereço, defina `VITE_APP_URL` com a
   URL base do app (sem barra final) antes de cadastrar/solicitar outro e-mail.
   Reinicie o Vite após alterar `.env.local`. Links enviados anteriormente ainda
   podem conter o endereço antigo; peça uma nova confirmação pelo botão
   **Reenviar confirmação de e-mail** na tela de acesso depois de configurar a
   URL correta.

## Publicar na Vercel

1. Importe o repositório no painel da Vercel e configure **Root Directory** como
   `zelo`.
2. Use `npm run build` como comando de build e `dist` como diretório de saída.
3. Configure estas variáveis em **Settings → Environment Variables**:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_GOOGLE_AUTH_ENABLED` e, se desejar fixar o destino dos links,
   `VITE_APP_URL` com a URL HTTPS definitiva.
4. Faça deploy e copie o endereço público. Cadastre-o no **Site URL** e nas
   **Redirect URLs** do Supabase. Faça novo deploy após mudar as variáveis.

## Ativar login com Google

1. No Google Cloud Console, configure a tela de consentimento OAuth e crie um
   cliente OAuth do tipo **Aplicativo da Web**.
2. No Supabase, abra **Authentication → Sign In / Providers → Google**, habilite
   o provedor e cole o **Client ID** e o **Client Secret** do Google.
3. Copie do painel do Supabase a URL de callback exibida para o provedor Google
   (normalmente `https://<project-ref>.supabase.co/auth/v1/callback`) e adicione
   como **Authorized redirect URI** no cliente OAuth do Google.
4. Para o fluxo OAuth de retorno ao app funcionar, confira também se a URL
   publicada consta nas **Redirect URLs** do Supabase.
5. Defina `VITE_GOOGLE_AUTH_ENABLED=true` no `.env.local` para desenvolvimento
   ou na Vercel para produção. Reinicie o Vite ou faça novo deploy. O botão só
   deve ser ativado depois que o provedor Google estiver habilitado no Supabase.

## Foto de perfil

A foto é redimensionada no navegador e salva como imagem compacta junto com os
dados da pessoa na linha de `user_data`, protegida pelas mesmas políticas RLS.
O app aceita JPEG, PNG ou WEBP até 5 MB antes da compressão. Não é necessário
criar um bucket de Storage para esse recurso.

O perfil, os medicamentos, as consultas e os registros são armazenados em uma
linha por usuário na tabela `user_data`, protegida por RLS. Dados locais da
versão anterior só são importados após confirmação explícita. Configure backup
e retenção no Supabase antes de armazenar dados reais de saúde.

## Funcionalidades e limites

- O calendário permite selecionar dias para incluir e editar consultas e
  medicamentos. A previsão de reposição estima o estoque usando horários,
  unidades por tomada e quantidade atual; confirme a previsão antes de comprar.
- O link de WhatsApp é uma mensagem preparada para confirmação manual; o app
  não envia mensagens automaticamente. O calendário não sincroniza com o Google
  Calendar.
- A busca de imagens consulta o Wikimedia Commons e pode retornar imagens que
  não correspondem à embalagem ou concentração. Não use imagens para identificar
  ou confirmar medicamentos.
- O preenchimento básico de receitas é apenas uma sugestão. A leitura opcional
  por Gemini envia o texto ou a imagem ao Google; a chave informada permanece
  somente na memória da sessão. Confira cada dado com a receita original e um
  profissional de saúde.
- O Zelo não fornece aconselhamento médico nem substitui o acompanhamento de
  profissionais de saúde.
