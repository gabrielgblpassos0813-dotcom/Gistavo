import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [customTotal, setCustomTotal] = useState(null); // Custom total for manual price adjustment

  const addItem = useCallback((item) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(i => i.menu_item_id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, {
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1
      }];
    });
    // Reset custom total when items change
    setCustomTotal(null);
  }, []);

  const removeItem = useCallback((menuItemId) => {
    setItems(prev => prev.filter(i => i.menu_item_id !== menuItemId));
    setCustomTotal(null);
  }, []);

  const updateQuantity = useCallback((menuItemId, quantity) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems(prev => prev.map(item => 
      item.menu_item_id === menuItemId ? { ...item, quantity } : item
    ));
    setCustomTotal(null);
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setCustomTotal(null);
  }, []);

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  // The final total to use (custom if set, otherwise calculated)
  const finalTotal = customTotal !== null ? customTotal : total;

  const value = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    finalTotal,
    customTotal,
    setCustomTotal,
    itemCount,
    isOpen,
    setIsOpen
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
