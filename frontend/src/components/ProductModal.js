import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { useCart } from '../context/CartContext';
import { Plus, Minus, Clock } from 'lucide-react';

const ADICIONAIS = [
  { id: "72", name: "Ovos", price: 3.50 },
  { id: "73", name: "Atum", price: 7.00 },
  { id: "74", name: "Queijo Branco", price: 8.00 },
  { id: "75", name: "Mussarela", price: 3.00 },
  { id: "76", name: "Frango", price: 7.00 },
  { id: "77", name: "Mel", price: 3.50 },
  { id: "78", name: "Granola", price: 3.50 },
  { id: "79", name: "Nutella", price: 5.00 },
];

export const ProductModal = ({ item, isOpen, onClose }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedAdicionais, setSelectedAdicionais] = useState([]);

  if (!item) return null;

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
    // Add main item
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
    
    // Reset and close
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Product Image */}
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-secondary -mt-2">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>

        <DialogHeader className="text-left">
          <DialogTitle className="font-heading text-2xl">{item.name}</DialogTitle>
          <p className="text-muted-foreground">{item.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-2xl font-bold text-brand-600">
              {formatPrice(item.price)}
            </span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>~{item.prep_time} min</span>
            </div>
          </div>
        </DialogHeader>

        {/* Adicionais Section */}
        <div className="border-t border-border pt-4">
          <h3 className="font-semibold text-foreground mb-3">
            Adicionais
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (opcional)
            </span>
          </h3>
          <div className="space-y-3">
            {ADICIONAIS.map((adicional) => {
              const isSelected = selectedAdicionais.some(a => a.id === adicional.id);
              return (
                <label
                  key={adicional.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-brand-500 bg-brand-50' 
                      : 'border-border hover:border-brand-200 hover:bg-secondary/50'
                  }`}
                  data-testid={`adicional-${adicional.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleAdicionalToggle(adicional)}
                      className="data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600"
                    />
                    <span className="font-medium text-foreground">{adicional.name}</span>
                  </div>
                  <span className="text-brand-600 font-semibold">
                    +{formatPrice(adicional.price)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Quantity and Add to Cart */}
        <DialogFooter className="flex-col sm:flex-col gap-4 border-t border-border pt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-muted-foreground">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                data-testid="decrease-quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-lg font-semibold">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setQuantity(quantity + 1)}
                data-testid="increase-quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-semibold bg-brand-600 hover:bg-brand-700"
            onClick={handleAddToCart}
            data-testid="add-to-cart-modal"
          >
            Adicionar • {formatPrice(itemTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
