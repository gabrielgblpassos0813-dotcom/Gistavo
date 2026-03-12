import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { MapPin, ChefHat, BarChart3 } from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_3ce8b343-7b4a-4022-9f41-1db1d4d9bedc/artifacts/1ydsie4g_IMG_3253.png";

const STORES = [
  { id: 'runner', name: 'GANOH - Runner', description: 'Academia Runner' },
  { id: 'gym-londres', name: 'GANOH - GYM Londres', description: 'Academia GYM Londres' }
];

export const StoreSelectorPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="GANOH Café Bistrô" className="h-20 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Bem-vindo ao GANOH
          </h1>
          <p className="text-muted-foreground mt-1">Selecione a unidade</p>
        </div>

        {/* Store Selection */}
        <div className="space-y-3 mb-8">
          {STORES.map((store) => (
            <button
              key={store.id}
              onClick={() => navigate(`/${store.id}`)}
              className="w-full p-4 bg-white rounded-xl border border-border hover:border-brand-300 hover:shadow-md transition-all flex items-center gap-4 group"
              data-testid={`store-${store.id}`}
            >
              <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <MapPin className="h-6 w-6 text-brand-600" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">{store.name}</p>
                <p className="text-sm text-muted-foreground">{store.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Admin Links */}
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground text-center mb-4">Área Administrativa</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col gap-1"
              onClick={() => navigate('/runner/cozinha')}
            >
              <ChefHat className="h-5 w-5 text-brand-600" />
              <span className="text-xs">Cozinha Runner</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col gap-1"
              onClick={() => navigate('/gym-londres/cozinha')}
            >
              <ChefHat className="h-5 w-5 text-brand-600" />
              <span className="text-xs">Cozinha GYM</span>
            </Button>
          </div>
          {/* Painel do Gestor escondido - acesse diretamente via /auth */}
        </div>
      </div>
    </div>
  );
};
