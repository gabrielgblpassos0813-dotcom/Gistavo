// Offline support utilities for GANOH Café Bistrô

const OFFLINE_ORDERS_KEY = 'ganoh_offline_orders';

// Check if online
export const isOnline = () => navigator.onLine;

// Save order offline
export const saveOrderOffline = (orderData) => {
  const offlineOrders = getOfflineOrders();
  const offlineOrder = {
    ...orderData,
    offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString()
  };
  offlineOrders.push(offlineOrder);
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(offlineOrders));
  return offlineOrder;
};

// Get offline orders
export const getOfflineOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_ORDERS_KEY) || '[]');
  } catch {
    return [];
  }
};

// Clear synced orders
export const clearSyncedOrders = (syncedIds) => {
  const offlineOrders = getOfflineOrders();
  const remaining = offlineOrders.filter(order => !syncedIds.includes(order.offline_id));
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(remaining));
};

// Sync offline orders when back online
export const syncOfflineOrders = async (apiUrl) => {
  const offlineOrders = getOfflineOrders();
  if (offlineOrders.length === 0) return { synced: 0, failed: 0 };

  try {
    const response = await fetch(`${apiUrl}/api/orders/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offlineOrders)
    });
    
    if (response.ok) {
      const result = await response.json();
      const syncedIds = result.synced_orders
        .filter(r => r.synced)
        .map(r => r.offline_id);
      clearSyncedOrders(syncedIds);
      return {
        synced: syncedIds.length,
        failed: offlineOrders.length - syncedIds.length
      };
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
  
  return { synced: 0, failed: offlineOrders.length };
};

// Listen for online/offline events
export const setupOfflineListener = (onOnline, onOffline) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};
