# GANOH Café Bistrô - Sistema de Cardápio Digital

## Problema Original
Cardápio digital estilo iFood para 2 lojas GANOH Café Bistrô (Runner e GYM Londres). Sem entregas, apenas clientes presenciais.

## Requisitos Implementados

### Multi-Loja
- **Runner**: Cardápio e painel admin próprios
- **GYM Londres**: Cardápio e painel admin próprios
- Mesmo cardápio para ambas, estoque separado

### Formas de Pagamento
- PIX, Cartão de Débito, Cartão de Crédito, Dinheiro
- Salvo por pedido para fechamento de caixa
- Relatório separado por forma de pagamento

### Painel do Gestor (com login)
- **Credenciais**: gestor / ganoh2024
- Visão das duas lojas em abas
- Vendas do dia e mês (total e por loja)
- Vendas por forma de pagamento
- **Produtos mais vendidos / menos vendidos com modal de detalhes** ✅
- Alertas de estoque baixo

### Painel da Cozinha
- Kanban de pedidos (Aguardando, Preparando, Prontos)
- **Vendas separadas por turno (Manhã 06:00-14:00 e Tarde/Noite 14:00-22:00)** ✅
- **Layout mobile-friendly responsivo** ✅
- Gestão de estoque integrada

### Estoque Automático
- Por unidade
- Quando estoque = 0, produto fica indisponível
- Alertas de estoque baixo (≤ 5 unidades)
- Gerenciamento por loja

### Horário de Retirada
- Só mostra horários futuros (a partir do momento atual + 15 min)
- Intervalos de 15 minutos

### Modo Offline ✅ (NOVO)
- Service Worker para cache de assets e cardápio
- Pedidos salvos localmente quando offline
- Sincronização automática quando conexão retorna
- Banner indicando status offline
- Botão de sincronização manual

## URLs do Sistema
- `/` - Seleção de loja
- `/runner` - Cardápio Runner
- `/gym-londres` - Cardápio GYM Londres
- `/runner/cozinha` - Painel da cozinha Runner
- `/gym-londres/cozinha` - Painel da cozinha GYM Londres
- `/gestor` - Painel do gestor (protegido)
- `/{store}/pedido/{id}` - Acompanhamento de pedido
- `/{store}/pedido/offline` - Página para pedido offline

## Categorias do Cardápio
1. Omeletes, Tapiocas e Crepiocas
2. Brunchs
3. Toasts
4. Shakes Proteicos
5. Açaí
6. Sucos e Vitaminas
7. Saladas
8. Bebidas Quentes
9. Bebidas Geladas
10. Suplementos

## Adicionais (não aparecem em bebidas)
Ovos, Atum, Queijo Branco, Mussarela, Frango, Mel, Granola, Nutella

## Arquitetura
```
/app/
├── backend/
│   ├── server.py        # FastAPI com todas as rotas
│   ├── tests/           # Testes pytest
│   └── .env
├── frontend/
│   ├── public/
│   │   ├── service-worker.js  # PWA offline
│   │   └── manifest.json
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MenuPage.js      # Cardápio com offline
│   │   │   ├── KitchenPage.js   # Cozinha com shifts
│   │   │   ├── GestorPage.js    # Gestor com modal
│   │   │   └── OrderTrackingPage.js
│   │   ├── components/
│   │   └── utils/
│   │       └── offline.js       # Utilitários offline
│   └── .env
└── memory/
    └── PRD.md
```

## Backlog

### P1 - Alta Prioridade
- [ ] Notificação sonora para pedidos prontos
- [ ] Impressão de comanda

### P2 - Média Prioridade
- [ ] Histórico de pedidos do dia para impressão
- [ ] Metas de vendas configuráveis
- [ ] Relatórios exportáveis (PDF/Excel)

### P3 - Baixa Prioridade
- [ ] QR Code por mesa
- [ ] Dashboard de analytics avançado

## Changelog

### 2025-03-11
- ✅ Implementado vendas por turno na aba Caixa da cozinha
- ✅ Melhorado layout mobile da página da cozinha
- ✅ Adicionado modal de detalhes para produtos no painel do gestor
- ✅ Implementado modo offline completo com Service Worker
- ✅ Testes automatizados: 100% de cobertura (19 testes backend passando)
