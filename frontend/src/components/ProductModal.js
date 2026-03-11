import React, { useState } from 'react';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { useCart } from '../context/CartContext';
import { Plus, Minus, Clock, X } from 'lucide-react';

// Categorias que NÃO mostram adicionais
const CATEGORIES_WITHOUT_ADICIONAIS = [
  "Bebidas Quentes",
  "Bebidas Geladas",
  "Suplementos"
];

export const ProductModal = ({ item, isOpen, onClose, adicionais = [] }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedAdicionais, setSelectedAdicionais] = useState([]);

  if (!item) return null;

  const showAdicionais = !CATEGORIES_WITHOUT_ADICIONAIS.includes(item.category);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleAdicionalToggle = (adicional) => {
    setSelectedAdicionais(prev => {
      const exists = prev.find(a => a.id === adicional.id);
      if (exists) {
        return prev.filter(a => a.id !== adicional.id);
      }
      return [...prev, adicional];
    });
  };

  const adicionaisTotal = selectedAdicionais.reduce((sum, a) => sum + a.price, 0);
  const itemTotal = (item.price + adicionaisTotal) * quantity;

  const handleAddToCart = () => {
    const itemWithAdicionais = {
      ...item,
      name: selectedAdicionais.length > 0 
        ? `${item.name} + ${selectedAdicionais.map(a => a.name).join(', ')}`
        : item.name,
      price: item.price + adicionaisTotal
    };
    
    for (let i = 0; i < quantity; i++) {
      addItem(itemWithAdicionais);
    }
    
    setQuantity(1);
    setSelectedAdicionais([]);
    onClose();
  };

  const handleClose = () => {
    setQuantity(1);
    setSelectedAdicionais([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {item.name}
          </h2>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            data-testid="close-modal"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-5">
          {/* Product Info */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-3">
              {item.description}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-brand-600">
                {formatPrice(item.price)}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                <span>~{item.prep_time} min</span>
              </div>
            </div>
          </div>

          {/* Adicionais Section - Only for applicable categories */}
          {showAdicionais && adicionais.length > 0 && (
            <div className="border-t border-border pt-4 mb-4">
              <h3 className="font-semibold text-foreground mb-3 text-sm">
                Adicionais
                <span className="font-normal text-muted-foreground ml-1">
                  (opcional)
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {adicionais.map((adicional) => {
                  const isSelected = selectedAdicionais.some(a => a.id === adicional.id);
                  return (
                    <label
                      key={adicional.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                        isSelected 
                          ? 'border-brand-500 bg-brand-50' 
                          : 'border-border hover:border-brand-200'
                      }`}
                      data-testid={`adicional-${adicional.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleAdicionalToggle(adicional)}
                          className="h-4 w-4 data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600"
                        />
                        <span className="font-medium text-foreground">{adicional.name}</span>
                      </div>
                      <span className="text-brand-600 font-semibold text-xs">
                        +{formatPrice(adicional.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity and Add to Cart */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Quantidade</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  data-testid="decrease-quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center text-lg font-semibold">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity(quantity + 1)}
                  data-testid="increase-quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button 
              className="w-full h-12 text-base font-semibold bg-brand-600 hover:bg-brand-700 rounded-xl"
              onClick={handleAddToCart}
              data-testid="add-to-cart-modal"
            >
              Adicionar • {formatPrice(itemTotal)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
