'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PocketBaseService } from '@/lib/pocketbase';
import { Reminder } from '@/types';

interface ReminderNotificationProps {
  onClose: () => void;
  onOpenEditModal: (orderId: string) => void;
}

export function ReminderNotifications({ onClose, onOpenEditModal }: ReminderNotificationProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderClients, setOrderClients] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAllReminders();
  }, []);

  const loadAllReminders = async () => {
    try {
      // Get reminders that are due today or in the next 7 days, or overdue
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('is_completed', false)
        .lte('due_date', nextWeek.toISOString().split('T')[0]) // Due today or earlier
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Filter reminders to show only relevant ones (due today, overdue, or due soon)
      const relevantReminders = (data || []).filter(reminder => {
        const dueDate = new Date(reminder.due_date);
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Show if: overdue, due today, or due in next 3 days
        return diffDays <= 3;
      });
      
      setReminders(relevantReminders);

      // Get client names for each order
      if (relevantReminders && relevantReminders.length > 0) {
        const orderIds = [...new Set(relevantReminders.map(r => r.order_id))];
        const clients: Record<string, string> = {};
        
        for (const orderId of orderIds) {
          try {
            const order = await PocketBaseService.getOrder(orderId);
            clients[orderId] = order.client;
          } catch (error) {
            console.error(`Error loading order ${orderId}:`, error);
            clients[orderId] = 'Nežinomas klientas';
          }
        }
        
        setOrderClients(clients);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-6 max-w-sm backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          <div className="text-sm text-gray-600">Kraunama priminimai...</div>
        </div>
      </div>
    );
  }

  if (reminders.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {reminders.map((reminder) => (
        <div 
          key={reminder.id} 
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-5 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer hover:bg-gray-50"
          onClick={() => onOpenEditModal(reminder.order_id)}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">!</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="text-xs text-gray-600">Priminimas</h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Aktyvus
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800 mb-3 leading-relaxed">
                {reminder.title}
              </p>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  <span className="font-medium">Klientas:</span>
                  <span className="text-gray-800">{orderClients[reminder.order_id] || 'Kraunama...'}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  <span className="font-medium">Data:</span>
                  <span className="text-gray-800">{new Date(reminder.due_date).toLocaleDateString('lt-LT')}</span>
                  {(() => {
                    const dueDate = new Date(reminder.due_date);
                    const today = new Date();
                    const diffTime = dueDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                      return <span className="text-red-600 font-medium"> (Vėluoja {Math.abs(diffDays)} d.)</span>;
                    } else if (diffDays === 0) {
                      return <span className="text-orange-600 font-medium"> (Šiandien!)</span>;
                    } else if (diffDays <= 3) {
                      return <span className="text-blue-600 font-medium"> (už {diffDays} d.)</span>;
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white/80 hover:bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 backdrop-blur-sm"
        >
          <span>Uždaryti</span>
          <svg className="ml-1.5 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
