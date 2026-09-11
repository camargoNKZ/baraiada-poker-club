# Baraiada Poker Club

Aplicativo de gestão completa para torneios de poker — feito para tirar o "financeiro no papel" e o "blind no grito" da mesa e colocar tudo num painel só, em tempo real.

## Por que existe

O **Baraiada Poker Club** nasceu para resolver um problema bem prático: organizar um torneio de poker privado entre amigos exige controlar, ao mesmo tempo, o jogo (blinds, tempo de nível, eliminações) e o dinheiro (entradas, reentradas, addons, premiação) — e fazer isso na mão, com planilha e caderno, é receita certa pra bagunça e discussão na hora de fechar a conta.

O projeto foi criado sob medida para um torneio privado entre amigos, com o objetivo de facilitar todos os âmbitos possíveis da organização de um Main Event caseiro: desde o cronômetro de blind até a divisão final da premiação.

## O que a aplicação faz

- **Controle de blinds e nível**: cronômetro de torneio com blind/ante configuráveis e avanço automático de nível, com aviso sonoro (`app/api/audio`) para ninguém perder a hora da subida de blind.
- **Gestão de jogadores**: cadastro com nome, apelido, telefone, e-mail, documento e observações, além do controle de status (ativo/eliminado), mesa e stack de fichas.
- **Entradas, reentradas e addons**: registro de cada compra/recompra com valores próprios para entry, reentry e addon, refletindo automaticamente no prize pool.
- **Financeiro do torneio**: cada movimentação vira uma transação (entrada, reentrada, addon, pagamento, estorno), com saldo por jogador (cobrado x pago) — o famoso "quem deve o quê" resolvido sozinho.
- **Premiação automática**: cálculo da divisão de prêmios entre os classificados a partir do prize pool acumulado e do número de posições pagas.
- **Painel público e painel de controle**: uma tela (`/painel`) pensada para ficar exibida na sala pros jogadores acompanharem blind, tempo e ranking, e outra (`/controle`) para o organizador operar tudo — administrar jogadores, lançar transações, pausar/retomar o relógio.
- **Login administrativo**: acesso restrito para quem organiza o evento mexer nos dados do torneio (`/login`, `app/api/auth`).

## Stack técnica

- **Next.js 15 (App Router)** + **React 19**
- **Supabase** como backend/banco de dados (com **Drizzle ORM** para schema e migrations)
- **Tailwind CSS** + componentes baseados em **shadcn/ui**
- Deploy contínuo na **Vercel**

## Contexto

Ferramenta de uso interno, pensada para o torneio privado "Baraiada" entre amigos — não é um produto comercial, e sim uma solução sob medida para não deixar a organização do evento na mão da planilha e do WhatsApp.
