import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Switch } from '../components/ui/switch';
import { useCart } from '../context/CartContext';
import { User, ShoppingBag, Clock, CreditCard, Banknote, Smartphone, Receipt, Upload, Camera, Copy, CheckCircle2, QrCode, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', icon: Smartphone },
  { id: 'debit', label: 'Cartão de Débito', icon: CreditCard },
  { id: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'cash', label: 'Dinheiro', icon: Banknote },
  { id: 'prazo', label: 'Prazo (Fiado)', icon: CalendarClock },
];

// PIX data - configured by store owner
const PIX_DATA = {
  key: "49289019000199",
  keyType: "CNPJ",
  beneficiaryName: "GANOH Café Bistrô",
  city: "São Paulo"
};

export const CheckoutModal = ({ isOpen, onClose, onSubmit, isLoading, store = 'runner' }) => {
  const [customerName, setCustomerName] = useState('');
  const [wantsSchedule, setWantsSchedule] = useState(false);
  const [pickupTime, setPickupTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [pixProof, setPixProof] = useState(null);
  const [pixProofPreview, setPixProofPreview] = useState(null);
  const [step, setStep] = useState(1); // 1: info, 2: pix payment
  const [copied, setCopied] = useState(false);
  const [prazoCustomers, setPrazoCustomers] = useState([]);
  const [selectedPrazoCustomer, setSelectedPrazoCustomer] = useState('');
  const fileInputRef = useRef(null);
  const { items, total, itemCount } = useCart();

  // Fetch prazo customers for both stores
  useEffect(() => {
    if (isOpen) {
      axios.get(`${API}/prazo/customers`)
        .then(res => setPrazoCustomers(res.data.customers || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Get available payment methods (same for all stores now)
  const availablePaymentMethods = PAYMENT_METHODS;

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

  // PIX copy-paste - just the CNPJ key
  const getPixKey = () => PIX_DATA.key;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_DATA.key);
    setCopied(true);
    toast.success('CNPJ copiado!');
    setTimeout(() => setCopied(false), 3000);
  };

  // Compress image for faster upload
  const compressImage = (file, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 10MB.');
        return;
      }
      
      toast.loading('Processando imagem...', { id: 'compress' });
      
      try {
        // Compress the image
        const compressedImage = await compressImage(file);
        setPixProof(compressedImage);
        setPixProofPreview(compressedImage);
        toast.success('Comprovante carregado!', { id: 'compress' });
      } catch (error) {
        toast.error('Erro ao processar imagem', { id: 'compress' });
      }
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
                <RadioGroup value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); if (v !== 'prazo') setSelectedPrazoCustomer(''); }} className="grid grid-cols-2 gap-2">
                  {availablePaymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <label
                        key={method.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === method.id
                            ? method.id === 'prazo' ? 'border-amber-500 bg-amber-50' : 'border-brand-500 bg-brand-50'
                            : 'border-border hover:border-brand-200'
                        }`}
                        data-testid={`payment-${method.id}`}
                      >
                        <RadioGroupItem value={method.id} className="sr-only" />
                        <Icon className={`h-4 w-4 ${paymentMethod === method.id ? (method.id === 'prazo' ? 'text-amber-600' : 'text-brand-600') : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === method.id ? (method.id === 'prazo' ? 'text-amber-700' : 'text-brand-700') : 'text-foreground'}`}>
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

              {paymentMethod === 'prazo' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    <p className="font-medium">⚠️ Pagamento a Prazo</p>
                    <p className="text-xs mt-1">O valor será registrado para pagamento posterior.</p>
                  </div>
                  
                  {prazoCustomers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Cliente cadastrado (opcional)</Label>
                      <Select value={selectedPrazoCustomer} onValueChange={(v) => { setSelectedPrazoCustomer(v); if (v) setCustomerName(v); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione ou digite o nome acima" />
                        </SelectTrigger>
                        <SelectContent>
                          {prazoCustomers.map((c) => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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

                {/* PIX Copy-Paste - CNPJ */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Chave PIX (CNPJ)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={PIX_DATA.key} 
                      readOnly 
                      className="text-base font-mono font-bold tracking-wider"
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
