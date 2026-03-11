import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { 
  Clock, ChefHat, CheckCircle2, RefreshCw, Trash2, Timer, Package, 
  Home, CreditCard, Banknote, Smartphone, DollarSign, Plus, Minus,
  AlertTriangle, Coffee, Droplets
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STORE_NAMES = { 'runner': 'Runner', 'gym-londres': 'GYM Londres' };

const STATUS_CONFIG = {
  received: { label: 'Recebido', color: 'bg-gray-500', bgLight: 'bg-gray-50', borderColor: 'border-l-gray-500' },
  preparing: { label: 'Preparando', color: 'bg-amber-500', bgLight: 'bg-amber-50', borderColor: 'border-l-amber-500' },
  ready: { label: 'Pronto', color: 'bg-brand-500', bgLight: 'bg-brand-50', borderColor: 'border-l-brand-500' }
};

const PAYMENT_ICONS = { pix: Smartphone, debit: CreditCard, credit: CreditCard, cash: Banknote };
const PAYMENT_LABELS = { pix: 'PIX', debit: 'Débito', credit: 'Crédito', cash: 'Dinheiro' };

const formatPrice = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);

// Order Card Component
const OrderCard = ({ order, onStatusChange, onDelete }) => {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const createdAt = new Date(order.created_at);
  const now = new Date();
  const minutesAgo = Math.floor((now - createdAt) / 60000);
  const PaymentIcon = PAYMENT_ICONS[order.payment_method] || Banknote;

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
        <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => onStatusChange(order.id, nextStatus)}>
          <ChefHat className="h-4 w-4 mr-1" /> Preparar
        </Button>
      );
    }
    return (
      <Button size="sm" className="w-full bg-brand-600 hover:bg-brand-700 text-white" onClick={() => onStatusChange(order.id, nextStatus)}>
        <CheckCircle2 className="h-4 w-4 mr-1" /> Pronto
      </Button>
    );
  };

  return (
    <div className={`bg-white rounded-lg border-l-4 ${config.borderColor} shadow-sm overflow-hidden`}>
      <div className={`px-3 py-2 ${config.bgLight} border-b border-border/50`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">{order.customer_name}</span>
          <span className="text-xs text-muted-foreground">{minutesAgo}min</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          {order.pickup_time && <span className="text-brand-600 font-medium">{order.pickup_time}</span>}
          <span className="text-muted-foreground flex items-center gap-1">
            <PaymentIcon className="h-3 w-3" /> {PAYMENT_LABELS[order.payment_method]}
          </span>
        </div>
      </div>
      <div className="p-2">
        <div className="space-y-1 mb-2 text-xs">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span><b>{item.quantity}x</b> {item.name}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 flex justify-between items-center text-sm mb-2">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-brand-600">{formatPrice(order.total)}</span>
        </div>
        <div className="flex gap-1">
          {getActionButton()}
          {order.status === 'ready' && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(order.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Stock Item Component
const StockItem = ({ item, onUpdate }) => {
  const [qty, setQty] = useState(item.quantity);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async (newQty) => {
    if (newQty < 0) return;
    setUpdating(true);
    setQty(newQty);
    await onUpdate(item.menu_item_id, newQty);
    setUpdating(false);
  };

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg border ${item.low_stock ? 'border-red-200 bg-red-50' : 'border-border'}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {item.low_stock && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        <span className="text-sm font-medium truncate">{item.name}</span>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleUpdate(qty - 1)} disabled={updating || qty <= 0}>
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          value={qty}
          onChange={(e) => handleUpdate(parseInt(e.target.value) || 0)}
          className="w-14 h-7 text-center text-sm"
          min="0"
        />
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleUpdate(qty + 1)} disabled={updating}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// Add Item Dialog
const AddItemDialog = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Ingredientes');
  const [quantity, setQuantity] = useState(10);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd({ name: name.trim(), category, quantity });
      setName('');
      setQuantity(10);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Item</Label>
            <Input
              placeholder="Ex: Leite Integral (litro)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Quantidade Inicial</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-brand-600 hover:bg-brand-700">Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const KitchenPage = () => {
  const { store } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pedidos');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0 });
  const [cashData, setCashData] = useState({ total: 0, by_payment_method: {} });
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [ordersRes, statsRes, cashRes, stockRes] = await Promise.all([
        axios.get(`${API}/orders/${store}`),
        axios.get(`${API}/kitchen/${store}/stats`),
        axios.get(`${API}/cash/${store}/today`),
        axios.get(`${API}/stock/${store}`)
      ]);
      setOrders(ordersRes.data.orders.filter(o => o.status !== 'delivered'));
      setStats(statsRes.data);
      setCashData(cashRes.data);
      setStock(stockRes.data.stock);
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
      // Initialize stock first
      axios.post(`${API}/stock/${store}/initialize`).then(() => fetchData());
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

  const handleStockUpdate = async (menuItemId, quantity) => {
    try {
      await axios.put(`${API}/stock/${store}/${menuItemId}`, { quantity });
    } catch (error) {
      toast.error('Erro ao atualizar estoque');
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      await axios.post(`${API}/stock/${store}/add`, itemData);
      fetchData();
      toast.success('Item adicionado');
    } catch (error) {
      toast.error('Erro ao adicionar');
    }
  };

  const receivedOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const bebidasStock = stock.filter(s => s.type === 'bebida');
  const ingredientesStock = stock.filter(s => s.type === 'ingrediente' || s.type === 'custom');
  const lowStockCount = stock.filter(s => s.low_stock).length;

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
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
                <Home className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-heading text-base font-bold">Cozinha - {STORE_NAMES[store]}</h1>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); fetchData(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="text-lg font-bold text-gray-700">{stats.pending}</span>
              <p className="text-muted-foreground">Aguardando</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <span className="text-lg font-bold text-amber-700">{stats.preparing}</span>
              <p className="text-muted-foreground">Preparando</p>
            </div>
            <div className="bg-brand-50 rounded-lg p-2">
              <span className="text-lg font-bold text-brand-700">{stats.ready}</span>
              <p className="text-muted-foreground">Prontos</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <span className="text-lg font-bold text-green-700">{formatPrice(cashData.total)}</span>
              <p className="text-muted-foreground">Hoje</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="pedidos" className="text-xs">
              Pedidos
              {(stats.pending + stats.preparing) > 0 && (
                <Badge className="ml-1 bg-brand-600 h-5 w-5 p-0 justify-center">{stats.pending + stats.preparing}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="caixa" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" /> Caixa
            </TabsTrigger>
            <TabsTrigger value="estoque" className="text-xs">
              <Package className="h-3 w-3 mr-1" /> Estoque
              {lowStockCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">{lowStockCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* PEDIDOS TAB */}
          <TabsContent value="pedidos" className="mt-0">
            <div className="grid grid-cols-3 gap-2">
              {/* Received */}
              <div className="bg-white/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-gray-600">
                  <Clock className="h-3 w-3" /> Aguardando
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {receivedOrders.map(order => (
                    <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                  {receivedOrders.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-xs">Nenhum pedido</div>
                  )}
                </div>
              </div>

              {/* Preparing */}
              <div className="bg-amber-50/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-amber-600">
                  <ChefHat className="h-3 w-3" /> Preparando
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {preparingOrders.map(order => (
                    <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                  {preparingOrders.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-xs">Nenhum em preparo</div>
                  )}
                </div>
              </div>

              {/* Ready */}
              <div className="bg-brand-50/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-brand-600">
                  <CheckCircle2 className="h-3 w-3" /> Prontos
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {readyOrders.map(order => (
                    <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                  {readyOrders.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-xs">Nenhum pronto</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* CAIXA TAB */}
          <TabsContent value="caixa" className="mt-0">
            <div className="bg-white rounded-xl p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-brand-600" />
                Vendas de Hoje
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-brand-50 rounded-xl p-4 text-center">
                  <Smartphone className="h-6 w-6 mx-auto mb-2 text-brand-600" />
                  <p className="text-xs text-muted-foreground">PIX</p>
                  <p className="text-xl font-bold text-brand-600">{formatPrice(cashData.by_payment_method?.pix)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <CreditCard className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-xs text-muted-foreground">Débito</p>
                  <p className="text-xl font-bold text-blue-600">{formatPrice(cashData.by_payment_method?.debit)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <CreditCard className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-xs text-muted-foreground">Crédito</p>
                  <p className="text-xl font-bold text-purple-600">{formatPrice(cashData.by_payment_method?.credit)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <Banknote className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-xs text-muted-foreground">Dinheiro</p>
                  <p className="text-xl font-bold text-green-600">{formatPrice(cashData.by_payment_method?.cash)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total do Dia</span>
                  <span className="text-2xl font-bold text-brand-600">{formatPrice(cashData.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{cashData.order_count || 0} pedidos finalizados</p>
              </div>
            </div>
          </TabsContent>

          {/* ESTOQUE TAB */}
          <TabsContent value="estoque" className="mt-0">
            <div className="space-y-4">
              {/* Bebidas */}
              <div className="bg-white rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-amber-600" /> Bebidas
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bebidasStock.map(item => (
                    <StockItem key={item.menu_item_id} item={item} onUpdate={handleStockUpdate} />
                  ))}
                  {bebidasStock.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhuma bebida no estoque</p>
                  )}
                </div>
              </div>

              {/* Ingredientes */}
              <div className="bg-white rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-600" /> Ingredientes
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ingredientesStock.map(item => (
                    <StockItem key={item.menu_item_id} item={item} onUpdate={handleStockUpdate} />
                  ))}
                  {ingredientesStock.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum ingrediente no estoque</p>
                  )}
                </div>
              </div>

              {lowStockCount > 0 && (
                <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-700 font-medium">
                    {lowStockCount} {lowStockCount === 1 ? 'item' : 'itens'} com estoque baixo
                  </span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AddItemDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={handleAddItem} />
    </div>
  );
};
