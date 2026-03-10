import React from 'react';
import { Button } from '../components/ui/button';
import { Plus, Clock } from 'lucide-react';

export const ProductCard = ({ item, onClick }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div 
      className="bg-white rounded-xl border border-border/50 p-4 hover:shadow-md hover:border-brand-200 transition-all duration-200 cursor-pointer group"
      data-testid={`product-card-${item.id}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1 group-hover:text-brand-700 transition-colors">
            {item.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {item.description}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-brand-600">
              {formatPrice(item.price)}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>~{item.prep_time} min</span>
            </div>
          </div>
        </div>
        
        <Button
          size="icon"
          className="h-9 w-9 rounded-full bg-brand-600 hover:bg-brand-700 shadow-sm shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          data-testid={`add-to-cart-${item.id}`}
          aria-label={`Adicionar ${item.name} ao carrinho`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
