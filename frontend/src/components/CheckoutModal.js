import React, { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Switch } from '../components/ui/switch';
import { useCart } from '../context/CartContext';
import { User, ShoppingBag, Clock, CreditCard, Banknote, Smartphone, Receipt, Upload, Camera, Copy, CheckCircle2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', icon: Smartphone },
  { id: 'debit', label: 'Cartão de Débito', icon: CreditCard },
  { id: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'cash', label: 'Dinheiro', icon: Banknote },
];

// Placeholder PIX data - will be configured by store owner
const PIX_DATA = {
  key: "ganoh@email.com", // Placeholder - owner will set real key
  keyType: "email",
  beneficiaryName: "GANOH Café Bistrô",
  city: "São Paulo"
};

export const CheckoutModal = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [customerName, setCustomerName] = useState('');
  const [wantsSchedule, setWantsSchedule] = useState(false);
  const [pickupTime, setPickupTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [pixProof, setPixProof] = useState(null);
  const [pixProofPreview, setPixProofPreview] = useState(null);
  const [step, setStep] = useState(1); // 1: info, 2: pix payment
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const { items, total, itemCount } = useCart();

  // Generate time slots from now until closing (22:00)
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let startMinute = Math.ceil((currentMinute + 15) / 15) * 15;
    let startHour = currentHour;
    
    if (startMinute >= 60) {
      startMinute = startMinute - 60;
      startHour += 1;
    }
    
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

  // Generate PIX copy-paste code
  const generatePixCode = () => {
    // Simplified PIX code - in production, use proper EMV format
    const pixCode = `00020126580014br.gov.bcb.pix0136${PIX_DATA.key}5204000053039865404${total.toFixed(2)}5802BR5925${PIX_DATA.beneficiaryName}6009${PIX_DATA.city}62070503***6304`;
    return pixCode;
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(generatePixCode());
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPixProof(reader.result);
        setPixProofPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (paymentMethod === 'pix') {
      if (step === 1) {
        setStep(2);
        return;
      }
      
      if (!pixProof) {
        toast.error('Por favor, envie o comprovante de pagamento');
        return;
      }
    }
    
    if (customerName.trim() && paymentMethod) {
      const finalPickupTime = wantsSchedule && pickupTime ? pickupTime : null;
      onSubmit(customerName.trim(), finalPickupTime, paymentMethod, pixProof);
    }
  };

  const handleClose = () => {
    setCustomerName('');
    setWantsSchedule(false);
    setPickupTime('');
    setPaymentMethod('');
    setPixProof(null);
    setPixProofPreview(null);
    setStep(1);
    setCopied(false);
    onClose();
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      handleClose();
    }
  };

  const canSubmitStep1 = customerName.trim() && paymentMethod && (!wantsSchedule || pickupTime);
  const canSubmitStep2 = pixProof !== null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            {step === 1 ? (
              <>
                <ShoppingBag className="h-6 w-6 text-brand-600" />
                Finalizar Pedido
              </>
            ) : (
              <>
                <Smartphone className="h-6 w-6 text-brand-600" />
                Pagamento PIX
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 ? (
            <>
              {/* Order Summary */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
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
                <Label htmlFor="customer-name" className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Seu Nome
                </Label>
                <Input
                  id="customer-name"
                  placeholder="Digite seu nome"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-11"
                  required
                  data-testid="customer-name-input"
                />
              </div>

              {/* Schedule Toggle */}
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="schedule-toggle" className="text-sm font-medium cursor-pointer">
                    Agendar horário de retirada
                  </Label>
                </div>
                <Switch
                  id="schedule-toggle"
                  checked={wantsSchedule}
                  onCheckedChange={setWantsSchedule}
                  data-testid="schedule-toggle"
                />
              </div>

              {/* Pickup Time (conditional) */}
              {wantsSchedule && (
                <div className="space-y-2 animate-slideIn">
                  <Label htmlFor="pickup-time" className="text-sm font-medium">
                    Horário para Retirada
                  </Label>
                  <Select value={pickupTime} onValueChange={setPickupTime}>
                    <SelectTrigger className="h-11" data-testid="pickup-time-select">
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.length === 0 ? (
                        <SelectItem value="closed" disabled>Fechado</SelectItem>
                      ) : (
                        timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Forma de Pagamento
                </Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <label
                        key={method.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === method.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-border hover:border-brand-200'
                        }`}
                        data-testid={`payment-${method.id}`}
                      >
                        <RadioGroupItem value={method.id} className="sr-only" />
                        <Icon className={`h-4 w-4 ${paymentMethod === method.id ? 'text-brand-600' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === method.id ? 'text-brand-700' : 'text-foreground'}`}>
                          {method.label}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              {paymentMethod === 'pix' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <p className="font-medium">ℹ️ Pagamento via PIX</p>
                  <p className="text-xs mt-1">Na próxima etapa você verá o QR Code e poderá enviar o comprovante.</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* PIX Payment Step */}
              <div className="space-y-4">
                {/* Amount */}
                <div className="bg-brand-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
                  <p className="text-3xl font-bold text-brand-600">{formatPrice(total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{customerName}</p>
                </div>

                {/* QR Code Placeholder */}
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  <QrCode className="h-32 w-32 mx-auto text-gray-400 mb-3" />
                  <p className="text-xs text-muted-foreground">
                    Escaneie o QR Code acima ou use o código abaixo
                  </p>
                </div>

                {/* PIX Copy-Paste */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={generatePixCode().substring(0, 40) + '...'} 
                      readOnly 
                      className="text-xs font-mono"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={handleCopyPix}
                      className={copied ? 'bg-green-50 border-green-500' : ''}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Upload Proof */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    Enviar Comprovante *
                  </Label>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    data-testid="pix-proof-input"
                  />
                  
                  {pixProofPreview ? (
                    <div className="relative">
                      <img 
                        src={pixProofPreview} 
                        alt="Comprovante" 
                        className="w-full h-40 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Trocar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-24 border-dashed flex flex-col gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="upload-proof-button"
                    >
                      <Camera className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm">Tirar foto ou selecionar imagem</span>
                    </Button>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Envie uma foto ou screenshot do comprovante de pagamento
                  </p>
                </div>
              </div>
            </>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-brand-600 hover:bg-brand-700"
              disabled={step === 1 ? (!canSubmitStep1 || isLoading) : (!canSubmitStep2 || isLoading)}
              data-testid="confirm-order-button"
            >
              {isLoading ? 'Enviando...' : (
                step === 1 ? (paymentMethod === 'pix' ? 'Continuar para PIX' : 'Confirmar Pedido') : 'Enviar Pedido'
              )}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleBack}>
              Voltar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
