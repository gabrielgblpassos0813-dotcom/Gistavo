import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useCart } from '../context/CartContext';
import { User, ShoppingBag, Clock } from 'lucide-react';

export const CheckoutModal = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [customerName, setCustomerName] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const { items, total, itemCount } = useCart();

  // Generate time slots from now until closing (22:00)
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Start from next 15-minute slot (minimum 15 min from now)
    let startMinute = Math.ceil((currentMinute + 15) / 15) * 15;
    let startHour = currentHour;
    
    if (startMinute >= 60) {
      startMinute = startMinute - 60;
      startHour += 1;
    }
    
    // Generate slots until 22:00
    for (let hour = startHour; hour <= 22; hour++) {
      const minuteStart = hour === startHour ? startMinute : 0;
      for (let minute = minuteStart; minute < 60; minute += 15) {
        if (hour === 22 && minute > 0) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    
    return slots;
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (customerName.trim() && pickupTime) {
      onSubmit(customerName.trim(), pickupTime);
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Order Summary */}
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

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customer-name" className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Seu Nome
            </Label>
            <Input
              id="customer-name"
              placeholder="Digite seu nome"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-12 text-base"
              required
              data-testid="customer-name-input"
            />
          </div>

          {/* Pickup Time */}
          <div className="space-y-2">
            <Label htmlFor="pickup-time" className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Horário para Retirada
            </Label>
            <Select value={pickupTime} onValueChange={setPickupTime} required>
              <SelectTrigger className="h-12 text-base" data-testid="pickup-time-select">
                <SelectValue placeholder="Selecione o horário" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Escolha o horário que deseja buscar seu pedido
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-brand-600 hover:bg-brand-700"
              disabled={!customerName.trim() || !pickupTime || isLoading}
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
