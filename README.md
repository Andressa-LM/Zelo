# Zelo 🌿

**Cuidado no seu tempo.**

O Zelo nasceu de um motivo muito especial: ajudar minha mãe a organizar os remédios dela com mais tranquilidade. A partir desse carinho, surgiu a ideia de criar um espaço simples para acompanhar medicamentos, horários, estoque e consultas.

## Acesse

🌼 [**Abrir o Zelo**](https://zelo-azure.vercel.app)

## O que você encontra

- Cadastro de medicamentos, horários e estoque, com registro das tomadas.
- Calendário para consultas e lembretes de reposição.
- Perfil pessoal, acompanhamento semanal e lembretes personalizados.
- Acesso por e-mail e, quando habilitado, por conta Google.

## Tecnologias e serviços

- **Aplicação:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) e [Vite](https://vite.dev/)
- **Login e dados:** [Supabase](https://supabase.com/)
- **Publicação:** [Vercel](https://vercel.com/)
- **Busca de imagens:** [Wikimedia Commons](https://commons.wikimedia.org/)
- **Login Google:** [Google Cloud](https://console.cloud.google.com/)

## Lembretes automáticos pelo WhatsApp

Para habilitar os avisos de reposição, configure na Vercel as variáveis server-side listadas em `.env.example`. `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e `WHATSAPP_ACCESS_TOKEN` são segredos: nunca use o prefixo `VITE_` nem os coloque no código do navegador. O projeto usa uma rotina diária da Vercel para verificar estoques próximos do fim.

Na plataforma Meta, configure a WhatsApp Business Cloud API e crie/aprove um modelo de mensagem de utilidade em português com dois campos no corpo, por exemplo: `Olá, {{1}}! O estoque de {{2}} pode estar acabando. Confira no Zelo para planejar a reposição.` Informe o nome do modelo em `WHATSAPP_TEMPLATE_NAME` e o ID do número remetente em `WHATSAPP_PHONE_NUMBER_ID`. O usuário também precisa informar o próprio número no perfil e autorizar os avisos. A Meta exige opt-in e pode exigir um modelo aprovado para mensagens iniciadas pela empresa.

Os avisos só são avaliados pela rotina agendada após o deploy na Vercel; nenhum envio é feito se o usuário não autorizou ou se o serviço/template não estiver configurado. A pessoa pode desativar a autorização no perfil. O conteúdo inclui o nome do medicamento, portanto pode revelar informação de saúde.

## Imagens de medicamentos

As sugestões de nome usam o catálogo externo [FarmaBook](https://www.farmabook.com.br/) para localizar produtos e apresentações. O nome digitado é enviado ao serviço para realizar a busca. Imagens opcionais são procuradas no [Wikimedia Commons](https://commons.wikimedia.org/) e podem não corresponder ao fabricante, apresentação ou embalagem cadastrada; confira sempre o produto real. Também é possível carregar uma foto do próprio dispositivo. Os dados abertos da Anvisa ajudam na busca de registros, mas não fornecem imagens.

O desenvolvimento contou com o auxílio de ferramentas de inteligência
artificial, junto com decisões, testes e revisão humana.

> O Zelo é um projeto de apoio à organização pessoal. Não substitui a receita,
> o diagnóstico ou a orientação de profissionais de saúde. Confira sempre as
> Sempre busque informações de medicamentos com um profissional especializado.
