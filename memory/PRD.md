# GANOH Café Bistrô - Sistema de Menu Digital

## Problema Original
Sistema de menu digital para o café bistrô GANOH com suporte a múltiplas lojas (Runner e GYM Londres), pedidos online, controle de estoque e gestão financeira.

## Lojas
- **Runner**: Loja principal
- **GYM Londres**: Segunda loja

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

### ✅ Sistema PIX
- CNPJ configurado: 49289019000199
- Upload de comprovante com compressão de imagem
- Aprovação/Rejeição de pagamento pela cozinha

### ✅ Sistema Prazo (Crédito/Fiado) - AMBAS AS LOJAS
- Cadastro de clientes de crédito pelo gestor
- Rastreamento de débitos pendentes
- Quitação de débitos na cozinha (senha: 1234)
- **Botão de WhatsApp para cobrança** (link direto wa.me)
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
- **5 abas**: Dashboard, Gráfico, Gastos, Prazo, Cardápio
- Dashboard com métricas do dia e mês (receita em R$)
- **Gráfico com 2 modos**:
  - "Vendas por Mês": vendas diárias
  - "Vendas por Grupo": vendas por categoria de produto (ex: 300 vendas de Bebidas Quentes)
- Gestão de clientes Prazo
- Adição de itens ao cardápio

### ✅ Painel da Cozinha (KitchenPage)
- **6 abas**: PIX, Pedidos, Vendas, Prazo, Estoque, Histórico
- Kanban de pedidos (Recebidos → Preparando → Prontos)
- Vendas por turno (Manhã/Tarde) e forma de pagamento
- **Estoque editável**: clique no número para editar diretamente
- Histórico de pedidos das últimas 24h com detalhes expandíveis
- Botão de WhatsApp para cobrança de Prazo

### ✅ Funcionalidades Extras
- Modo offline com sincronização
- Limpar dados de teste (senha: 152637)
- Reset automático de vendas à meia-noite

---

## Arquitetura Técnica

### Backend (FastAPI)
```
/app/backend/
├── server.py        # API principal (~1600 linhas)
├── requirements.txt # Dependências Python
└── .env             # Variáveis de ambiente + EMERGENT_LLM_KEY
```

### Frontend (React)
```
/app/frontend/
├── src/
│   ├── pages/
│   │   ├── GestorPage.js    # Painel do gestor (~1800 linhas)
│   │   ├── KitchenPage.js   # Painel da cozinha (~1080 linhas)
│   │   ├── MenuPage.js      # Menu do cliente
│   │   └── OrderTrackingPage.js
│   └── components/
│       └── CheckoutModal.js  # Modal de checkout com Prazo escondido
└── .env             # REACT_APP_BACKEND_URL
```

### Banco de Dados (MongoDB)
- **orders**: Pedidos
- **menu**: Itens do cardápio adicionados pelo gestor
- **stock**: Controle de estoque
- **prazo_customers**: Clientes de crédito
- **expenses**: Gastos registrados
- **order_history**: Histórico de pedidos entregues

---

## Endpoints Principais

### Menu
- `GET /api/menu/{store}` - Lista cardápio (default + custom)
- `POST /api/gestor/menu` - Adiciona item ao cardápio

### Pedidos
- `POST /api/orders` - Cria pedido
- `GET /api/orders/{store}` - Lista pedidos
- `PATCH /api/orders/{store}/{id}/status` - Atualiza status

### Prazo
- `GET /api/prazo/customers` - Lista clientes
- `POST /api/prazo/customers` - Cadastra cliente
- `GET /api/prazo/debts` - Lista débitos
- `GET /api/prazo/whatsapp-link/{name}` - Link WhatsApp para cobrança

### Gastos
- `GET /api/expenses` - Lista gastos
- `POST /api/expenses` - Cria gasto
- `POST /api/expenses/analyze-image` - Análise IA de foto (GPT-4o)
- `GET /api/gestor/chart/monthly-with-expenses` - Gráfico receita vs gastos

### Vendas por Categoria
- `GET /api/gestor/sales-by-category` - Vendas agrupadas por categoria de produto

### Estoque
- `GET /api/stock/{store}` - Lista estoque
- `PUT /api/stock/{store}/{id}` - Atualiza quantidade

---

## Integrações

### OpenAI GPT-4o (via Emergent LLM Key)
- Análise de imagens de notas fiscais/recibos
- Extração automática de descrição, valor e local
- Chat interativo para confirmar categoria

### WhatsApp (Link Direto)
- Geração de links wa.me com mensagem pré-formatada
- Usado para cobrança de clientes Prazo

---

## Próximas Tarefas (Backlog)

### P1 - Prioridade Alta
- [ ] Implementar metas de vendas para o gestor
- [ ] Notificações de resumo diário (WhatsApp/Email)

### P2 - Melhorias
- [ ] Refatorar server.py em routers separados
- [ ] Extrair componentes de GestorPage e KitchenPage
- [ ] Adicionar testes automatizados

---

## Atualizado em: Dezembro 2025
