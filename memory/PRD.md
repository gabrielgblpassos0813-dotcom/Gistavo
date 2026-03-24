# GANOH Café Bistrô - Sistema de Menu Digital

## Problema Original
Sistema de menu digital para o café bistrô GANOH com suporte a múltiplas lojas (Runner e GYM Londres), pedidos online, controle de estoque e gestão financeira.

## Lojas
- **Runner**: Loja principal
- **GYM Londres**: Segunda loja

## Sistema Multi-Tenant (NOVO!)
Sistema de múltiplas contas para isolar dados entre usuários.

### Contas Disponíveis
- **Conta 1 (Principal)**: `gestor` / `ganoh2024` - GANOH Café Bistrô
- **Conta 2 (Teste)**: Disponível para criação

### Endpoints de Autenticação
- `POST /api/auth/register` - Criar nova conta (máx. 2)
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/accounts` - Listar contas existentes

---

## Credenciais de Acesso
- **Painel do Gestor**: gestor / ganoh2024
- **Quitar débito Prazo (cozinha)**: 1234
- **Limpar histórico de dados**: 152637
- **Desbloquear Prazo no checkout**: Alternar o botão "Agendar horário" 5 vezes

---

## Funcionalidades Implementadas

### ✅ Sistema de Cardápio Digital
- Menu com categorias: Combos, Café, Salgados, Doces, Bebidas, Zero Açúcar
- Itens com preços, descrição e imagem
- **Cardápio dinâmico**: Itens adicionados pelo gestor aparecem automaticamente para os clientes
- Suporte a adicionais (queijo, bacon, etc.)
- Controle de estoque para bebidas

### ✅ Sistema de Pedidos
- Carrinho de compras
- Formulário de checkout com nome e horário de retirada
- Múltiplas formas de pagamento: PIX, Débito, Crédito, Dinheiro, **Prazo (Fiado)**
- Acompanhamento de pedidos em tempo real
- Notificação sonora para novos pedidos na cozinha

### ✅ Sistema PIX com IA
- CNPJ configurado: 49289019000199
- Upload de comprovante com compressão de imagem
- Aprovação/Rejeição de pagamento pela cozinha
- **Auto-verificação com IA (GPT-4o)**:
  - Extrai nome do pagador do comprovante
  - Extrai valor pago
  - Verifica destino (saudavelmente/GANOH)
  - Auto-aprova se dados estiverem corretos

### ✅ WhatsApp Bot (Green API)
- Integração com Green API para envio de mensagens
- **Grupos separados por loja**:
  - Runner: `5511974449533-1572969909@g.us`
  - GYM Londres: `120363424613813278@g.us`
- Notificações automáticas quando PIX é aprovado
- **Envia foto do comprovante junto com a mensagem** (apenas se aprovado pela IA)
- **Verificação de comprovante antes de enviar** - só notifica se valor e destinatário estiverem corretos

### ✅ Sistema Prazo (Crédito/Fiado) - SEPARADO POR LOJA
- Cadastro de clientes de crédito pelo gestor
- Rastreamento de débitos pendentes **separados por loja** (Runner vs GYM Londres)
- Quitação de débitos na cozinha (senha: 1234)
- **Cobrança via WhatsApp para o número do cliente** (não para grupo)
- Botão "Cobrar Todos" envia mensagens para todos os clientes com débito
- **ESCONDIDO**: Opção Prazo só aparece após alternar o botão de agendamento 5 vezes seguidas

### ✅ Sistema de Gastos com IA (NOVO!)
- Upload de foto de notas fiscais/recibos
- **Chat interativo com IA (GPT-4o)** que:
  - Analisa a foto e extrai valor, descrição e local
  - Pergunta em qual categoria salvar
  - Salva automaticamente quando você responde
- Categorias: contador, fornecedor, mercado, suplementos, VT, Vivo, sistema, salário, outros
- **Botões interativos para filtrar por categoria**
- Gráfico de Receita vs Gastos (verde x vermelho)
- Cálculo de lucro (receita - gastos)

### ✅ Painel do Gestor (GestorPage)
- **6 abas**: Dashboard, Gráfico, Gastos, Prazo, Cardápio, WhatsApp
- Dashboard com métricas do dia e mês (receita em R$)
- **Gráfico com 2 modos**:
  - "Vendas por Mês": vendas diárias
  - "Vendas por Grupo": vendas por categoria de produto
- Gestão de clientes Prazo
- Adição de itens ao cardápio
- **Conexão WhatsApp Bot com QR Code**

### ✅ Painel da Cozinha (KitchenPage)
- **6 abas**: PIX, Pedidos, Vendas, Prazo, Estoque, Histórico
- Kanban de pedidos (Recebidos → Preparando → Prontos)
- Vendas por turno (Manhã/Tarde) e forma de pagamento
- **Estoque editável**: clique no número para editar diretamente
- Histórico de pedidos das últimas 24h com detalhes expandíveis
- Botão de WhatsApp para cobrança de Prazo

### ✅ Sistema de Autenticação Multi-Tenant (NOVO!)
- Página de login/registro separada (/auth)
- Máximo de 2 contas
- Dados isolados por conta
- Conta padrão: gestor/ganoh2024

---

## Arquitetura Técnica

### Backend (FastAPI)
```
/app/backend/
├── server.py        # API principal (~1900 linhas)
├── requirements.txt # Dependências Python
└── .env             # Variáveis de ambiente + EMERGENT_LLM_KEY
```

### Frontend (React)
```
/app/frontend/
├── src/
│   ├── pages/
│   │   ├── AuthPage.js       # Página de login/registro (NOVO!)
│   │   ├── GestorPage.js     # Painel do gestor
│   │   ├── KitchenPage.js    # Painel da cozinha
│   │   ├── MenuPage.js       # Menu do cliente
│   │   └── OrderTrackingPage.js
│   └── components/
│       └── CheckoutModal.js  # Modal de checkout com Prazo escondido
└── .env             # REACT_APP_BACKEND_URL
```

### WhatsApp Bot (Node.js)
```
/app/whatsapp-bot/
├── bot.js           # Bot Baileys com envio de imagem
└── package.json     # Dependências Node.js
```

### Banco de Dados (MongoDB)
- **tenants**: Contas de usuários (NOVO!)
- **orders**: Pedidos
- **menu**: Itens do cardápio adicionados pelo gestor
- **stock**: Controle de estoque
- **prazo_customers**: Clientes de crédito
- **expenses**: Gastos registrados
- **order_history**: Histórico de pedidos entregues

---

## Endpoints Principais

### Autenticação (NOVO!)
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/accounts` - Listar contas

### Menu
- `GET /api/menu/{store}` - Lista cardápio (default + custom)
- `POST /api/gestor/menu` - Adiciona item ao cardápio

### Pedidos
- `POST /api/orders` - Cria pedido
- `GET /api/orders/{store}` - Lista pedidos
- `PATCH /api/orders/{store}/{id}/status` - Atualiza status

### PIX
- `POST /api/orders/{store}/{id}/pix-proof` - Upload comprovante
- `POST /api/orders/{store}/{id}/auto-verify-pix` - Auto-verificação com IA (NOVO!)
- `POST /api/orders/{store}/{id}/approve-payment` - Aprovar/Rejeitar

### WhatsApp
- `GET /api/whatsapp/status` - Status do bot
- `GET /api/whatsapp/qr` - QR Code para conexão

---

## Integrações

### OpenAI GPT-4o (via Emergent LLM Key)
- Análise de imagens de notas fiscais/recibos
- Extração automática de descrição, valor e local
- **Análise de comprovantes PIX para auto-aprovação**

### WhatsApp (Baileys)
- Bot Node.js na porta 8002
- Envio de mensagens com imagem
- Notificações de pagamentos PIX aprovados

---

## Próximas Tarefas (Backlog)

### P1 - Prioridade Alta
- [ ] Implementar categorização automática de novos itens como "Doces" (exceto "água")
- [ ] Verificar QR Code PIX no CheckoutModal (`/app/frontend/public/images/pix-qrcode.png`)
- [ ] Adicionar metas de vendas para o gestor

### P2 - Melhorias
- [ ] Refatorar server.py em routers separados
- [ ] Extrair componentes de GestorPage e KitchenPage
- [ ] Adicionar testes automatizados
- [ ] Implementar isolamento completo de dados por tenant

---

## Changelog

### 23/03/2026 - Sistema de Caixa e Gerenciamento de Prazo
- ✅ **Implementado**: Sistema de caixa (dinheiro em espécie) separado por loja
- ✅ **Implementado**: Retiradas de caixa com categorias VT (Vale Transporte) e Outros
- ✅ **Implementado**: VT registra automaticamente como gasto na aba Gastos
- ✅ **Implementado**: Gerenciamento completo de clientes Prazo na cozinha (cadastrar, deletar, adicionar saldo)
- ✅ **Verificado**: Comprovantes PIX enviados para grupos WhatsApp corretos por loja

### 23/03/2026 - Voucher nas Vendas e Gráficos
- ✅ **Implementado**: Método de pagamento "Voucher" agora aparece nas vendas e gráficos
- ✅ **Backend**: Adicionado "voucher" e "prazo" em todos os endpoints de vendas (`/cash/{store}/today`, `/gestor/dashboard`)
- ✅ **Frontend**: Aba Vendas na Cozinha agora mostra 6 métodos de pagamento (PIX, Débito, Crédito, Dinheiro, Prazo, Voucher)
- ✅ **Frontend**: Modal Exportar IR agora mostra Voucher na receita por forma de pagamento

### 23/03/2026 - Melhorias no Sistema e Campos Fiscais
- ✅ **Corrigido**: Adicionar itens ao cardápio nas duas lojas - Campo `store` estava faltando no modelo MenuItem
- ✅ **Implementado**: UI para campos fiscais (NCM, CSOSN, CFOP, código de barras) no modal de novo item
- ✅ **Implementado**: IA de gastos agora detecta a loja automaticamente baseado na nota fiscal
- ✅ **Implementado**: Envio de relatório do contador por email (requer RESEND_API_KEY)
- ✅ **Corrigido**: Frontend buscando menu de `/menu/{store}` para `/kitchen/menu/{store}`

### 23/03/2026 - Separação de Prazo por Loja e WhatsApp
- ✅ **Implementado**: Separação de dívidas Prazo por loja (Runner vs GYM Londres)
- ✅ **Implementado**: Aba Prazo na cozinha agora mostra apenas débitos da loja atual
- ✅ **Implementado**: Cobrança WhatsApp agora envia para o número do cliente individual (não para grupo)
- ✅ **Configurado**: Grupos WhatsApp separados por loja:
  - Runner: `5511974449533-1572969909@g.us`
  - GYM Londres: `120363424613813278@g.us`
- ✅ **Verificado**: PIX só envia notificação WhatsApp se comprovante for validado pela IA

### 12/03/2026 - Correção de Gráficos e Verificação PIX
- ✅ **Corrigido**: Gráficos de vendas e gastos não renderizavam barras (problema de CSS com `height: %` em flex containers)
- ✅ **Melhorado**: UI de verificação PIX na cozinha agora mostra contador de tempo e timeout para verificação manual
- ✅ **Melhorado**: Exibição do horário da transação PIX extraído pela IA

### 24/03/2026 - Ajustes Contábeis e Sistema Prazo
- ✅ **Implementado**: Prazo NÃO soma mais nas vendas/gráficos (é tratado como sistema separado de crédito/fiado)
- ✅ **Implementado**: Clientes Prazo agora são separados por loja (Runner vs GYM Londres)
- ✅ **Implementado**: Sistema de ajustes manuais de PIX na aba Vendas (para transferências fora de vendas)
- ✅ **Implementado**: Ajustes PIX são somados nos totais de vendas e nos gráficos
- ✅ **Corrigido**: Botão "Adicionar Crédito" para clientes Prazo funcionando com dialog completo
- ✅ **Backend**: Novos endpoints `/api/pix-adjustments/{store}`, `/api/pix-adjustments/add`, `DELETE /api/pix-adjustments/{id}`
- ✅ **Frontend**: Nova seção "Ajustes Manuais PIX" na aba Vendas com botão adicionar e lista de ajustes removíveis

---

## Atualizado em: 24 de Março de 2026
