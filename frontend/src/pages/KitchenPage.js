import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Clock, 
  ChefHat, 
  CheckCircle2, 
  RefreshCw, 
  Trash2,
  Users,
  Timer,
  Package
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STATUS_CONFIG = {
  received: {
    label: 'Recebido',
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    bgLight: 'bg-gray-50',
    borderColor: 'border-l-gray-500'
  },
  preparing: {
    label: 'Preparando',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgLight: 'bg-amber-50',
    borderColor: 'border-l-amber-500'
  },
  ready: {
    label: 'Pronto',
    color: 'bg-brand-500',
    textColor: 'text-brand-700',
    bgLight: 'bg-brand-50',
    borderColor: 'border-l-brand-500'
  }
};

const OrderCard = ({ order, onStatusChange, onDelete }) => {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const createdAt = new Date(order.created_at);
  const now = new Date();
  const minutesAgo = Math.floor((now - createdAt) / 60000);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getNextStatus = () => {
    if (order.status === 'received') return 'preparing';
    if (order.status === 'preparing') return 'ready';
    return null;
  };

  const getActionButton = () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return null;

    if (nextStatus === 'preparing') {
      return (
        <Button
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => onStatusChange(order.id, nextStatus)}
          data-testid={`start-preparing-${order.id}`}
        >
          <ChefHat className="h-4 w-4 mr-2" />
          Iniciar Preparo
        </Button>
      );
    }

    return (
      <Button
        className="w-full bg-brand-600 hover:bg-brand-700 text-white"
        onClick={() => onStatusChange(order.id, nextStatus)}
        data-testid={`mark-ready-${order.id}`}
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Marcar como Pronto
      </Button>
    );
  };

  return (
    <div 
      className={`bg-white rounded-xl border-l-4 ${config.borderColor} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}
      data-testid={`order-card-${order.id}`}
    >
      <div className={`px-4 py-3 ${config.bgLight} border-b border-border/50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-lg" data-testid={`order-name-${order.id}`}>
              {order.customer_name}
            </span>
            <Badge className={`${config.color} text-white`}>
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>{minutesAgo} min</span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-2 mb-4">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-foreground">
                <span className="font-medium">{item.quantity}x</span> {item.name}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-brand-600 text-lg">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {getActionButton()}
          {order.status === 'ready' && (
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:bg-destructive hover:text-white"
              onClick={() => onDelete(order.id)}
              data-testid={`delete-order-${order.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const KitchenPage = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        axios.get(`${API}/orders`),
        axios.get(`${API}/kitchen/stats`)
      ]);
      
      setOrders(ordersRes.data.orders.filter(o => o.status !== 'delivered'));
      setStats(statsRes.data);
      
      if (showToast) {
        toast.success('Dados atualizados');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API}/orders/${orderId}/status`, { status: newStatus });
      fetchData();
      toast.success(`Status atualizado para: ${STATUS_CONFIG[newStatus].label}`);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await axios.patch(`${API}/orders/${orderId}/status`, { status: 'delivered' });
      fetchData();
      toast.success('Pedido finalizado');
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      toast.error('Erro ao finalizar pedido');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };

  const receivedOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="kitchen-page">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white border-b border-border/50 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img 
                src={LOGO_URL} 
                alt="GANOH Café Bistrô" 
                className="h-10 w-auto"
              />
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground">Cozinha</h1>
                <p className="text-sm text-muted-foreground">Painel de Pedidos</p>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-full"
              data-testid="kitchen-refresh-button"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Aguardando</span>
              </div>
              <span className="text-2xl font-bold text-gray-700" data-testid="stats-pending">{stats.pending}</span>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
                <ChefHat className="h-4 w-4" />
                <span className="text-sm font-medium">Preparando</span>
              </div>
              <span className="text-2xl font-bold text-amber-700" data-testid="stats-preparing">{stats.preparing}</span>
            </div>
            <div className="bg-brand-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-brand-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Prontos</span>
              </div>
              <span className="text-2xl font-bold text-brand-700" data-testid="stats-ready">{stats.ready}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[calc(100vh-220px)]">
          {/* Received Column */}
          <div className="bg-white/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-foreground">Aguardando</h2>
              <Badge variant="secondary">{receivedOrders.length}</Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-3 pr-2">
                {receivedOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {receivedOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhum pedido aguardando</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preparing Column */}
          <div className="bg-amber-50/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <ChefHat className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-foreground">Preparando</h2>
              <Badge className="bg-amber-500">{preparingOrders.length}</Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-3 pr-2">
                {preparingOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {preparingOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhum pedido em preparo</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Ready Column */}
          <div className="bg-brand-50/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-brand-500" />
              <h2 className="font-semibold text-foreground">Prontos</h2>
              <Badge className="bg-brand-500">{readyOrders.length}</Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-3 pr-2">
                {readyOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {readyOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhum pedido pronto</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
