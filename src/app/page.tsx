'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import { OrderDetailsModal } from '@/components/OrderDetailsModal';
import { EditOrderModal } from '@/components/EditOrderModal';
import { Order } from '@/types';

export default function Home() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get current date for default filters
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
  const currentYear = now.getFullYear();
  
  const [filters, setFilters] = useState({
    status: 'taip', // Default: Patvirtinta - rodo tik patvirtintus užsakymus
    month: currentMonth, // Default: einamasis mėnuo (dabar rugpjūtis)
    year: currentYear.toString(), // Default: einamieji metai (2025)
    client: '',
    agency: '',
    media_received: ''
  });

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
  };

  const handleOrderUpdated = () => {
    // TODO: Update orders list
    setEditingOrder(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header onAddOrder={() => {}} />
      
      <main className="container mx-auto px-4 py-6">
        <SearchAndFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
        
        {/* TODO: Add OrdersTable component */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Užsakymai</h2>
          <p className="text-gray-600">OrdersTable komponentas bus pridėtas vėliau.</p>
        </div>
      </main>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
