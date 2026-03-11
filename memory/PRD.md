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
- Produtos mais vendidos / menos vendidos
- Alertas de estoque baixo

### Estoque Automático
- Por unidade
- Quando estoque = 0, produto fica indisponível
- Alertas de estoque baixo (≤ 5 unidades)
- Gerenciamento por loja

### Horário de Retirada
- Só mostra horários futuros (a partir do momento atual + 15 min)
- Intervalos de 15 minutos

### Modo Offline (Básico)
- Utilitário para salvar pedidos localmente quando offline
- Sincronização quando conexão retornar

## URLs do Sistema
- `/` - Seleção de loja
- `/runner` - Cardápio Runner
- `/gym-londres` - Cardápio GYM Londres
- `/runner/cozinha` - Painel da cozinha Runner
- `/gym-londres/cozinha` - Painel da cozinha GYM Londres
- `/runner/estoque` - Gestão de estoque Runner
- `/gym-londres/estoque` - Gestão de estoque GYM Londres
- `/gestor/dashboard` - Painel do gestor (protegido)

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

## Backlog
- P1: Notificação sonora para pedidos prontos
- P1: Service Worker completo para modo offline robusto
- P2: Histórico de pedidos do dia para impressão
- P2: Metas de vendas configuráveis
- P3: Relatórios exportáveis (PDF/Excel)
- P3: QR Code por mesa
