import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, 
  Package, AlertTriangle, RefreshCw, LogOut, Home, Store,
  CreditCard, Banknote, Smartphone
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

export const GestorPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  useEffect(() => {
    const auth = localStorage.getItem('gestor_auth');
    if (auth) {
      setIsAuthenticated(true);
      fetchDashboard();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('gestor_auth');
    setIsAuthenticated(false);
    setDashboard(null);
  };

  const formatPrice = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);

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
            <div>
              <Input
                type="text"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="gestor-username"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="gestor-password"
              />
            </div>
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
            <img src={LOGO_URL} alt="GANOH" className="h-8" />
            <div>
              <h1 className="font-heading text-lg font-bold">Painel do Gestor</h1>
              <p className="text-xs text-muted-foreground">Visão Geral</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); fetchDashboard(true); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Combined Stats */}
        {dashboard && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hoje (Total)</p>
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
                      <p className="text-xs text-muted-foreground">Mês (Total)</p>
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
                        <p className="text-xs text-muted-foreground mb-1">Vendas Hoje</p>
                        <p className="text-xl font-bold text-brand-600">{formatPrice(storeData.today.total)}</p>
                        <p className="text-xs text-muted-foreground">{storeData.today.order_count} pedidos</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">Vendas Mês</p>
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
                            <Button variant="link" className="h-auto p-0 text-red-600" onClick={() => navigate(`/${storeKey}/estoque`)}>
                              Ver estoque →
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Payment Breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Pagamentos de Hoje</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <Smartphone className="h-4 w-4 mx-auto mb-1 text-brand-600" />
                          <p className="text-xs text-muted-foreground">PIX</p>
                          <p className="font-semibold text-sm">{formatPrice(storeData.today.by_payment_method.pix)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <CreditCard className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                          <p className="text-xs text-muted-foreground">Débito</p>
                          <p className="font-semibold text-sm">{formatPrice(storeData.today.by_payment_method.debit)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <CreditCard className="h-4 w-4 mx-auto mb-1 text-purple-600" />
                          <p className="text-xs text-muted-foreground">Crédito</p>
                          <p className="font-semibold text-sm">{formatPrice(storeData.today.by_payment_method.credit)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <Banknote className="h-4 w-4 mx-auto mb-1 text-green-600" />
                          <p className="text-xs text-muted-foreground">Dinheiro</p>
                          <p className="font-semibold text-sm">{formatPrice(storeData.today.by_payment_method.cash)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top and Low Products */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-brand-600" />
                          Mais Vendidos (Mês)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {storeData.top_products.map((product, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                                <span className="font-medium truncate max-w-[150px]">{product.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold">{product.count}x</span>
                                <span className="text-xs text-muted-foreground ml-2">{formatPrice(product.revenue)}</span>
                              </div>
                            </div>
                          ))}
                          {storeData.top_products.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          Menos Vendidos (Mês)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {storeData.low_products.map((product, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                              <span className="font-medium truncate max-w-[180px]">{product.name}</span>
                              <span className="text-muted-foreground">{product.count}x</span>
                            </div>
                          ))}
                          {storeData.low_products.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
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
                    <Button variant="outline" onClick={() => navigate(`/${storeKey}/estoque`)}>
                      <Package className="h-4 w-4 mr-2" /> Gerenciar Estoque
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};
