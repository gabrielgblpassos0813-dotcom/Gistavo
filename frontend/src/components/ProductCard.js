import React from 'react';
import { Button } from '../components/ui/button';
import { Plus, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';

export const ProductCard = ({ item }) => {
  const { addItem } = useCart();

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleAddToCart = () => {
    addItem(item);
  };

  return (
    <div 
      className="bg-white rounded-xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 group"
      data-testid={`product-card-${item.id}`}
    >
      <div className="aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
          {item.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[40px]">
          {item.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-brand-600">
              {formatPrice(item.price)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>~{item.prep_time} min</span>
            </div>
          </div>
          
          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-brand-600 hover:bg-brand-700 shadow-md"
            onClick={handleAddToCart}
            data-testid={`add-to-cart-${item.id}`}
            aria-label={`Adicionar ${item.name} ao carrinho`}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
