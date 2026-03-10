# GANOH Café Bistrô - Cardápio Digital

## Problema Original
Criar um cardápio digital estilo iFood para a cafeteria bistrô GANOH. Sem entregas - apenas para clientes presenciais. Tempo estimado de 15 minutos para preparo.

## Escolhas do Usuário
- Identificação do cliente: por nome (sem número de mesa)
- Acompanhamento do pedido: status em tempo real (Recebido → Preparando → Pronto)
- Painel administrativo: sim, para cozinha gerenciar pedidos
- Design visual: tema claro/clean (branco com verde como destaque)
- Tempo estimado: 15 minutos fixo para todos os itens
- Adicionais: aparecem no modal do produto (estilo iFood)
- Pesquisa: barra de busca com lupa

## User Personas
1. **Cliente presencial**: pessoa no café que usa celular para fazer pedido
2. **Equipe da cozinha**: funcionários que gerenciam pedidos pelo painel

## Requisitos Core
- Cardápio por categorias (10 categorias)
- Cards de produtos com imagem, nome, descrição, preço
- Carrinho de compras
- Modal de produto com adicionais opcionais
- Busca de itens
- Checkout com nome do cliente
- Acompanhamento de status em tempo real
- Painel Kanban para cozinha

## O Que Foi Implementado (10/03/2026)

### Backend (FastAPI)
- GET /api/menu - Lista cardápio completo
- GET /api/categories - Lista categorias
- POST /api/orders - Cria pedido
- GET /api/orders - Lista pedidos
- GET /api/orders/{id} - Detalhes do pedido
- PATCH /api/orders/{id}/status - Atualiza status
- GET /api/kitchen/stats - Estatísticas da cozinha

### Frontend (React)
- **MenuPage** - Cardápio com categorias, busca, produtos
- **ProductModal** - Detalhes do produto com adicionais
- **CartDrawer** - Carrinho lateral
- **CheckoutModal** - Finalização com nome
- **OrderTrackingPage** - Acompanhamento do pedido
- **KitchenPage** - Painel Kanban para cozinha

### Categorias do Cardápio
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

### Adicionais Disponíveis
Ovos, Atum, Queijo Branco, Mussarela, Frango, Mel, Granola, Nutella

## Backlog (Próximas Melhorias)
- P1: Notificação sonora para pedidos prontos
- P1: Histórico de pedidos do dia
- P2: Impressão de comanda
- P2: Personalização de tempos por categoria
- P3: Dashboard com relatórios de vendas
- P3: QR Code para mesa acessar cardápio
