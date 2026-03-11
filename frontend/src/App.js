import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { MenuPage } from "./pages/MenuPage";
import { OrderTrackingPage } from "./pages/OrderTrackingPage";
import { KitchenPage } from "./pages/KitchenPage";
import { GestorPage } from "./pages/GestorPage";
import { StoreSelectorPage } from "./pages/StoreSelectorPage";

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* Store Selector */}
          <Route path="/" element={<StoreSelectorPage />} />
          
          {/* Store-specific routes */}
          <Route path="/:store" element={<MenuPage />} />
          <Route path="/:store/pedido/:orderId" element={<OrderTrackingPage />} />
          <Route path="/:store/cozinha" element={<KitchenPage />} />
          
          {/* Gestor (manager) panel */}
          <Route path="/gestor/dashboard" element={<GestorPage />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
