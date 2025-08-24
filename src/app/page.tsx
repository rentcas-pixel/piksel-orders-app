'use client';

import { useState } from 'react';
import { OrdersTable } from '@/components/OrdersTable';
import { Header } from '@/components/Header';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import { AddOrderModal } from '@/components/AddOrderModal';
import { OrderDetailsModal } from '@/components/OrderDetailsModal';
import { Order } from '@/types';

export default function Home() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    month: '',
    year: '',
    client: '',
    agency: ''
  });

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header onAddOrder={() => setIsAddModalOpen(true)} />
      
      <main className="container mx-auto px-4 py-6">
        <SearchAndFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
        
        <OrdersTable
          searchQuery={searchQuery}
          filters={filters}
          onOrderClick={handleOrderClick}
        />
      </main>

      {/* Add Order Modal */}
      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
