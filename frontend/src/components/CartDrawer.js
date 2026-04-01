import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';
import { Minus, Plus, Trash2, ShoppingBag, Pencil, Check } from 'lucide-react';

export const CartDrawer = ({ onCheckout }) => {
  const { items, isOpen, setIsOpen, total, updateQuantity, removeItem, itemCount, setCustomTotal, customTotal } = useCart();
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [editedTotal, setEditedTotal] = useState('');

  // Reset edited total when cart changes
  useEffect(() => {
    if (!isEditingTotal) {
      setEditedTotal(total.toFixed(2));
    }
  }, [total, isEditingTotal]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleEditTotal = () => {
    setEditedTotal((customTotal || total).toFixed(2));
    setIsEditingTotal(true);
  };

  const handleSaveTotal = () => {
    const newTotal = parseFloat(editedTotal);
    if (!isNaN(newTotal) && newTotal >= 0) {
      setCustomTotal(newTotal);
    }
    setIsEditingTotal(false);
  };

  const handleCancelEdit = () => {
    setIsEditingTotal(false);
    setEditedTotal(total.toFixed(2));
  };

  const displayTotal = customTotal !== null ? customTotal : total;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-brand-600" />
            Seu Pedido
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">Seu carrinho está vazio</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione itens do cardápio</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {items.map((item, index) => (
                  <div 
                    key={item.menu_item_id} 
                    className="flex items-center gap-4 p-3 bg-secondary/50 rounded-xl animate-slideIn"
                    style={{ animationDelay: `${index * 50}ms` }}
                    data-testid={`cart-item-${item.menu_item_id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-sm text-brand-600 font-semibold">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                        data-testid={`decrease-${item.menu_item_id}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                        data-testid={`increase-${item.menu_item_id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.menu_item_id)}
                        data-testid={`remove-${item.menu_item_id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="border-t pt-4 mt-4">
              <div className="w-full space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-muted-foreground">
                    {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                  </span>
                  
                  {isEditingTotal ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedTotal}
                        onChange={(e) => setEditedTotal(e.target.value)}
                        className="w-24 h-10 text-lg font-bold text-right"
                        autoFocus
                        data-testid="edit-total-input"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={handleSaveTotal}
                      >
                        <Check className="h-5 w-5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${customTotal !== null && customTotal !== total ? 'text-amber-600' : 'text-foreground'}`}>
                        {formatPrice(displayTotal)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-brand-600"
                        onClick={handleEditTotal}
                        title="Editar valor total"
                        data-testid="edit-total-btn"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {customTotal !== null && customTotal !== total && (
                  <p className="text-xs text-amber-600 text-right">
                    Valor original: {formatPrice(total)} | Desconto: {formatPrice(total - customTotal)}
                  </p>
                )}
                
                <Button 
                  className="w-full h-14 text-lg font-semibold bg-brand-600 hover:bg-brand-700"
                  onClick={onCheckout}
                  data-testid="checkout-button"
                >
                  Finalizar Pedido
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
