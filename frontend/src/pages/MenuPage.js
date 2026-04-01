import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductCard } from '../components/ProductCard';
import { CategoryNav } from '../components/CategoryNav';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutModal } from '../components/CheckoutModal';
import { ProductModal } from '../components/ProductModal';
import { useCart } from '../context/CartContext';
import { ShoppingBag, Clock, Search, X, MapPin, WifiOff, RefreshCw } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { 
  isOnline, saveOrderOffline, syncOfflineOrders, 
  cacheMenuData, getCachedMenu, setupOfflineListener, getPendingOrdersCount 
} from '../utils/offline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STORE_NAMES = {
  'runner': 'Runner',
  'gym-londres': 'GYM Londres'
};

export const MenuPage = () => {
  const { store } = useParams();
  const navigate = useNavigate();
  
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [adicionais, setAdicionais] = useState([]);
  const [milkOptions, setMilkOptions] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [offline, setOffline] = useState(!isOnline());
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { setIsOpen, itemCount, items, total, clearCart } = useCart();

  // Sync offline orders when back online
  const handleSync = useCallback(async () => {
    if (!isOnline()) return;
    
    const pending = getPendingOrdersCount();
    if (pending === 0) return;
    
    setIsSyncing(true);
    try {
      const result = await syncOfflineOrders(BACKEND_URL);
      if (result.synced > 0) {
        toast.success(`${result.synced} pedido(s) sincronizado(s)!`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} pedido(s) falharam ao sincronizar`);
      }
      setPendingSync(getPendingOrdersCount());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (store && ['runner', 'gym-londres'].includes(store)) {
      fetchMenu();
    } else {
      navigate('/');
    }
    
    // Setup offline listener
    const cleanup = setupOfflineListener(
      () => {
        setOffline(false);
        toast.success('Conexão restaurada!');
        handleSync();
      },
      () => {
        setOffline(true);
        toast.warning('Você está offline. Pedidos serão salvos localmente.');
      }
    );
    
    // Check pending orders on mount
    setPendingSync(getPendingOrdersCount());
    
    return cleanup;
  }, [store, handleSync]);

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API}/menu/${store}`);
      // Filter only available items (in stock)
      const availableItems = response.data.items.filter(item => item.available);
      setMenuItems(availableItems);
      setCategories(response.data.categories);
      setAdicionais(response.data.adicionais || []);
      setMilkOptions(response.data.milk_options || []);
      setStoreInfo(response.data.store);
      if (response.data.categories.length > 0) {
        setActiveCategory(response.data.categories[0]);
      }
      // Cache menu data for offline use
      cacheMenuData(store, response.data);
    } catch (error) {
      console.error('Erro ao carregar cardápio:', error);
      // Try to load from cache if offline
      const cachedMenu = getCachedMenu(store);
      if (cachedMenu) {
        const availableItems = cachedMenu.items.filter(item => item.available);
        setMenuItems(availableItems);
        setCategories(cachedMenu.categories);
        setAdicionais(cachedMenu.adicionais || []);
        setStoreInfo(cachedMenu.store);
        if (cachedMenu.categories.length > 0) {
          setActiveCategory(cachedMenu.categories[0]);
        }
        toast.info('Usando cardápio em cache (modo offline)');
      } else {
        toast.error('Erro ao carregar cardápio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayedItems = () => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return menuItems.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    return menuItems.filter(item => item.category === activeCategory);
  };

  const displayedItems = getDisplayedItems();

  const handleCheckout = () => {
    setIsOpen(false);
    setShowCheckout(true);
  };

  const handleSubmitOrder = async (customerName, pickupTime, paymentMethod, pixProof = null, customTotal = null) => {
    setIsSubmitting(true);
    // Use the custom total if provided, otherwise use the calculated total
    const orderTotal = customTotal !== null ? customTotal : total;
    
    try {
      const orderData = {
        store: store,
        customer_name: customerName,
        items: items,
        total: orderTotal,
        original_total: total, // Keep track of original total
        payment_method: paymentMethod,
        pickup_time: pickupTime,
        pix_proof: pixProof
      };

      if (offline || !isOnline()) {
        // Save order offline
        const offlineOrder = saveOrderOffline(orderData);
        clearCart();
        setShowCheckout(false);
        setPendingSync(getPendingOrdersCount());
        toast.success('Pedido salvo localmente! Será sincronizado quando a conexão voltar.');
        navigate(`/${store}/pedido/offline?name=${encodeURIComponent(customerName)}`);
        return;
      }

      const response = await axios.post(`${API}/orders`, orderData);
      
      clearCart();
      setShowCheckout(false);
      
      if (paymentMethod === 'pix') {
        toast.success('Pedido enviado! Aguarde a aprovação do pagamento.');
      } else {
        toast.success('Pedido enviado com sucesso!');
      }
      
      navigate(`/${store}/pedido/${response.data.id}`);
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      // If network error, save offline
      if (!error.response) {
        const offlineOrder = saveOrderOffline({
          store: store,
          customer_name: customerName,
          items: items,
          total: orderTotal,
          original_total: total,
          payment_method: paymentMethod,
          pickup_time: pickupTime,
          pix_proof: pixProof
        });
        clearCart();
        setShowCheckout(false);
        setOffline(true);
        setPendingSync(getPendingOrdersCount());
        toast.warning('Sem conexão. Pedido salvo localmente.');
        navigate(`/${store}/pedido/offline?name=${encodeURIComponent(customerName)}`);
        return;
      }
      const message = error.response?.data?.detail || 'Erro ao enviar pedido. Tente novamente.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProductClick = (item) => {
    setSelectedProduct(item);
  };

  const handleSearchToggle = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="menu-page">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/50">
        {/* Offline Banner */}
        {offline && (
          <div className="bg-amber-500 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2">
            <WifiOff className="h-3 w-3" />
            <span>Modo offline - pedidos serão sincronizados quando a conexão voltar</span>
          </div>
        )}
        {/* Pending Sync Banner */}
        {!offline && pendingSync > 0 && (
          <div className="bg-brand-600 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2">
            <span>{pendingSync} pedido(s) pendente(s)</span>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-white hover:bg-white/20"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="GANOH Café Bistrô" className="h-10 w-auto" />
          </div>
          
          <div className="flex items-center gap-2">
            {isSearching ? (
              <div className="flex items-center gap-2 animate-slideIn">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 w-40 md:w-56 rounded-full"
                    autoFocus
                    data-testid="search-input"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={handleSearchToggle}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="icon" className="rounded-full" onClick={handleSearchToggle} data-testid="search-button">
                <Search className="h-5 w-5 text-brand-600" />
              </Button>
            )}
            
            <Button
              variant="outline"
              className="relative h-10 px-4 rounded-full"
              onClick={() => setIsOpen(true)}
              data-testid="cart-button"
            >
              <ShoppingBag className="h-5 w-5 text-brand-600" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-brand-50 to-background py-6 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-brand-600 mb-2">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium">{STORE_NAMES[store] || store}</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-1">
            GANOH Café Bistrô
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Tempo estimado: ~15 minutos</span>
          </div>
        </div>
      </section>

      {/* Search Results or Category Navigation */}
      {searchQuery.trim() ? (
        <div className="bg-white/95 backdrop-blur-sm border-b border-border/30 py-3 px-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-muted-foreground text-sm">
              {displayedItems.length} resultado{displayedItems.length !== 1 ? 's' : ''} para "{searchQuery}"
            </p>
          </div>
        </div>
      ) : (
        <div className="sticky top-[65px] z-40 bg-white/95 backdrop-blur-sm border-b border-border/30 py-3 px-4">
          <div className="max-w-7xl mx-auto">
            <CategoryNav
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>
        </div>
      )}

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!searchQuery.trim() && (
          <h2 className="font-heading text-xl font-semibold mb-4 text-foreground">
            {activeCategory}
          </h2>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedItems.map((item, index) => (
            <div key={item.id} className="animate-slideIn" style={{ animationDelay: `${index * 30}ms` }}>
              <ProductCard item={item} onClick={() => handleProductClick(item)} />
            </div>
          ))}
        </div>

        {displayedItems.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery.trim() ? `Nenhum item encontrado` : 'Nenhum item disponível'}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-secondary/50 border-t border-border/50 py-4 px-4 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            GANOH Café Bistrô • {STORE_NAMES[store]}
          </p>
        </div>
      </footer>

      <CartDrawer onCheckout={handleCheckout} />
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSubmit={handleSubmitOrder}
        isLoading={isSubmitting}
        store={store}
      />
      <ProductModal
        item={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        adicionais={adicionais}
        milkOptions={milkOptions}
      />
    </div>
  );
};
