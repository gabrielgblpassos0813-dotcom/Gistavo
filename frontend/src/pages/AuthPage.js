import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { User, Lock, UserPlus, LogIn, Store, AlertCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

export const AuthPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [accounts, setAccounts] = useState([]);
  const [canCreate, setCanCreate] = useState(true);
  
  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');

  useEffect(() => {
    // Check if already logged in
    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId) {
      navigate('/gestor/dashboard');
    }
    
    // Fetch existing accounts
    fetchAccounts();
  }, [navigate]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API}/auth/accounts`);
      setAccounts(response.data.accounts || []);
      setCanCreate(response.data.can_create);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username: loginUsername,
        password: loginPassword
      });
      
      // Save auth info
      localStorage.setItem('tenant_id', response.data.tenant_id);
      localStorage.setItem('tenant_username', response.data.username);
      localStorage.setItem('tenant_display_name', response.data.display_name);
      localStorage.setItem('gestor_auth', btoa(`${loginUsername}:${loginPassword}`));
      
      toast.success('Login realizado com sucesso!');
      navigate('/gestor/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Credenciais inválidas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!canCreate) {
      toast.error('Limite máximo de contas atingido (2)');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/register`, {
        username: registerUsername,
        password: registerPassword,
        display_name: registerDisplayName || registerUsername
      });
      
      toast.success('Conta criada com sucesso! Faça login para continuar.');
      setActiveTab('login');
      setLoginUsername(registerUsername);
      setLoginPassword('');
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center p-4">
      <Toaster richColors position="top-center" />
      
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <img src={LOGO_URL} alt="GANOH" className="h-16 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-brand-800">
            Painel do Gestor
          </CardTitle>
          <CardDescription>
            Acesse ou crie sua conta para gerenciar o cardápio
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" /> Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2" disabled={!canCreate}>
                <UserPlus className="h-4 w-4" /> Criar Conta
              </TabsTrigger>
            </TabsList>
            
            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Usuário
                  </Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Digite seu usuário"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                    data-testid="login-username"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" /> Senha
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    data-testid="login-password"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-brand-600 hover:bg-brand-700"
                  disabled={isLoading}
                  data-testid="login-submit"
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
              
              {/* Show existing accounts for reference */}
              {accounts.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Store className="h-3 w-3" /> Contas existentes:
                  </p>
                  <div className="space-y-1">
                    {accounts.map((acc, idx) => (
                      <div 
                        key={idx} 
                        className="text-sm p-2 bg-secondary/30 rounded flex items-center justify-between cursor-pointer hover:bg-secondary/50"
                        onClick={() => setLoginUsername(acc.username)}
                      >
                        <span className="font-medium">{acc.display_name || acc.username}</span>
                        <span className="text-xs text-muted-foreground">@{acc.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Register Tab */}
            <TabsContent value="register">
              {!canCreate ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <p className="text-muted-foreground">
                    Limite máximo de 2 contas atingido.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Entre com uma conta existente.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-display" className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" /> Nome da Loja
                    </Label>
                    <Input
                      id="register-display"
                      type="text"
                      placeholder="Ex: Minha Loja"
                      value={registerDisplayName}
                      onChange={(e) => setRegisterDisplayName(e.target.value)}
                      data-testid="register-display"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" /> Usuário
                    </Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Escolha um nome de usuário"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                      data-testid="register-username"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" /> Senha
                    </Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Escolha uma senha"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      minLength={4}
                      data-testid="register-password"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-brand-600 hover:bg-brand-700"
                    disabled={isLoading}
                    data-testid="register-submit"
                  >
                    {isLoading ? 'Criando...' : 'Criar Conta'}
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    {accounts.length}/2 contas criadas
                  </p>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
