import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Clock, ChefHat, CheckCircle2, RefreshCw, Trash2, Timer, Package, 
  Home, CreditCard, Banknote, Smartphone
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STORE_NAMES = {
  'runner': 'Runner',
  'gym-londres': 'GYM Londres'
};

const STATUS_CONFIG = {
  received: { label: 'Recebido', color: 'bg-gray-500', bgLight: 'bg-gray-50', borderColor: 'border-l-gray-500' },
  preparing: { label: 'Preparando', color: 'bg-amber-500', bgLight: 'bg-amber-50', borderColor: 'border-l-amber-500' },
  ready: { label: 'Pronto', color: 'bg-brand-500', bgLight: 'bg-brand-50', borderColor: 'border-l-brand-500' }
};

const PAYMENT_ICONS = {
  pix: Smartphone,
  debit: CreditCard,
  credit: CreditCard,
  cash: Banknote
};

const PAYMENT_LABELS = {
  pix: 'PIX',
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Dinheiro'
};

const OrderCard = ({ order, onStatusChange, onDelete }) => {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const createdAt = new Date(order.created_at);
  const now = new Date();
  const minutesAgo = Math.floor((now - createdAt) / 60000);
  const PaymentIcon = PAYMENT_ICONS[order.payment_method] || Banknote;

  const formatPrice = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

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
        <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => onStatusChange(order.id, nextStatus)}>
          <ChefHat className="h-4 w-4 mr-2" />
          Iniciar Preparo
        </Button>
      );
    }
    return (
      <Button className="w-full bg-brand-600 hover:bg-brand-700 text-white" onClick={() => onStatusChange(order.id, nextStatus)}>
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Pronto
      </Button>
    );
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${config.borderColor} shadow-sm overflow-hidden`}>
      <div className={`px-3 py-2 ${config.bgLight} border-b border-border/50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{order.customer_name}</span>
            <Badge className={`${config.color} text-white text-xs`}>{config.label}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{minutesAgo}min</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs">
          {order.pickup_time && (
            <span className="text-brand-600 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> {order.pickup_time}
            </span>
          )}
          <span className="text-muted-foreground flex items-center gap-1">
            <PaymentIcon className="h-3 w-3" /> {PAYMENT_LABELS[order.payment_method]}
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="space-y-1 mb-3 text-sm">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span><span className="font-medium">{item.quantity}x</span> {item.name}</span>
              <span className="text-muted-foreground">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 flex justify-between items-center mb-3">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-brand-600">{formatPrice(order.total)}</span>
        </div>
        <div className="flex gap-2">
          {getActionButton()}
          {order.status === 'ready' && (
            <Button variant="outline" className="flex-1 text-destructive hover:bg-destructive hover:text-white" onClick={() => onDelete(order.id)}>
              <Trash2 className="h-4 w-4 mr-1" /> Entregue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const KitchenPage = () => {
  const { store } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        axios.get(`${API}/orders/${store}`),
        axios.get(`${API}/kitchen/${store}/stats`)
      ]);
      setOrders(ordersRes.data.orders.filter(o => o.status !== 'delivered'));
      setStats(statsRes.data);
      if (showToast) toast.success('Atualizado');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [store]);

  useEffect(() => {
    if (store) {
      fetchData();
      const interval = setInterval(() => fetchData(), 5000);
      return () => clearInterval(interval);
    }
  }, [store, fetchData]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API}/orders/${store}/${orderId}/status`, { status: newStatus });
      fetchData();
      toast.success(`Status: ${STATUS_CONFIG[newStatus].label}`);
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await axios.patch(`${API}/orders/${store}/${orderId}/status`, { status: 'delivered' });
      fetchData();
      toast.success('Pedido entregue');
    } catch (error) {
      toast.error('Erro');
    }
  };

  const receivedOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="kitchen-page">
      <Toaster position="top-center" richColors />
      
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <Home className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-heading text-lg font-bold">Cozinha</h1>
                <p className="text-xs text-muted-foreground">{STORE_NAMES[store]}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); fetchData(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="text-xl font-bold text-gray-700">{stats.pending}</span>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <span className="text-xl font-bold text-amber-700">{stats.preparing}</span>
              <p className="text-xs text-muted-foreground">Preparando</p>
            </div>
            <div className="bg-brand-50 rounded-lg p-2">
              <span className="text-xl font-bold text-brand-700">{stats.ready}</span>
              <p className="text-xs text-muted-foreground">Prontos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Received */}
          <div className="bg-white/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-sm">Aguardando</h2>
              <Badge variant="secondary">{receivedOrders.length}</Badge>
            </div>
            <div className="space-y-3">
              {receivedOrders.map(order => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
              ))}
              {receivedOrders.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum pedido
                </div>
              )}
            </div>
          </div>

          {/* Preparing */}
          <div className="bg-amber-50/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-sm">Preparando</h2>
              <Badge className="bg-amber-500">{preparingOrders.length}</Badge>
            </div>
            <div className="space-y-3">
              {preparingOrders.map(order => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
              ))}
              {preparingOrders.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ChefHat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum em preparo
                </div>
              )}
            </div>
          </div>

          {/* Ready */}
          <div className="bg-brand-50/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-brand-500" />
              <h2 className="font-semibold text-sm">Prontos</h2>
              <Badge className="bg-brand-500">{readyOrders.length}</Badge>
            </div>
            <div className="space-y-3">
              {readyOrders.map(order => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
              ))}
              {readyOrders.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum pronto
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
