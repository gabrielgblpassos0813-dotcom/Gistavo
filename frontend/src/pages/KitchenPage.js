import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Clock, ChefHat, CheckCircle2, RefreshCw, Trash2, Package, 
  Home, Smartphone, Plus, Minus, Banknote, CreditCard,
  AlertTriangle, Coffee, Droplets, Image, X, Check, History, Sun, Moon, Volume2, VolumeX, CalendarClock, MessageCircle, Loader2, Pencil, UtensilsCrossed, UserPlus, DollarSign
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STORE_NAMES = { 'runner': 'Runner', 'gym-londres': 'GYM Londres' };

const STATUS_CONFIG = {
  pending_payment: { label: 'Aguardando PIX', color: 'bg-blue-500', bgLight: 'bg-blue-50', borderColor: 'border-l-blue-500' },
  received: { label: 'Recebido', color: 'bg-gray-500', bgLight: 'bg-gray-50', borderColor: 'border-l-gray-500' },
  preparing: { label: 'Preparando', color: 'bg-amber-500', bgLight: 'bg-amber-50', borderColor: 'border-l-amber-500' },
  ready: { label: 'Pronto', color: 'bg-brand-500', bgLight: 'bg-brand-50', borderColor: 'border-l-brand-500' }
};

const PAYMENT_ICONS = { pix: Smartphone };
const PAYMENT_LABELS = { pix: 'PIX', debit: 'Déb', credit: 'Créd', cash: 'Din' };

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

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
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-brand-600">{formatCurrency(order.total)}</span>
        </div>
        <div className="flex items-center justify-end gap-1">
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

// PIX Pending Card Component
const PixPendingCard = ({ order, onApprove, onReject, onViewProof, onRetryVerify }) => {
  const createdAt = new Date(order.created_at);
  const proofUploadedAt = order.pix_proof_at ? new Date(order.pix_proof_at) : null;
  const now = new Date();
  const minutesAgo = Math.floor((now - createdAt) / 60000);
  
  // Calculate time since proof upload for verification status
  // If no pix_proof_at, consider it as already timed out (legacy order)
  const secondsSinceProofUpload = proofUploadedAt ? Math.floor((now - proofUploadedAt) / 1000) : 999;
  const isVerifying = order.pix_proof && !order.pix_analysis && secondsSinceProofUpload < 30;
  const verificationTimedOut = order.pix_proof && !order.pix_analysis && secondsSinceProofUpload >= 30;

  return (
    <div className="bg-white rounded-lg border-l-4 border-l-blue-500 shadow-sm">
      <div className="px-2 py-1.5 bg-blue-50 flex items-center justify-between">
        <span className="font-bold text-sm truncate flex-1">{order.customer_name}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Smartphone className="h-3 w-3 text-blue-600" />
          <span>{minutesAgo}m</span>
        </div>
      </div>
      <div className="p-2">
        <div className="text-xs space-y-0.5 mb-2">
          {order.items.slice(0, 2).map((item, idx) => (
            <div key={idx} className="truncate"><b>{item.quantity}x</b> {item.name}</div>
          ))}
          {order.items.length > 2 && <div className="text-muted-foreground">+{order.items.length - 2} itens</div>}
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-blue-600">{formatCurrency(order.total)}</span>
          {order.pix_proof && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => onViewProof(order)}>
              <Image className="h-3 w-3 mr-1" />
              Ver
            </Button>
          )}
        </div>
        
        {/* AI Status indicator - Verifying */}
        {isVerifying && (
          <div className="w-full h-8 text-xs bg-purple-100 text-purple-700 rounded flex items-center justify-center gap-2 mb-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            IA verificando... ({Math.max(0, 30 - secondsSinceProofUpload)}s)
          </div>
        )}
        
        {/* AI Status indicator - Timed out (needs manual check or retry) */}
        {verificationTimedOut && (
          <div className="w-full text-xs bg-amber-100 text-amber-700 rounded p-2 mb-2 flex items-center justify-between">
            <span>⏳ Verificar manualmente ou</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-6 px-2 text-xs ml-2"
              onClick={() => onRetryVerify && onRetryVerify(order.id)}
            >
              🔄 Tentar IA
            </Button>
          </div>
        )}
        
        {/* AI Analysis result */}
        {order.pix_analysis && (
          <div className={`w-full text-xs rounded p-2 mb-2 ${order.pix_analysis.is_valid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {order.pix_analysis.is_valid ? '✅ IA aprovou!' : `⚠️ ${order.pix_analysis.reason}`}
            {order.pix_payer_name && <div className="text-[10px] mt-1">Pagador: {order.pix_payer_name}</div>}
            {order.pix_transaction_time && <div className="text-[10px]">Horário: {order.pix_transaction_time}</div>}
          </div>
        )}
        
        <div className="flex gap-1">
          <Button 
            size="sm" 
            className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700" 
            onClick={() => onApprove(order.id)}
            disabled={!order.pix_proof}
          >
            <Check className="h-3 w-3 mr-1" />
            Aprovar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" 
            onClick={() => onReject(order.id)}
          >
            <X className="h-3 w-3 mr-1" />
            Recusar
          </Button>
        </div>
      </div>
    </div>
  );
};

// History Card Component
const HistoryCard = ({ order }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white rounded-lg border shadow-sm p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{order.customer_name}</span>
        <span className="text-xs text-muted-foreground">{formatTime(order.delivered_at || order.updated_at || order.created_at)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {PAYMENT_ICONS[order.payment_method] && React.createElement(PAYMENT_ICONS[order.payment_method], { className: "h-3 w-3" })}
          <span>{PAYMENT_LABELS[order.payment_method]}</span>
          <span>• {order.items?.length || 0} itens</span>
        </div>
        <span className="text-sm font-bold text-brand-600">{formatCurrency(order.total)}</span>
      </div>
      {/* Items expandable */}
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="text-xs text-brand-600 mt-1 hover:underline"
      >
        {expanded ? 'Ocultar itens ▲' : 'Ver itens ▼'}
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t space-y-1">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Stock Item Component
const StockItem = ({ item, onUpdate }) => {
  const [qty, setQty] = useState(item.quantity);
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.quantity.toString());
  const inputRef = useRef(null);

  const handleUpdate = async (newQty) => {
    if (newQty < 0) return;
    setUpdating(true);
    setQty(newQty);
    await onUpdate(item.menu_item_id, newQty);
    setUpdating(false);
  };

  const handleEditClick = () => {
    setEditValue(qty.toString());
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleEditSubmit = () => {
    const newQty = parseInt(editValue) || 0;
    if (newQty >= 0) {
      handleUpdate(newQty);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(qty.toString());
    }
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
        {isEditing ? (
          <input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSubmit}
            onKeyDown={handleEditKeyDown}
            className="w-12 h-6 text-center text-xs font-bold border rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
            min="0"
            autoFocus
          />
        ) : (
          <button 
            onClick={handleEditClick}
            className="w-10 h-6 text-center text-xs font-bold hover:bg-gray-100 rounded cursor-pointer transition-colors"
            title="Clique para editar"
          >
            {qty}
          </button>
        )}
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

// PIX Proof Dialog
const PixProofDialog = ({ isOpen, onClose, order }) => {
  if (!order) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Comprovante PIX - {order.customer_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Itens</span>
              <span>{order.items?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-brand-600">{formatCurrency(order.total)}</span>
            </div>
          </div>
          {order.pix_proof ? (
            <img 
              src={order.pix_proof} 
              alt="Comprovante PIX" 
              className="w-full max-h-[50vh] object-contain rounded-lg border"
            />
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Comprovante não enviado</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const KitchenPage = () => {
  const { store } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pedidos');
  const [orders, setOrders] = useState([]);
  const [pendingPixOrders, setPendingPixOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0 });
  const [salesData, setSalesData] = useState({ shifts: { morning: { count: 0, by_payment: {} }, afternoon: { count: 0, by_payment: {} } }, order_count: 0 });
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [proofDialogOrder, setProofDialogOrder] = useState(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [prazoDebts, setPrazoDebts] = useState({ debts: [], total_prazo: 0 });
  const [showPrazoPayDialog, setShowPrazoPayDialog] = useState(false);
  const [selectedPrazoCustomer, setSelectedPrazoCustomer] = useState(null);
  const [prazoPassword, setPrazoPassword] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  // Adicionais and Menu states
  const [adicionais, setAdicionais] = useState([]);
  const [showAdicionalDialog, setShowAdicionalDialog] = useState(false);
  const [newAdicional, setNewAdicional] = useState({ name: '', price: '' });
  const [editingAdicional, setEditingAdicional] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({ name: '', description: '', price: '', category: 'doces' });
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  // Prazo customers state
  const [prazoCustomers, setPrazoCustomers] = useState([]);
  const [showPrazoCustomerDialog, setShowPrazoCustomerDialog] = useState(false);
  const [newPrazoCustomer, setNewPrazoCustomer] = useState({ name: '', phone: '', notes: '' });
  const prevOrderCount = useRef(0);
  const audioRef = useRef(null);

  // Initialize audio for new order notification
  useEffect(() => {
    // Create a better notification sound using Web Audio API
    const createNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log('Audio not supported');
      }
    };
    
    audioRef.current = { play: createNotificationSound };
  }, []);

  // Play sound when new order arrives
  const playNewOrderSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      try {
        audioRef.current.play();
      } catch (e) {
        console.log('Could not play sound');
      }
    }
  }, [soundEnabled]);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const requests = [
        axios.get(`${API}/orders/${store}`),
        axios.get(`${API}/kitchen/${store}/stats`),
        axios.get(`${API}/cash/${store}/today`),
        axios.get(`${API}/stock/${store}`),
        axios.get(`${API}/orders/${store}/pending-pix`),
        axios.get(`${API}/orders/${store}/history`),
        axios.get(`${API}/prazo/debts`),  // Fetch prazo debts for all stores
        axios.get(`${API}/kitchen/adicionais`),  // Fetch adicionais
        axios.get(`${API}/menu/${store}`),  // Fetch menu items
        axios.get(`${API}/prazo/customers`)  // Fetch prazo customers
      ];
      
      const results = await Promise.all(requests);
      const [ordersRes, statsRes, cashRes, stockRes, pixRes, historyRes, prazoDebtsRes, adicionaisRes, menuRes, prazoCustomersRes] = results;
      
      const newOrders = ordersRes.data.orders.filter(o => !['delivered', 'pending_payment', 'payment_rejected'].includes(o.status));
      
      // Check if there are new orders
      const newPendingCount = newOrders.filter(o => o.status === 'received').length + pixRes.data.orders.length;
      if (prevOrderCount.current > 0 && newPendingCount > prevOrderCount.current) {
        playNewOrderSound();
        toast.info('Novo pedido!', { duration: 3000 });
      }
      prevOrderCount.current = newPendingCount;
      
      setOrders(newOrders);
      setStats(statsRes.data);
      setSalesData(cashRes.data);
      setStock(stockRes.data.stock);
      setPendingPixOrders(pixRes.data.orders);
      setHistoryOrders(historyRes.data.orders);
      
      // Set prazo debts for all stores
      if (prazoDebtsRes) {
        setPrazoDebts(prazoDebtsRes.data);
      }
      
      // Set adicionais
      if (adicionaisRes) {
        setAdicionais(adicionaisRes.data.adicionais || []);
      }
      
      // Set menu items
      if (menuRes) {
        setMenuItems(menuRes.data.items || []);
      }
      
      // Set prazo customers
      if (prazoCustomersRes) {
        setPrazoCustomers(prazoCustomersRes.data.customers || []);
      }
      
      if (showToast) toast.success('Atualizado');
    } catch (error) {
      toast.error('Erro ao carregar');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [store, playNewOrderSound]);

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
      toast.success(STATUS_CONFIG[newStatus]?.label || newStatus);
    } catch (error) {
      toast.error('Erro');
    }
  };

  const handleDelete = async (orderId) => {
    try {
      // Delete permanently - won't appear in history or gestor
      await axios.delete(`${API}/orders/${store}/${orderId}`);
      fetchData();
      toast.success('Pedido apagado');
    } catch (error) {
      toast.error('Erro ao apagar');
    }
  };

  const handleApprovePayment = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${store}/${orderId}/approve-payment`, { approved: true });
      fetchData();
      toast.success('Pagamento aprovado!');
    } catch (error) {
      toast.error('Erro ao aprovar');
    }
  };

  const handleRejectPayment = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${store}/${orderId}/approve-payment`, { approved: false, rejection_reason: 'Comprovante inválido' });
      fetchData();
      toast.error('Pagamento recusado');
    } catch (error) {
      toast.error('Erro ao recusar');
    }
  };

  // Auto-verify PIX payment with AI
  const handleAutoVerifyPix = async (orderId) => {
    try {
      toast.loading('🤖 IA analisando comprovante...', { id: `verify-${orderId}` });
      
      const response = await axios.post(`${API}/orders/${store}/${orderId}/auto-verify-pix`);
      
      if (response.data.auto_approved) {
        toast.success(`✅ PIX aprovado automaticamente!\nPagador: ${response.data.payer_name}\nValor: R$ ${response.data.extracted_amount?.toFixed(2)}`, { 
          id: `verify-${orderId}`,
          duration: 5000 
        });
      } else {
        toast.error(`⚠️ Verificação manual necessária: ${response.data.message}`, { 
          id: `verify-${orderId}`,
          duration: 5000 
        });
      }
      
      fetchData();
      return response.data;
    } catch (error) {
      toast.error('Erro na verificação automática', { id: `verify-${orderId}` });
      return null;
    }
  };

  const handlePayPrazo = async () => {
    if (!selectedPrazoCustomer || !prazoPassword) return;
    
    setIsPaying(true);
    try {
      await axios.post(`${API}/prazo/pay-all/${encodeURIComponent(selectedPrazoCustomer.name)}`, {
        amount: selectedPrazoCustomer.total,
        password: prazoPassword
      });
      toast.success(`Pagamento de ${selectedPrazoCustomer.name} registrado!`);
      setShowPrazoPayDialog(false);
      setSelectedPrazoCustomer(null);
      setPrazoPassword('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao registrar pagamento');
    } finally {
      setIsPaying(false);
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

  // ==================== ADICIONAIS MANAGEMENT ====================
  const handleSaveAdicional = async () => {
    if (!newAdicional.name || !newAdicional.price) {
      toast.error('Preencha nome e preço');
      return;
    }
    try {
      const data = { name: newAdicional.name, price: parseFloat(newAdicional.price) };
      if (editingAdicional) {
        await axios.put(`${API}/kitchen/adicionais/${editingAdicional.id}`, data);
        toast.success('Adicional atualizado!');
      } else {
        await axios.post(`${API}/kitchen/adicionais`, data);
        toast.success('Adicional criado!');
      }
      setShowAdicionalDialog(false);
      setNewAdicional({ name: '', price: '' });
      setEditingAdicional(null);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar adicional');
    }
  };

  const handleDeleteAdicional = async (adicionalId) => {
    try {
      await axios.delete(`${API}/kitchen/adicionais/${adicionalId}`);
      toast.success('Adicional removido');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  // ==================== MENU MANAGEMENT ====================
  const handleSaveMenuItem = async () => {
    if (!newMenuItem.name || !newMenuItem.price) {
      toast.error('Preencha nome e preço');
      return;
    }
    try {
      const data = {
        name: newMenuItem.name,
        description: newMenuItem.description || '',
        price: parseFloat(newMenuItem.price),
        category: newMenuItem.category || 'doces',
        store: store,
        available: true
      };
      if (editingMenuItem) {
        await axios.put(`${API}/kitchen/menu/${editingMenuItem.id}`, { ...editingMenuItem, ...data });
        toast.success('Item atualizado!');
      } else {
        await axios.post(`${API}/kitchen/menu`, data);
        toast.success('Item criado!');
      }
      setShowMenuDialog(false);
      setNewMenuItem({ name: '', description: '', price: '', category: 'doces' });
      setEditingMenuItem(null);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar item');
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    try {
      await axios.delete(`${API}/kitchen/menu/${itemId}`);
      toast.success('Item removido');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  // ==================== PRAZO CUSTOMERS MANAGEMENT ====================
  const handleSavePrazoCustomer = async () => {
    if (!newPrazoCustomer.name) {
      toast.error('Preencha o nome do cliente');
      return;
    }
    try {
      await axios.post(`${API}/kitchen/prazo/customers`, newPrazoCustomer);
      toast.success('Cliente cadastrado!');
      setShowPrazoCustomerDialog(false);
      setNewPrazoCustomer({ name: '', phone: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao cadastrar');
    }
  };

  const handleDeletePrazoCustomer = async (customerId) => {
    try {
      await axios.delete(`${API}/kitchen/prazo/customers/${customerId}`);
      toast.success('Cliente removido');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  // WhatsApp charge functions
  const handleSendWhatsApp = async (customerName) => {
    try {
      toast.loading('Enviando cobrança...', { id: 'whatsapp' });
      const response = await axios.post(`${API}/prazo/charge-customer/${encodeURIComponent(customerName)}`);
      if (response.data.success) {
        toast.success(`Cobrança enviada para ${customerName}!`, { id: 'whatsapp' });
      } else {
        toast.error(response.data.message || 'Erro ao enviar', { id: 'whatsapp' });
      }
    } catch (error) {
      toast.error('Erro ao enviar cobrança', { id: 'whatsapp' });
    }
  };

  const handleChargeAllPrazo = async () => {
    try {
      toast.loading('Enviando cobranças...', { id: 'charge-all' });
      const response = await axios.post(`${API}/prazo/charge-all-whatsapp`);
      if (response.data.success) {
        toast.success(`${response.data.messages_sent} cobrança(s) enviada(s)!`, { id: 'charge-all' });
        if (response.data.failed?.length > 0) {
          toast.warning(`Falha em: ${response.data.failed.join(', ')}`);
        }
      } else {
        toast.error('Erro ao enviar cobranças', { id: 'charge-all' });
      }
    } catch (error) {
      toast.error('Erro ao enviar cobranças', { id: 'charge-all' });
    }
  };

  const handleAddCredit = async (customer) => {
    const amount = prompt(`Adicionar crédito para ${customer.name}:\nValor atual: R$ ${(customer.credit || 0).toFixed(2)}\n\nDigite o valor a adicionar:`);
    if (!amount || isNaN(parseFloat(amount))) return;
    
    try {
      const response = await axios.post(`${API}/prazo/customers/${customer.id}/add-credit`, {
        amount: parseFloat(amount)
      });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error('Erro ao adicionar crédito');
    }
  };

  const receivedOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const bebidasStock = stock.filter(s => s.type === 'bebida');
  const ingredientesStock = stock.filter(s => s.type === 'ingrediente' || s.type === 'custom');
  const lowStockCount = stock.filter(s => s.low_stock).length;

  const morningShift = salesData.shifts?.morning || { count: 0, by_payment: {} };
  const afternoonShift = salesData.shifts?.afternoon || { count: 0, by_payment: {} };

  // Hidden clear button - requires 5 clicks on store name + password
  const handleStoreNameClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setShowClearDialog(true);
      setClickCount(0);
    }
    // Reset after 3 seconds
    setTimeout(() => setClickCount(0), 3000);
  };

  const handleClearStoreData = async () => {
    setIsClearing(true);
    try {
      await axios.post(`${API}/admin/clear-store/${store}?password=${clearPassword}`);
      toast.success('Dados da loja foram apagados!');
      setShowClearDialog(false);
      setClearPassword('');
      fetchData(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Senha incorreta');
    } finally {
      setIsClearing(false);
    }
  };

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
            <span 
              className="font-bold text-sm cursor-pointer select-none" 
              onClick={handleStoreNameClick}
            >
              {STORE_NAMES[store]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={soundEnabled ? "default" : "outline"} 
              size="icon" 
              className={`h-8 w-8 ${soundEnabled ? 'bg-brand-600' : ''}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Som ativado" : "Som desativado"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setIsRefreshing(true); fetchData(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-1 mt-2 text-center text-xs">
          <div className="bg-blue-100 rounded py-1">
            <span className="font-bold text-blue-700">{pendingPixOrders.length}</span>
            <span className="text-muted-foreground ml-1">PIX</span>
          </div>
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
          <TabsList className="grid w-full h-9 grid-cols-8">
            <TabsTrigger value="pix" className="text-xs h-7 px-1">
              PIX {pendingPixOrders.length > 0 && <Badge className="ml-1 bg-blue-600 h-4 min-w-4 p-0 justify-center text-[10px]">{pendingPixOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="text-xs h-7 px-1">
              Pedidos {(stats.pending + stats.preparing) > 0 && <Badge className="ml-1 bg-brand-600 h-4 min-w-4 p-0 justify-center text-[10px]">{stats.pending + stats.preparing}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="vendas" className="text-xs h-7 px-1">Vendas</TabsTrigger>
            <TabsTrigger value="prazo" className="text-xs h-7 px-1">
              Prazo {prazoDebts.customer_count > 0 && <Badge className="ml-1 bg-amber-600 h-4 min-w-4 p-0 justify-center text-[10px]">{prazoDebts.customer_count}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="estoque" className="text-xs h-7 px-1">
              Est. {lowStockCount > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 p-0 justify-center text-[10px]">{lowStockCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cardapio" className="text-xs h-7 px-1">Card.</TabsTrigger>
            <TabsTrigger value="adicionais" className="text-xs h-7 px-1">Adic.</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs h-7 px-1">
              <History className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>

          {/* PIX PENDENTE TAB */}
          <TabsContent value="pix" className="mt-2">
            {pendingPixOrders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pendingPixOrders.map(order => (
                  <PixPendingCard 
                    key={order.id} 
                    order={order} 
                    onApprove={handleApprovePayment}
                    onReject={handleRejectPayment}
                    onViewProof={setProofDialogOrder}
                    onRetryVerify={handleAutoVerifyPix}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum PIX pendente</p>
              </div>
            )}
          </TabsContent>

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

          {/* VENDAS TAB */}
          <TabsContent value="vendas" className="mt-2 space-y-3">
            {/* Turno Manhã */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">Manhã (06:00 - 14:00)</span>
                <div className="ml-auto text-right">
                  <Badge variant="secondary" className="mb-1">{morningShift.count} pedidos</Badge>
                  <p className="text-xs text-muted-foreground">{formatCurrency(morningShift.total || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-brand-50 rounded-lg p-2">
                  <Smartphone className="h-4 w-4 mx-auto text-brand-600" />
                  <p className="text-[10px] text-muted-foreground">PIX</p>
                  <p className="text-sm font-bold text-brand-600">{formatCurrency(morningShift.by_payment?.pix || 0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-600" />
                  <p className="text-[10px] text-muted-foreground">Débito</p>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(morningShift.by_payment?.debit || 0)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-purple-600" />
                  <p className="text-[10px] text-muted-foreground">Crédito</p>
                  <p className="text-sm font-bold text-purple-600">{formatCurrency(morningShift.by_payment?.credit || 0)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <Banknote className="h-4 w-4 mx-auto text-green-600" />
                  <p className="text-[10px] text-muted-foreground">Dinheiro</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(morningShift.by_payment?.cash || 0)}</p>
                </div>
              </div>
            </div>

            {/* Turno Tarde */}
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold text-sm">Tarde/Noite (14:00 - 22:00)</span>
                <div className="ml-auto text-right">
                  <Badge variant="secondary" className="mb-1">{afternoonShift.count} pedidos</Badge>
                  <p className="text-xs text-muted-foreground">{formatCurrency(afternoonShift.total || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-brand-50 rounded-lg p-2">
                  <Smartphone className="h-4 w-4 mx-auto text-brand-600" />
                  <p className="text-[10px] text-muted-foreground">PIX</p>
                  <p className="text-sm font-bold text-brand-600">{formatCurrency(afternoonShift.by_payment?.pix || 0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-600" />
                  <p className="text-[10px] text-muted-foreground">Débito</p>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(afternoonShift.by_payment?.debit || 0)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <CreditCard className="h-4 w-4 mx-auto text-purple-600" />
                  <p className="text-[10px] text-muted-foreground">Crédito</p>
                  <p className="text-sm font-bold text-purple-600">{formatCurrency(afternoonShift.by_payment?.credit || 0)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <Banknote className="h-4 w-4 mx-auto text-green-600" />
                  <p className="text-[10px] text-muted-foreground">Dinheiro</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(afternoonShift.by_payment?.cash || 0)}</p>
                </div>
              </div>
            </div>

            {/* Total do Dia */}
            <div className="bg-brand-600 text-white rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm opacity-80">Total do Dia</p>
                  <p className="text-2xl font-bold">{formatCurrency(salesData.total || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Pedidos</p>
                  <p className="text-xl font-bold">{salesData.order_count || 0}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PRAZO TAB - For all stores */}
          <TabsContent value="prazo" className="mt-2 space-y-3">
            {/* Header with buttons */}
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-semibold text-sm">Clientes no Prazo</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={handleChargeAllPrazo}>
                  <MessageCircle className="h-3 w-3 mr-1" /> Cobrar Todos
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPrazoCustomerDialog(true)}>
                  <UserPlus className="h-3 w-3 mr-1" /> Novo Cliente
                </Button>
              </div>
            </div>
            
            {/* Total Prazo */}
            <div className="bg-amber-600 text-white rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm opacity-80">Total a Receber (Prazo)</p>
                  <p className="text-2xl font-bold">{formatCurrency(prazoDebts.total_prazo || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Clientes</p>
                  <p className="text-xl font-bold">{prazoDebts.customer_count || 0}</p>
                </div>
              </div>
            </div>

            {/* Clientes cadastrados com crédito */}
            {prazoCustomers.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <h4 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> Clientes com Crédito na Casa
                </h4>
                <div className="space-y-2">
                  {prazoCustomers.filter(c => (c.credit || 0) > 0).map(customer => (
                    <div key={customer.id} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone || 'Sem telefone'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">R$ {(customer.credit || 0).toFixed(2)}</span>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAddCredit(customer)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {prazoCustomers.filter(c => (c.credit || 0) > 0).length === 0 && (
                    <p className="text-xs text-blue-600 text-center py-2">Nenhum cliente com crédito</p>
                  )}
                </div>
              </div>
            )}

            {/* Lista de devedores */}
            {prazoDebts.debts?.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-amber-700">Débitos Pendentes</h4>
                {prazoDebts.debts.map((debt, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{debt.name}</p>
                        <p className="text-xs text-muted-foreground">{debt.order_count} pedido(s)</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-amber-600 mr-1">{formatCurrency(debt.total)}</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 h-8 px-2"
                          onClick={() => handleSendWhatsApp(debt.name)}
                          title="Enviar cobrança por WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 h-8 px-2"
                          onClick={() => {
                            setSelectedPrazoCustomer(debt);
                            setShowPrazoPayDialog(true);
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" /> Pagar
                        </Button>
                      </div>
                    </div>
                    {/* Orders detail */}
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {debt.orders.map((order, oidx) => (
                        <div key={oidx} className="flex justify-between text-xs text-muted-foreground">
                          <span>{new Date(order.date).toLocaleDateString('pt-BR')} - {order.items?.map(i => i.name).join(', ')}</span>
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum débito pendente</p>
              </div>
            )}
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

          {/* CARDÁPIO TAB */}
          <TabsContent value="cardapio" className="mt-2">
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <UtensilsCrossed className="h-4 w-4 text-brand-600" /> Cardápio
                </h3>
                <Button size="sm" variant="outline" onClick={() => { setEditingMenuItem(null); setNewMenuItem({ name: '', description: '', price: '', category: 'doces' }); setShowMenuDialog(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Novo Item
                </Button>
              </div>
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {menuItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum item personalizado</p>
                      <p className="text-xs">Adicione itens ao cardápio desta loja</p>
                    </div>
                  ) : (
                    menuItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 hover:bg-gray-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{item.category}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            R$ {item.price?.toFixed(2)} {item.description && `• ${item.description}`}
                          </div>
                          {item.codigo && <span className="text-[10px] text-muted-foreground">Cód: {item.codigo}</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingMenuItem(item); setNewMenuItem({ name: item.name, description: item.description || '', price: item.price?.toString() || '', category: item.category || 'doces' }); setShowMenuDialog(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDeleteMenuItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ADICIONAIS TAB */}
          <TabsContent value="adicionais" className="mt-2">
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <Plus className="h-4 w-4 text-green-600" /> Adicionais
                </h3>
                <Button size="sm" variant="outline" onClick={() => { setEditingAdicional(null); setNewAdicional({ name: '', price: '' }); setShowAdicionalDialog(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Novo Adicional
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Adicionais como ovos, queijo, mel disponíveis para todos os itens.
              </p>
              <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-2 gap-2 pr-2">
                  {adicionais.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      <Plus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum adicional cadastrado</p>
                    </div>
                  ) : (
                    adicionais.map(adicional => (
                      <div key={adicional.id} className="flex items-center justify-between p-2 border rounded-lg bg-green-50">
                        <div>
                          <p className="font-medium text-sm">{adicional.name}</p>
                          <p className="text-xs text-green-600">R$ {adicional.price?.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingAdicional(adicional); setNewAdicional({ name: adicional.name, price: adicional.price?.toString() || '' }); setShowAdicionalDialog(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => handleDeleteAdicional(adicional.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* HISTÓRICO TAB */}
          <TabsContent value="historico" className="mt-2">
            <div className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <History className="h-4 w-4 text-muted-foreground" /> Últimas 24h
                </h3>
                <Badge variant="secondary">{historyOrders.length} pedidos</Badge>
              </div>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-2 pr-2">
                  {historyOrders.map(order => (
                    <HistoryCard key={order.id} order={order} />
                  ))}
                  {historyOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum pedido nas últimas 24h</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AddItemDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={handleAddItem} />
      <PixProofDialog isOpen={!!proofDialogOrder} onClose={() => setProofDialogOrder(null)} order={proofDialogOrder} />
      
      {/* Hidden Clear Data Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-red-600 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Limpar Dados da Loja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Esta ação irá apagar <strong>todos os pedidos e histórico</strong> desta loja. Esta ação não pode ser desfeita.
            </p>
            <Input
              type="password"
              placeholder="Senha de administrador"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              className="h-9"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowClearDialog(false); setClearPassword(''); }}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                className="flex-1" 
                onClick={handleClearStoreData}
                disabled={isClearing || !clearPassword}
              >
                {isClearing ? 'Apagando...' : 'Apagar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prazo Payment Dialog */}
      <Dialog open={showPrazoPayDialog} onOpenChange={setShowPrazoPayDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-green-600 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedPrazoCustomer && (
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="font-medium">{selectedPrazoCustomer.name}</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(selectedPrazoCustomer.total)}</p>
                <p className="text-xs text-muted-foreground">{selectedPrazoCustomer.order_count} pedido(s) pendente(s)</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Digite a senha para confirmar:</p>
                <Input
                  type="password"
                  placeholder="Senha (1234)"
                  value={prazoPassword}
                  onChange={(e) => setPrazoPassword(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowPrazoPayDialog(false); setPrazoPassword(''); setSelectedPrazoCustomer(null); }}>
                  Cancelar
                </Button>
                <Button 
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700" 
                  onClick={handlePayPrazo}
                  disabled={isPaying || !prazoPassword}
                >
                  {isPaying ? 'Processando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adicional Dialog */}
      <Dialog open={showAdicionalDialog} onOpenChange={setShowAdicionalDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-green-600" />
              {editingAdicional ? 'Editar Adicional' : 'Novo Adicional'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={newAdicional.name}
                onChange={(e) => setNewAdicional({ ...newAdicional, name: e.target.value })}
                placeholder="Ex: Ovo, Queijo, Mel"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={newAdicional.price}
                onChange={(e) => setNewAdicional({ ...newAdicional, price: e.target.value })}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAdicionalDialog(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSaveAdicional}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={showMenuDialog} onOpenChange={setShowMenuDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-brand-600" />
              {editingMenuItem ? 'Editar Item' : 'Novo Item do Cardápio'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={newMenuItem.name}
                onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                placeholder="Ex: Açaí com Banana"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={newMenuItem.description}
                onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                placeholder="Descrição breve"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newMenuItem.price}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={newMenuItem.category} onValueChange={(v) => setNewMenuItem({ ...newMenuItem, category: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doces">Doces</SelectItem>
                    <SelectItem value="salgados">Salgados</SelectItem>
                    <SelectItem value="bebidas">Bebidas</SelectItem>
                    <SelectItem value="sucos">Sucos</SelectItem>
                    <SelectItem value="acai">Açaí</SelectItem>
                    <SelectItem value="cafes">Cafés</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowMenuDialog(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 bg-brand-600 hover:bg-brand-700" onClick={handleSaveMenuItem}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prazo Customer Dialog */}
      <Dialog open={showPrazoCustomerDialog} onOpenChange={setShowPrazoCustomerDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-600" />
              Cadastrar Cliente Prazo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <Input
                value={newPrazoCustomer.name}
                onChange={(e) => setNewPrazoCustomer({ ...newPrazoCustomer, name: e.target.value })}
                placeholder="Nome completo"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Telefone (opcional)</Label>
              <Input
                value={newPrazoCustomer.phone}
                onChange={(e) => setNewPrazoCustomer({ ...newPrazoCustomer, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Input
                value={newPrazoCustomer.notes}
                onChange={(e) => setNewPrazoCustomer({ ...newPrazoCustomer, notes: e.target.value })}
                placeholder="Ex: Academia, Personal"
                className="h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowPrazoCustomerDialog(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleSavePrazoCustomer}>
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
