import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { MenuPage } from "./pages/MenuPage";
import { OrderTrackingPage } from "./pages/OrderTrackingPage";
import { KitchenPage } from "./pages/KitchenPage";

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/pedido/:orderId" element={<OrderTrackingPage />} />
          <Route path="/cozinha" element={<KitchenPage />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
