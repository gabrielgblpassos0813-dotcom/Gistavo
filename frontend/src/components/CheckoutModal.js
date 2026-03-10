import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useCart } from '../context/CartContext';
import { User, ShoppingBag } from 'lucide-react';

export const CheckoutModal = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [customerName, setCustomerName] = useState('');
  const { items, total, itemCount } = useCart();

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (customerName.trim()) {
      onSubmit(customerName.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-brand-600" />
            Confirmar Pedido
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens</span>
              <span className="font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-brand-600">{formatPrice(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-name" className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Seu Nome
            </Label>
            <Input
              id="customer-name"
              placeholder="Digite seu nome para chamarmos quando estiver pronto"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-12 text-base"
              autoFocus
              required
              data-testid="customer-name-input"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-brand-600 hover:bg-brand-700"
              disabled={!customerName.trim() || isLoading}
              data-testid="confirm-order-button"
            >
              {isLoading ? 'Enviando...' : 'Confirmar Pedido'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={onClose}
            >
              Voltar ao Carrinho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
