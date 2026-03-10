import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductCard } from '../components/ProductCard';
import { CategoryNav } from '../components/CategoryNav';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutModal } from '../components/CheckoutModal';
import { ProductModal } from '../components/ProductModal';
import { useCart } from '../context/CartContext';
import { ShoppingBag, Clock, Leaf, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

// Categories to show (excluding Adicionais)
const DISPLAY_CATEGORIES = [
  "Omeletes, Tapiocas e Crepiocas",
  "Brunchs",
  "Toasts",
  "Shakes Proteicos",
  "Açaí",
  "Sucos e Vitaminas",
  "Saladas",
  "Bebidas Quentes",
  "Bebidas Geladas",
  "Suplementos"
];

export const MenuPage = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const { setIsOpen, itemCount, items, total, clearCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API}/menu`);
      // Filter out "Adicionais" from items
      const filteredItems = response.data.items.filter(item => item.category !== 'Adicionais');
      setMenuItems(filteredItems);
      // Filter categories to exclude "Adicionais"
      const filteredCategories = response.data.categories.filter(cat => DISPLAY_CATEGORIES.includes(cat));
      setCategories(filteredCategories);
      if (filteredCategories.length > 0) {
        setActiveCategory(filteredCategories[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar cardápio:', error);
      toast.error('Erro ao carregar cardápio');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items based on search or category
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

  const handleSubmitOrder = async (customerName) => {
    setIsSubmitting(true);
    try {
      const orderData = {
        customer_name: customerName,
        items: items,
        total: total
      };

      const response = await axios.post(`${API}/orders`, orderData);
      
      clearCart();
      setShowCheckout(false);
      toast.success('Pedido enviado com sucesso!');
      
      navigate(`/pedido/${response.data.id}`);
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Erro ao enviar pedido. Tente novamente.');
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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={LOGO_URL} 
              alt="GANOH Café Bistrô" 
              className="h-12 w-auto"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Search Button/Input */}
            {isSearching ? (
              <div className="flex items-center gap-2 animate-slideIn">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar item..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-9 pr-4 h-11 w-48 md:w-64 rounded-full border-brand-200 focus:border-brand-500"
                    autoFocus
                    data-testid="search-input"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  onClick={handleSearchToggle}
                  data-testid="close-search-button"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full border-brand-200 hover:bg-brand-50"
                onClick={handleSearchToggle}
                data-testid="search-button"
              >
                <Search className="h-5 w-5 text-brand-600" />
              </Button>
            )}
            
            {/* Cart Button */}
            <Button
              variant="outline"
              className="relative h-11 px-4 rounded-full border-brand-200 hover:bg-brand-50"
              onClick={() => setIsOpen(true)}
              data-testid="cart-button"
            >
              <ShoppingBag className="h-5 w-5 text-brand-600" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 h-6 w-6 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-brand-50 to-background py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-brand-600 mb-2">
            <Leaf className="h-5 w-5" />
            <span className="text-sm font-medium">Café & Bistrô</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            Bem-vindo ao GANOH
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Escolha seus itens favoritos e faça seu pedido
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Tempo estimado: ~15 minutos</span>
          </div>
        </div>
      </section>

      {/* Search Results or Category Navigation */}
      {searchQuery.trim() ? (
        <div className="bg-white/95 backdrop-blur-sm border-b border-border/30 py-4 px-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-muted-foreground">
              {displayedItems.length} resultado{displayedItems.length !== 1 ? 's' : ''} para "{searchQuery}"
            </p>
          </div>
        </div>
      ) : (
        <div className="sticky top-[73px] z-40 bg-white/95 backdrop-blur-sm border-b border-border/30 py-3 px-4">
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
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!searchQuery.trim() && (
          <h2 className="font-heading text-2xl font-semibold mb-6 text-foreground">
            {activeCategory}
          </h2>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedItems.map((item, index) => (
            <div 
              key={item.id} 
              className="animate-slideIn"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ProductCard 
                item={item} 
                onClick={() => handleProductClick(item)}
              />
            </div>
          ))}
        </div>

        {displayedItems.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery.trim() 
                ? `Nenhum item encontrado para "${searchQuery}"`
                : 'Nenhum item disponível nesta categoria'
              }
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-secondary/50 border-t border-border/50 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            GANOH Café Bistrô • Cardápio Digital
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            WhatsApp: (11) 99638-5796 • @ganohcafe_
          </p>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer onCheckout={handleCheckout} />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSubmit={handleSubmitOrder}
        isLoading={isSubmitting}
      />

      {/* Product Modal with Adicionais */}
      <ProductModal
        item={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
