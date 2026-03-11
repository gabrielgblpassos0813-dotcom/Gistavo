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
  Clock, ChefHat, CheckCircle2, RefreshCw, Trash2, Package, 
  Home, CreditCard, Banknote, Smartphone, DollarSign, Plus, Minus,
  AlertTriangle, Coffee, Droplets, Sun, Moon
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STORE_NAMES = { 'runner': 'Runner', 'gym-londres': 'GYM Londres' };

const STATUS_CONFIG = {
  received: { label: 'Recebido', color: 'bg-gray-500', bgLight: 'bg-gray-50', borderColor: 'border-l-gray-500' },
  preparing: { label: 'Preparando', color: 'bg-amber-500', bgLight: 'bg-amber-50', borderColor: 'border-l-amber-500' },
  ready: { label: 'Pronto', color: 'bg-brand-500', bgLight: 'bg-brand-50', borderColor: 'border-l-brand-500' }
};

const PAYMENT_ICONS = { pix: Smartphone, debit: CreditCard, credit: CreditCard, cash: Banknote };
const PAYMENT_LABELS = { pix: 'PIX', debit: 'Déb', credit: 'Créd', cash: 'Din' };

const formatPrice = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);

// Order Card Component - Mobile optimized
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

  return (
    <div className={`bg-white rounded-lg border-l-4 ${config.borderColor} shadow-sm`}>
      <div className={`px-2 py-1.5 ${config.bgLight} flex items-center justify-between`}>
        <span className="font-bold text-sm truncate flex-1">{order.customer_name}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
          <PaymentIcon className="h-3 w-3" />
          {order.pickup_time && <span className="text-brand-600 font-medium">{order.pickup_time}</span>}
          <span>{minutesAgo}m</span>
        </div>
      </div>
      <div className="p-2">
        <div className="text-xs space-y-0.5 mb-2">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="truncate"><b>{item.quantity}x</b> {item.name}</div>
          ))}
          {order.items.length > 3 && <div className="text-muted-foreground">+{order.items.length - 3} itens</div>}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-brand-600 text-sm">{formatPrice(order.total)}</span>
          <div className="flex gap-1">
            {getNextStatus() === 'preparing' && (
              <Button size="sm" className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => onStatusChange(order.id, 'preparing')}>
                Preparar
              </Button>
            )}
            {getNextStatus() === 'ready' && (
              <Button size="sm" className="h-7 px-2 text-xs bg-brand-600 hover:bg-brand-700" onClick={() => onStatusChange(order.id, 'ready')}>
                Pronto
              </Button>
            )}
            {order.status === 'ready' && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive" onClick={() => onDelete(order.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
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
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {item.low_stock && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
        <span className="text-xs font-medium truncate">{item.name}</span>
      </div>
      <div className="flex items-center gap-1 ml-1">
        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleUpdate(qty - 1)} disabled={updating || qty <= 0}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-xs font-bold">{qty}</span>
        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => handleUpdate(qty + 1)} disabled={updating}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// Add Item Dialog
const AddItemDialog = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(10);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd({ name: name.trim(), category: 'Ingredientes', quantity });
      setName('');
      setQuantity(10);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Adicionar Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Nome do Item</Label>
            <Input placeholder="Ex: Leite (litro)" value={name} onChange={(e) => setName(e.target.value)} required className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Quantidade</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} min="0" className="h-9" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" className="bg-brand-600 hover:bg-brand-700">Adicionar</Button>
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
  const [cashData, setCashData] = useState({ total: 0, by_payment_method: {}, shifts: {} });
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
      toast.error('Erro ao carregar');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [store]);

  useEffect(() => {
    if (store) {
      axios.post(`${API}/stock/${store}/initialize`).then(() => fetchData());
      const interval = setInterval(() => fetchData(), 5000);
      return () => clearInterval(interval);
    }
  }, [store, fetchData]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API}/orders/${store}/${orderId}/status`, { status: newStatus });
      fetchData();
      toast.success(STATUS_CONFIG[newStatus].label);
    } catch (error) {
      toast.error('Erro');
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await axios.patch(`${API}/orders/${store}/${orderId}/status`, { status: 'delivered' });
      fetchData();
      toast.success('Entregue');
    } catch (error) {
      toast.error('Erro');
    }
  };

  const handleStockUpdate = async (menuItemId, quantity) => {
    try {
      await axios.put(`${API}/stock/${store}/${menuItemId}`, { quantity });
    } catch (error) {
      toast.error('Erro');
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      await axios.post(`${API}/stock/${store}/add`, itemData);
      fetchData();
      toast.success('Adicionado');
    } catch (error) {
      toast.error('Erro');
    }
  };

  const receivedOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const bebidasStock = stock.filter(s => s.type === 'bebida');
  const ingredientesStock = stock.filter(s => s.type === 'ingrediente' || s.type === 'custom');
  const lowStockCount = stock.filter(s => s.low_stock).length;

  const morningShift = cashData.shifts?.morning || { total: 0, count: 0, by_payment: {} };
  const afternoonShift = cashData.shifts?.afternoon || { total: 0, count: 0, by_payment: {} };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="kitchen-page">
      <Toaster position="top-center" richColors />
      
      {/* Header - Mobile optimized */}
      <header className="bg-white border-b sticky top-0 z-50 px-2 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
              <Home className="h-4 w-4" />
            </Button>
            <span className="font-bold text-sm">{STORE_NAMES[store]}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-bold text-brand-600 text-sm">{formatPrice(cashData.total)}</p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setIsRefreshing(true); fetchData(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-1 mt-2 text-center text-xs">
          <div className="bg-gray-100 rounded py-1">
            <span className="font-bold text-gray-700">{stats.pending}</span>
            <span className="text-muted-foreground ml-1">Aguard.</span>
          </div>
          <div className="bg-amber-100 rounded py-1">
            <span className="font-bold text-amber-700">{stats.preparing}</span>
            <span className="text-muted-foreground ml-1">Prep.</span>
          </div>
          <div className="bg-brand-100 rounded py-1">
            <span className="font-bold text-brand-700">{stats.ready}</span>
            <span className="text-muted-foreground ml-1">Prontos</span>
          </div>
        </div>
      </header>

      <main className="p-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="pedidos" className="text-xs h-7">
              Pedidos {(stats.pending + stats.preparing) > 0 && <Badge className="ml-1 bg-brand-600 h-4 min-w-4 p-0 justify-center text-[10px]">{stats.pending + stats.preparing}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="caixa" className="text-xs h-7">Caixa</TabsTrigger>
            <TabsTrigger value="estoque" className="text-xs h-7">
              Estoque {lowStockCount > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 p-0 justify-center text-[10px]">{lowStockCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* PEDIDOS TAB */}
          <TabsContent value="pedidos" className="mt-2">
            <div className="space-y-3">
              {/* Aguardando */}
              {receivedOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-gray-600">
                    <Clock className="h-3 w-3" /> Aguardando ({receivedOrders.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {receivedOrders.map(order => (
                      <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}

              {/* Preparando */}
              {preparingOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-amber-600">
                    <ChefHat className="h-3 w-3" /> Preparando ({preparingOrders.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {preparingOrders.map(order => (
                      <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}

              {/* Prontos */}
              {readyOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-brand-600">
                    <CheckCircle2 className="h-3 w-3" /> Prontos ({readyOrders.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {readyOrders.map(order => (
                      <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}

              {orders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum pedido</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* CAIXA TAB */}
          <TabsContent value="caixa" className="mt-2 space-y-3">
            {/* Turno Manhã */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">Manhã (06:00 - 14:00)</span>
                <Badge variant="secondary" className="ml-auto">{morningShift.count} pedidos</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div className="bg-brand-50 rounded-lg p-2">
                  <Smartphone className="h-4 w-4 mx-auto text-brand-600" />
                  <p className="text-[10px] text-muted-foreground">PIX</p>
                  <p className="text-xs font-bold text-brand-600">{formatPrice(morningShift.by_payment?.pix)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-600" />
                  <p className="text-[10px] text-muted-foreground">Déb</p>
                  <p className="text-xs font-bold text-blue-600">{formatPrice(morningShift.by_payment?.debit)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-purple-600" />
                  <p className="text-[10px] text-muted-foreground">Créd</p>
                  <p className="text-xs font-bold text-purple-600">{formatPrice(morningShift.by_payment?.credit)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <Banknote className="h-4 w-4 mx-auto text-green-600" />
                  <p className="text-[10px] text-muted-foreground">Din</p>
                  <p className="text-xs font-bold text-green-600">{formatPrice(morningShift.by_payment?.cash)}</p>
                </div>
              </div>
              <div className="text-right border-t pt-2">
                <span className="text-sm text-muted-foreground">Subtotal: </span>
                <span className="font-bold text-brand-600">{formatPrice(morningShift.total)}</span>
              </div>
            </div>

            {/* Turno Tarde */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold text-sm">Tarde/Noite (14:00 - 22:00)</span>
                <Badge variant="secondary" className="ml-auto">{afternoonShift.count} pedidos</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div className="bg-brand-50 rounded-lg p-2">
                  <Smartphone className="h-4 w-4 mx-auto text-brand-600" />
                  <p className="text-[10px] text-muted-foreground">PIX</p>
                  <p className="text-xs font-bold text-brand-600">{formatPrice(afternoonShift.by_payment?.pix)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-600" />
                  <p className="text-[10px] text-muted-foreground">Déb</p>
                  <p className="text-xs font-bold text-blue-600">{formatPrice(afternoonShift.by_payment?.debit)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-purple-600" />
                  <p className="text-[10px] text-muted-foreground">Créd</p>
                  <p className="text-xs font-bold text-purple-600">{formatPrice(afternoonShift.by_payment?.credit)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <Banknote className="h-4 w-4 mx-auto text-green-600" />
                  <p className="text-[10px] text-muted-foreground">Din</p>
                  <p className="text-xs font-bold text-green-600">{formatPrice(afternoonShift.by_payment?.cash)}</p>
                </div>
              </div>
              <div className="text-right border-t pt-2">
                <span className="text-sm text-muted-foreground">Subtotal: </span>
                <span className="font-bold text-brand-600">{formatPrice(afternoonShift.total)}</span>
              </div>
            </div>

            {/* Total do Dia */}
            <div className="bg-brand-600 text-white rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm opacity-80">Total do Dia</p>
                  <p className="text-xs opacity-60">{cashData.order_count || 0} pedidos</p>
                </div>
                <p className="text-2xl font-bold">{formatPrice(cashData.total)}</p>
              </div>
            </div>
          </TabsContent>

          {/* ESTOQUE TAB */}
          <TabsContent value="estoque" className="mt-2 space-y-3">
            {/* Bebidas */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <Coffee className="h-4 w-4 text-amber-600" /> Bebidas
                </h3>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {bebidasStock.map(item => (
                  <StockItem key={item.menu_item_id} item={item} onUpdate={handleStockUpdate} />
                ))}
                {bebidasStock.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma bebida</p>}
              </div>
            </div>

            {/* Ingredientes */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <Droplets className="h-4 w-4 text-blue-600" /> Ingredientes
                </h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {ingredientesStock.map(item => (
                  <StockItem key={item.menu_item_id} item={item} onUpdate={handleStockUpdate} />
                ))}
                {ingredientesStock.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum ingrediente</p>}
              </div>
            </div>

            {lowStockCount > 0 && (
              <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-red-700 font-medium">{lowStockCount} item(ns) com estoque baixo</span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AddItemDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={handleAddItem} />
    </div>
  );
};
