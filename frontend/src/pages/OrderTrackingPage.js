import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { CheckCircle2, Clock, ChefHat, Home, RefreshCw, Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STATUS_CONFIG = {
  received: {
    label: 'Pedido Recebido',
    description: 'Seu pedido foi recebido e está na fila',
    icon: Clock,
    color: 'text-status-pending',
    bgColor: 'bg-gray-100',
    step: 1
  },
  preparing: {
    label: 'Preparando',
    description: 'Nossos chefs estão preparando seu pedido',
    icon: ChefHat,
    color: 'text-status-preparing',
    bgColor: 'bg-amber-50',
    step: 2
  },
  ready: {
    label: 'Pronto!',
    description: 'Seu pedido está pronto para retirada',
    icon: CheckCircle2,
    color: 'text-status-ready',
    bgColor: 'bg-brand-50',
    step: 3
  }
};

export const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrder = async (showToast = false) => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}`);
      setOrder(response.data);
      if (showToast) {
        toast.success('Status atualizado');
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast.error('Erro ao carregar pedido');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    
    // Poll every 10 seconds
    const interval = setInterval(() => fetchOrder(), 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrder(true);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl text-foreground mb-4">Pedido não encontrado</p>
          <Button onClick={() => navigate('/')} className="bg-brand-600 hover:bg-brand-700">
            <Home className="h-4 w-4 mr-2" />
            Voltar ao Cardápio
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`min-h-screen ${statusConfig.bgColor} transition-colors duration-500`} data-testid="order-tracking-page">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <img 
            src={LOGO_URL} 
            alt="GANOH Café Bistrô" 
            className="h-10 w-auto"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full"
            data-testid="refresh-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slideIn">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${statusConfig.bgColor} mb-4`}>
              <StatusIcon className={`h-10 w-10 ${statusConfig.color}`} />
            </div>
            <h1 className={`text-2xl font-bold ${statusConfig.color}`}>
              {statusConfig.label}
            </h1>
            <p className="text-muted-foreground mt-1">
              {statusConfig.description}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {Object.entries(STATUS_CONFIG).map(([key, config], index) => (
              <React.Fragment key={key}>
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    config.step <= statusConfig.step
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-200 text-muted-foreground'
                  }`}
                  data-testid={`status-step-${key}`}
                >
                  {config.step}
                </div>
                {index < Object.keys(STATUS_CONFIG).length - 1 && (
                  <div 
                    className={`h-1 w-12 rounded-full transition-all duration-300 ${
                      config.step < statusConfig.step ? 'bg-brand-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Customer Info */}
          <div className="bg-secondary/50 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="text-lg font-semibold text-foreground" data-testid="customer-name">
                  {order.customer_name}
                </p>
              </div>
              {order.pickup_time && (
                <div>
                  <p className="text-sm text-muted-foreground">Retirada</p>
                  <p className="text-lg font-semibold text-brand-600" data-testid="pickup-time">
                    {order.pickup_time}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Estimated Time */}
          {!order.pickup_time && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Tempo estimado: ~{order.prep_time} min</span>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl shadow-lg p-6 animate-slideIn" style={{ animationDelay: '100ms' }}>
          <h2 className="font-heading text-xl font-semibold mb-4">Detalhes do Pedido</h2>
          
          <div className="space-y-3 mb-4">
            {order.items.map((item, index) => (
              <div 
                key={index} 
                className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                data-testid={`order-item-${index}`}
              >
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                </div>
                <p className="font-semibold text-foreground">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 flex justify-between items-center">
            <span className="text-lg font-semibold text-foreground">Total</span>
            <span className="text-2xl font-bold text-brand-600" data-testid="order-total">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="rounded-full px-6"
            data-testid="back-to-menu-button"
          >
            <Home className="h-4 w-4 mr-2" />
            Fazer Novo Pedido
          </Button>
        </div>
      </main>
    </div>
  );
};
