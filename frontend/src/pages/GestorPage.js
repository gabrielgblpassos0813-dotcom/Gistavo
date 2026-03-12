import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  BarChart3, TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  AlertTriangle, RefreshCw, LogOut, Home, Store,
  ChevronRight, Trash2, Plus, Pencil, UtensilsCrossed, CalendarClock, UserPlus, Receipt, Camera, Upload, Loader2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const formatPrice = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);

// Products List Dialog
const ProductsDialog = ({ isOpen, onClose, title, products, type }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'top' ? <TrendingUp className="h-5 w-5 text-brand-600" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-4">
            {products.map((product, idx) => (
              <div 
                key={idx} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  type === 'top' ? 'bg-brand-50/50 border-brand-100' : 'bg-red-50/50 border-red-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    type === 'top' ? 'bg-brand-600 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.count} vendidos</p>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Sem dados disponíveis</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export const GestorPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [productsDialog, setProductsDialog] = useState({ open: false, title: '', products: [], type: 'top' });
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'Lanches', store: 'runner', image_url: '' });
  const [activeMainTab, setActiveMainTab] = useState('dashboard');
  const [prazoCustomers, setPrazoCustomers] = useState([]);
  const [prazoDebts, setPrazoDebts] = useState({ debts: [], total_prazo: 0 });
  const [showPrazoDialog, setShowPrazoDialog] = useState(false);
  const [newPrazoCustomer, setNewPrazoCustomer] = useState({ name: '', phone: '', notes: '' });
  
  // Expenses (Gastos) state
  const [expenses, setExpenses] = useState([]);
  const [expensesChartData, setExpensesChartData] = useState(null);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'outros', store: 'all', notes: '' });
  const [expenseImage, setExpenseImage] = useState(null);
  const [expenseImagePreview, setExpenseImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedExpense, setAnalyzedExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const EXPENSE_CATEGORIES = ['contador', 'fornecedor', 'mercado', 'suplementos', 'VT', 'Vivo', 'sistema', 'salário', 'outros'];
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/gestor/dashboard`, {
        auth: { username, password }
      });
      setDashboard(response.data);
      setIsAuthenticated(true);
      localStorage.setItem('gestor_auth', btoa(`${username}:${password}`));
      
      // Fetch chart, menu, and prazo data after successful login
      setTimeout(() => {
        fetchChartData();
        fetchMenuItems();
        fetchPrazoData();
        fetchExpenses();
      }, 500);
    } catch (error) {
      toast.error('Credenciais inválidas');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboard = async (showToast = false) => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    try {
      const [user, pass] = atob(auth).split(':');
      const response = await axios.get(`${API}/gestor/dashboard`, {
        auth: { username: user, password: pass }
      });
      setDashboard(response.data);
      if (showToast) toast.success('Dados atualizados');
    } catch (error) {
      localStorage.removeItem('gestor_auth');
      setIsAuthenticated(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchChartData = async () => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    try {
      const [user, pass] = atob(auth).split(':');
      const response = await axios.get(`${API}/gestor/chart/monthly`, {
        auth: { username: user, password: pass }
      });
      setChartData(response.data);
    } catch (error) {
      console.log('Error fetching chart data');
    }
  };

  const fetchMenuItems = async (store = 'runner') => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    try {
      const [user, pass] = atob(auth).split(':');
      const response = await axios.get(`${API}/gestor/menu/${store}`, {
        auth: { username: user, password: pass }
      });
      setMenuItems(response.data.menu);
    } catch (error) {
      console.log('Error fetching menu');
    }
  };

  const handleSaveMenuItem = async () => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      if (editingItem) {
        await axios.put(`${API}/gestor/menu/${editingItem.id}`, {
          name: newItem.name,
          description: newItem.description,
          price: parseFloat(newItem.price),
          category: newItem.category,
          image_url: newItem.image_url
        }, { auth: { username: user, password: pass } });
        toast.success('Item atualizado!');
      } else {
        await axios.post(`${API}/gestor/menu`, {
          ...newItem,
          price: parseFloat(newItem.price)
        }, { auth: { username: user, password: pass } });
        toast.success('Item adicionado!');
      }
      setShowMenuDialog(false);
      setEditingItem(null);
      setNewItem({ name: '', description: '', price: '', category: 'Lanches', store: 'runner', image_url: '' });
      fetchMenuItems(newItem.store);
    } catch (error) {
      toast.error('Erro ao salvar item');
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      await axios.delete(`${API}/gestor/menu/${itemId}`, {
        auth: { username: user, password: pass }
      });
      toast.success('Item removido!');
      fetchMenuItems(newItem.store);
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };

  const fetchPrazoData = async () => {
    try {
      const [customersRes, debtsRes] = await Promise.all([
        axios.get(`${API}/prazo/customers`),
        axios.get(`${API}/prazo/debts`)
      ]);
      setPrazoCustomers(customersRes.data.customers || []);
      setPrazoDebts(debtsRes.data);
    } catch (error) {
      console.log('Error fetching prazo data');
    }
  };

  const handleAddPrazoCustomer = async () => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth || !newPrazoCustomer.name) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      await axios.post(`${API}/prazo/customers`, newPrazoCustomer, {
        auth: { username: user, password: pass }
      });
      toast.success('Cliente cadastrado!');
      setShowPrazoDialog(false);
      setNewPrazoCustomer({ name: '', phone: '', notes: '' });
      fetchPrazoData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao cadastrar');
    }
  };

  const handleDeletePrazoCustomer = async (customerId) => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      await axios.delete(`${API}/prazo/customers/${customerId}`, {
        auth: { username: user, password: pass }
      });
      toast.success('Cliente removido!');
      fetchPrazoData();
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  // ==================== EXPENSES (GASTOS) FUNCTIONS ====================
  const fetchExpenses = async () => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      const [expensesRes, chartRes] = await Promise.all([
        axios.get(`${API}/expenses`, { auth: { username: user, password: pass } }),
        axios.get(`${API}/gestor/chart/monthly-with-expenses`, { auth: { username: user, password: pass } })
      ]);
      setExpenses(expensesRes.data.expenses || []);
      setExpensesChartData(chartRes.data);
    } catch (error) {
      console.log('Error fetching expenses');
    }
  };

  const compressImage = (file, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleExpenseImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 10MB.');
        return;
      }
      
      toast.loading('Processando imagem...', { id: 'compress' });
      
      try {
        const compressedImage = await compressImage(file);
        setExpenseImage(compressedImage);
        setExpenseImagePreview(compressedImage);
        toast.success('Imagem carregada!', { id: 'compress' });
      } catch (error) {
        toast.error('Erro ao processar imagem', { id: 'compress' });
      }
    }
  };

  const handleAnalyzeExpense = async () => {
    if (!expenseImage) {
      toast.error('Selecione uma imagem primeiro');
      return;
    }
    
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    setIsAnalyzing(true);
    
    try {
      // Remove the data:image/jpeg;base64, prefix
      const base64Data = expenseImage.split(',')[1] || expenseImage;
      
      const response = await axios.post(`${API}/expenses/analyze-image`, {
        image_base64: base64Data
      }, { auth: { username: user, password: pass } });
      
      if (response.data.success && response.data.analysis) {
        const analysis = response.data.analysis;
        setAnalyzedExpense(analysis);
        setNewExpense({
          description: analysis.description || '',
          amount: analysis.amount?.toString() || '',
          category: EXPENSE_CATEGORIES.includes(analysis.category) ? analysis.category : 'outros',
          store: 'all',
          notes: analysis.notes || ''
        });
        toast.success(`Análise concluída! Confiança: ${analysis.confidence || 'média'}`);
      } else {
        toast.error('Não foi possível analisar a imagem');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao analisar imagem');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveExpense = async () => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth || !newExpense.description || !newExpense.amount) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      await axios.post(`${API}/expenses`, {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        image_url: expenseImagePreview || ''
      }, { auth: { username: user, password: pass } });
      
      toast.success('Gasto registrado!');
      setShowExpenseDialog(false);
      setNewExpense({ description: '', amount: '', category: 'outros', store: 'all', notes: '' });
      setExpenseImage(null);
      setExpenseImagePreview(null);
      setAnalyzedExpense(null);
      fetchExpenses();
      fetchChartData();
    } catch (error) {
      toast.error('Erro ao salvar gasto');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const auth = localStorage.getItem('gestor_auth');
    if (!auth) return;
    
    const [user, pass] = atob(auth).split(':');
    
    try {
      await axios.delete(`${API}/expenses/${expenseId}`, {
        auth: { username: user, password: pass }
      });
      toast.success('Gasto removido!');
      fetchExpenses();
      fetchChartData();
    } catch (error) {
      toast.error('Erro ao remover gasto');
    }
  };

  useEffect(() => {
    const auth = localStorage.getItem('gestor_auth');
    if (auth) {
      setIsAuthenticated(true);
      fetchDashboard();
      fetchChartData();
      fetchMenuItems();
      fetchPrazoData();
      fetchExpenses();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('gestor_auth');
    setIsAuthenticated(false);
    setDashboard(null);
  };

  const openProductsDialog = (title, products, type) => {
    setProductsDialog({ open: true, title, products, type });
  };

  // Hidden clear button - requires 5 clicks on logo + password
  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setShowClearDialog(true);
      setClickCount(0);
    }
    // Reset after 3 seconds
    setTimeout(() => setClickCount(0), 3000);
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await axios.post(`${API}/admin/clear-data?password=${clearPassword}`);
      toast.success('Todos os dados foram apagados!');
      setShowClearDialog(false);
      setClearPassword('');
      fetchDashboard(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Senha incorreta');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50 to-background flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <img src={LOGO_URL} alt="GANOH" className="h-16 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold">Painel do Gestor</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito</p>
          </div>
          
          <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <Input type="text" placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required data-testid="gestor-username" />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="gestor-password" />
            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="gestor-page">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={LOGO_URL} 
              alt="GANOH" 
              className="h-8 cursor-pointer select-none" 
              onClick={handleLogoClick}
            />
            <div>
              <h1 className="font-heading text-lg font-bold">Painel do Gestor</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); fetchDashboard(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Main Navigation Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Gráfico
            </TabsTrigger>
            <TabsTrigger value="prazo" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Prazo
            </TabsTrigger>
            <TabsTrigger value="menu" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Cardápio
            </TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard">
        {dashboard && (
          <>
            {/* Combined Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receita Hoje</p>
                      <p className="text-lg font-bold text-brand-600">{formatPrice(dashboard.combined.today_total)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receita Mês</p>
                      <p className="text-lg font-bold text-blue-600">{formatPrice(dashboard.combined.month_total)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pedidos Hoje</p>
                      <p className="text-lg font-bold">{dashboard.combined.today_orders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pedidos Mês</p>
                      <p className="text-lg font-bold">{dashboard.combined.month_orders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Store Tabs */}
            <Tabs defaultValue="runner" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="runner" className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> Runner
                </TabsTrigger>
                <TabsTrigger value="gym-londres" className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> GYM Londres
                </TabsTrigger>
              </TabsList>

              {Object.entries(dashboard.stores).map(([storeKey, storeData]) => (
                <TabsContent key={storeKey} value={storeKey} className="space-y-4">
                  {/* Store Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-brand-50">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">Receita Hoje</p>
                        <p className="text-xl font-bold text-brand-600">{formatPrice(storeData.today.total)}</p>
                        <p className="text-xs text-muted-foreground">{storeData.today.order_count} pedidos</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">Receita Mês</p>
                        <p className="text-xl font-bold text-blue-600">{formatPrice(storeData.month.total)}</p>
                        <p className="text-xs text-muted-foreground">{storeData.month.order_count} pedidos</p>
                      </CardContent>
                    </Card>
                    {storeData.low_stock_alerts > 0 && (
                      <Card className="bg-red-50 col-span-2">
                        <CardContent className="p-3 flex items-center gap-3">
                          <AlertTriangle className="h-6 w-6 text-red-500" />
                          <div>
                            <p className="font-medium text-red-700">{storeData.low_stock_alerts} produtos com estoque baixo</p>
                            <Button variant="link" className="h-auto p-0 text-red-600" onClick={() => navigate(`/${storeKey}/cozinha`)}>
                              Ver na cozinha →
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Top and Low Products - CLICKABLE */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => openProductsDialog(`Mais Vendidos - ${storeData.name}`, storeData.top_products, 'top')}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-brand-600" />
                            Mais Vendidos (Mês)
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {storeData.top_products.slice(0, 3).map((product, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="bg-brand-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>
                                <span className="font-medium truncate max-w-[120px]">{product.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-brand-600">{product.count}x</span>
                              </div>
                            </div>
                          ))}
                          {storeData.top_products.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
                          )}
                          {storeData.top_products.length > 3 && (
                            <p className="text-xs text-brand-600 text-center pt-2">Ver todos ({storeData.top_products.length})</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => openProductsDialog(`Menos Vendidos - ${storeData.name}`, storeData.low_products, 'low')}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            Menos Vendidos (Mês)
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {storeData.low_products.slice(0, 3).map((product, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                              <span className="font-medium truncate max-w-[150px]">{product.name}</span>
                              <span className="text-red-600 font-semibold">{product.count}x</span>
                            </div>
                          ))}
                          {storeData.low_products.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
                          )}
                          {storeData.low_products.length > 3 && (
                            <p className="text-xs text-red-600 text-center pt-2">Ver todos ({storeData.low_products.length})</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(`/${storeKey}/cozinha`)}>
                      Ver Cozinha
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
          </TabsContent>

          {/* CHART TAB */}
          <TabsContent value="chart">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand-600" />
                  Vendas do Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">{chartData.month}</span>
                      <span className="text-lg font-bold text-brand-600">{formatPrice(chartData.total_month)}</span>
                    </div>
                    {/* Simple Bar Chart */}
                    <div className="h-64 flex items-end justify-between gap-1 border-b border-l p-2">
                      {chartData.data.map((day, idx) => {
                        const maxValue = Math.max(...chartData.data.map(d => d.total), 1);
                        const height = (day.total / maxValue) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="flex-1 flex flex-col items-center justify-end group relative"
                          >
                            <div 
                              className="w-full bg-brand-600 rounded-t hover:bg-brand-700 transition-colors cursor-pointer min-h-[2px]"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`Dia ${day.day}: ${formatPrice(day.total)} (${day.count} pedidos)`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                              Dia {day.day}: {formatPrice(day.total)}
                              <br/>{day.count} pedidos
                            </div>
                            <span className="text-[8px] text-muted-foreground mt-1">{day.day}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                      <div className="bg-brand-50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Total do Mês</p>
                        <p className="text-xl font-bold text-brand-600">{formatPrice(chartData.total_month)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Total de Pedidos</p>
                        <p className="text-xl font-bold text-blue-600">{chartData.total_orders}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando dados do gráfico...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRAZO TAB */}
          <TabsContent value="prazo">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Clientes Cadastrados */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-amber-600" />
                      Clientes Prazo
                    </span>
                    <Button 
                      size="sm" 
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => setShowPrazoDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Novo Cliente
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {prazoCustomers.length > 0 ? (
                    <div className="space-y-2">
                      {prazoCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                          <div className="flex-1">
                            <p className="font-medium">{customer.name}</p>
                            {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                            {customer.notes && <p className="text-xs text-muted-foreground italic">{customer.notes}</p>}
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-600"
                            onClick={() => handleDeletePrazoCustomer(customer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>Nenhum cliente cadastrado</p>
                      <p className="text-sm">Clique em "Novo Cliente" para começar</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Débitos Pendentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-amber-600" />
                    Débitos Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Total */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-700">Total a Receber</p>
                    <p className="text-2xl font-bold text-amber-600">{formatPrice(prazoDebts.total_prazo || 0)}</p>
                    <p className="text-xs text-muted-foreground">{prazoDebts.customer_count || 0} cliente(s) com débito</p>
                  </div>

                  {prazoDebts.debts?.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {prazoDebts.debts.map((debt, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-secondary/30 rounded border">
                          <div>
                            <p className="font-medium text-sm">{debt.name}</p>
                            <p className="text-xs text-muted-foreground">{debt.order_count} pedido(s)</p>
                          </div>
                          <span className="font-bold text-amber-600">{formatPrice(debt.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      Nenhum débito pendente
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* MENU TAB */}
          <TabsContent value="menu">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-brand-600" />
                    Gerenciar Cardápio
                  </span>
                  <Button 
                    size="sm" 
                    className="bg-brand-600 hover:bg-brand-700"
                    onClick={() => {
                      setEditingItem(null);
                      setNewItem({ name: '', description: '', price: '', category: 'Lanches', store: 'runner', image_url: '' });
                      setShowMenuDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Store selector for menu */}
                <div className="mb-4">
                  <Select value={newItem.store} onValueChange={(v) => { setNewItem({...newItem, store: v}); fetchMenuItems(v); }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="runner">Runner</SelectItem>
                      <SelectItem value="gym-londres">GYM Londres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {menuItems.length > 0 ? (
                  <div className="space-y-2">
                    {menuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.category} • {formatPrice(item.price)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => {
                              setEditingItem(item);
                              setNewItem({
                                name: item.name,
                                description: item.description || '',
                                price: item.price.toString(),
                                category: item.category,
                                store: item.store,
                                image_url: item.image_url || ''
                              });
                              setShowMenuDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-600"
                            onClick={() => handleDeleteMenuItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Nenhum item no cardápio</p>
                    <p className="text-sm">Clique em "Adicionar Item" para começar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Menu Item Dialog */}
      <Dialog open={showMenuDialog} onOpenChange={setShowMenuDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Item ao Cardápio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input 
                value={newItem.name} 
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                placeholder="Ex: Café Expresso"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input 
                value={newItem.description} 
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                placeholder="Ex: Café forte e encorpado"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço *</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={newItem.price} 
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem({...newItem, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lanches">Lanches</SelectItem>
                    <SelectItem value="Bebidas">Bebidas</SelectItem>
                    <SelectItem value="Sobremesas">Sobremesas</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingItem && (
              <div>
                <Label>Loja *</Label>
                <Select value={newItem.store} onValueChange={(v) => setNewItem({...newItem, store: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="runner">Runner</SelectItem>
                    <SelectItem value="gym-londres">GYM Londres</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>URL da Imagem (opcional)</Label>
              <Input 
                value={newItem.image_url} 
                onChange={(e) => setNewItem({...newItem, image_url: e.target.value})}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMenuDialog(false)}>Cancelar</Button>
            <Button 
              className="bg-brand-600 hover:bg-brand-700" 
              onClick={handleSaveMenuItem}
              disabled={!newItem.name || !newItem.price}
            >
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products Dialog */}
      <ProductsDialog 
        isOpen={productsDialog.open}
        onClose={() => setProductsDialog({ ...productsDialog, open: false })}
        title={productsDialog.title}
        products={productsDialog.products}
        type={productsDialog.type}
      />

      {/* Hidden Clear Data Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Limpar Todos os Dados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta ação irá apagar <strong>todos os pedidos e histórico</strong> de todas as lojas. Esta ação não pode ser desfeita.
            </p>
            <Input
              type="password"
              placeholder="Digite a senha de administrador"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowClearDialog(false); setClearPassword(''); }}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={handleClearData}
                disabled={isClearing || !clearPassword}
              >
                {isClearing ? 'Apagando...' : 'Apagar Tudo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prazo Customer Dialog */}
      <Dialog open={showPrazoDialog} onOpenChange={setShowPrazoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-600" />
              Cadastrar Cliente Prazo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input 
                value={newPrazoCustomer.name} 
                onChange={(e) => setNewPrazoCustomer({...newPrazoCustomer, name: e.target.value})}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label>Telefone (opcional)</Label>
              <Input 
                value={newPrazoCustomer.phone} 
                onChange={(e) => setNewPrazoCustomer({...newPrazoCustomer, phone: e.target.value})}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Input 
                value={newPrazoCustomer.notes} 
                onChange={(e) => setNewPrazoCustomer({...newPrazoCustomer, notes: e.target.value})}
                placeholder="Ex: Paga toda sexta"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowPrazoDialog(false); setNewPrazoCustomer({ name: '', phone: '', notes: '' }); }}>
                Cancelar
              </Button>
              <Button 
                className="flex-1 bg-amber-600 hover:bg-amber-700" 
                onClick={handleAddPrazoCustomer}
                disabled={!newPrazoCustomer.name}
              >
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
