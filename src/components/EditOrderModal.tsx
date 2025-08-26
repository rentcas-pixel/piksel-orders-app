'use client';

import { useState, useEffect } from 'react';
import { Order, Comment, Reminder, FileAttachment } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: Order) => void;
}

export function EditOrderModal({ order, isOpen, onClose, onOrderUpdated }: EditOrderModalProps) {
  // State variables
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [comment, setComment] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Load order data when modal opens
  useEffect(() => {
    if (order) {
      console.log('🔍 EditOrderModal: order data:', order);
      
      setFormData({
        client: order.client,
        agency: order.agency,
        invoice_id: order.invoice_id,
        approved: order.approved,
        viaduct: order.viaduct,
        from: order.from,
        to: order.to,
        media_received: order.media_received,
        final_price: order.final_price,
        invoice_sent: order.invoice_sent,
      });

      // Load comments and reminders from Supabase
      const loadOrderData = async () => {
        try {
          const [commentsData, remindersData] = await Promise.all([
            SupabaseService.getComments(order.id),
            SupabaseService.getReminders(order.id)
          ]);
          setComments(commentsData);
          setReminders(remindersData);
          console.log('✅ Loaded comments and reminders:', { comments: commentsData, reminders: remindersData });
        } catch (error) {
          console.error('❌ Failed to load comments/reminders:', error);
        }
      };

      loadOrderData();
    }
  }, [order]);

  // Handle input changes
  const handleInputChange = (field: keyof Order, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculate week number
  const calculateWeek = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay()) / 7);
      return `W${weekNumber.toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  // Calculate monthly distribution
  const calculateMonthlyDistribution = (fromDate: string, toDate: string, totalAmount: number) => {
    try {
      if (!fromDate || !toDate || !totalAmount) return [];
      
      const cleanFromDate = fromDate.split(' ')[0];
      const cleanToDate = toDate.split(' ')[0];
      
      const [startYear, startMonth, startDay] = cleanFromDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = cleanToDate.split('-').map(Number);
      
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
      }
      
      let manualDayCount = 0;
      let checkDate = new Date(start);
      while (checkDate <= end) {
        manualDayCount++;
        const nextCheckDate = new Date(checkDate);
        nextCheckDate.setDate(nextCheckDate.getDate() + 1);
        checkDate = nextCheckDate;
      }
      
      const monthlyDistribution: Array<{
        month: string;
        year: number;
        days: number;
        amount: number;
        monthName: string;
      }> = [];
      
      const monthNames = [
        'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
        'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
      ];
      
      let currentDate = new Date(start);
      const endDate = new Date(end);
      
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const monthKey = `${year}-${month}`;
        
        let monthEntry = monthlyDistribution.find(m => m.month === monthKey);
        
        if (!monthEntry) {
          monthEntry = {
            month: monthKey,
            year,
            days: 0,
            amount: 0,
            monthName: monthNames[month - 1]
          };
          monthlyDistribution.push(monthEntry);
        }
        
        monthEntry.days++;
        
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        currentDate = nextDay;
      }
      
      monthlyDistribution.forEach(month => {
        month.amount = (month.days / manualDayCount) * totalAmount;
      });
      
      return monthlyDistribution;
    } catch (error) {
      console.error('❌ Error calculating monthly distribution:', error);
      return [];
    }
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('.');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  // Handle comment save
  const handleSaveComment = async () => {
    if (!order || !comment.trim()) return;
    
    try {
      const newComment = await SupabaseService.addComment({
        order_id: order.id,
        text: comment
      });
      setComments(prev => [newComment, ...prev]);
      setComment('');
      console.log('✅ Komentaras išsaugotas Supabase');
    } catch (error) {
      console.error('❌ Failed to save comment:', error);
      alert('Klaida išsaugant komentarą. Bandykite dar kartą.');
    }
  };

  // Handle printscreen upload
  const handlePrintscreenUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/') && order) {
      try {
        console.log('📸 Uploading printscreen:', file.name);
        
        const printscreen = await SupabaseService.uploadPrintscreen(order.id, file);
        console.log('✅ Printscreen uploaded:', printscreen);
        
        event.target.value = '';
        
      } catch (error) {
        console.error('❌ Failed to upload printscreen:', error);
        alert('Klaida įkeliant printscreen. Bandykite dar kartą.');
      }
    }
  };

  // Handle printscreen view
  const handlePrintscreenView = (printscreen: FileAttachment) => {
    window.open(printscreen.file_url, '_blank');
  };

  // Handle save
  const handleSave = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      const updatedOrder = await PocketBaseService.updateOrder(order.id, formData);
      
      if (reminderDate && reminderMessage.trim()) {
        await SupabaseService.addReminder(order.id, {
          title: reminderMessage,
          due_date: reminderDate,
          is_completed: false
        });
      }
      
      onOrderUpdated(updatedOrder);
      onClose();
      console.log('✅ Order updated successfully');
    } catch (error) {
      console.error('❌ Failed to update order:', error);
      alert('Klaida atnaujinant užsakymą. Bandykite dar kartą.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!order || !confirm('Ar tikrai norite ištrinti šį užsakymą?')) return;
    
    try {
      await PocketBaseService.deleteOrder(order.id);
      onClose();
      console.log('✅ Order deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete order:', error);
      alert('Klaida ištrinant užsakymą. Bandykite dar kartą.');
    }
  };

  // Calculate display values
  const broadcastPeriod = formData.from && formData.to 
    ? `${formatDateForDisplay(formData.from)} → ${formatDateForDisplay(formData.to)}` 
    : '';
  
  const startWeek = formData.from ? calculateWeek(formData.from) : '';
  const endWeek = formData.to ? calculateWeek(formData.to) : '';
  const weeksDisplay = startWeek && endWeek ? `${startWeek} → ${endWeek}` : startWeek || endWeek || '';

  if (!isOpen || !order) return null;

  return (
    <div 
      className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      tabIndex={0}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{order.client}</h2>
            <p className="text-gray-600">{order.agency} | {order.invoice_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pavadinimas
              </label>
              <input
                type="text"
                value={formData.client || ''}
                onChange={(e) => handleInputChange('client', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statusas
              </label>
              <select
                value={formData.approved ? 'taip' : 'ne'}
                onChange={(e) => handleInputChange('approved', e.target.value === 'taip')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ne">Nepatvirtinta</option>
                <option value="taip">Patvirtinta</option>
                <option value="rezervuota">Rezervuota</option>
                <option value="atšaukta">Atšaukta</option>
              </select>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Media</span>
              <button
                type="button"
                onClick={() => handleInputChange('media_received', !formData.media_received)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.media_received ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.media_received ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Sąskaita</span>
              <button
                type="button"
                onClick={() => handleInputChange('invoice_sent', !formData.invoice_sent)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.invoice_sent ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.invoice_sent ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transliacijų laikotarpis
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={formData.from ? formatDateForDisplay(formData.from) : ''}
                  onChange={(e) => handleInputChange('from', e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-500">→</span>
                <input
                  type="text"
                  value={formData.to ? formatDateForDisplay(formData.to) : ''}
                  onChange={(e) => handleInputChange('to', e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Savaitės
              </label>
              <div className="px-3 py-2 text-green-600 font-semibold">
                {weeksDisplay}
              </div>
            </div>
          </div>

          {/* Sums Section */}
          {formData.from && formData.to && formData.final_price && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Sumos pamenesiui</h3>
              <div className="space-y-2">
                {(() => {
                  const distribution = calculateMonthlyDistribution(formData.from, formData.to, formData.final_price);
                  return distribution.map((month) => (
                    <div key={month.month} className="text-sm text-gray-900">
                      {month.monthName} {month.year} ({month.days} d.) → {month.amount.toFixed(2)}€
                    </div>
                  ));
                })()}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-900">
                    Viso: {formData.final_price?.toFixed(2)}€
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Komentaras
            </label>
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (comment.trim()) {
                        handleSaveComment();
                      }
                    }
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Įveskite komentarą... (Enter - išsaugoti)"
                />
              </div>
              
              {/* Printscreen thumbnails */}
              <div className="flex flex-col space-y-2">
                <div className="w-16 h-16 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePrintscreenUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-gray-400 text-xs">+</span>
                </div>
                <div className="w-16 h-16 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePrintscreenUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-gray-400 text-xs">+</span>
                </div>
              </div>
            </div>
            
            {/* Existing Comments */}
            {comments.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Esami komentarai:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-800">{comment.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(comment.created_at).toLocaleString('lt-LT')}
                      </p>
                      {comment.printscreens && comment.printscreens.length > 0 && (
                        <div className="mt-2 flex space-x-2">
                          {comment.printscreens.map((printscreen) => (
                            <div key={printscreen.id} className="relative">
                              <img
                                src={printscreen.file_url}
                                alt="Printscreen"
                                className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => handlePrintscreenView(printscreen)}
                              />
                              <button
                                onClick={() => {/* TODO: Delete printscreen */}}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reminders Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priminimo data
              </label>
              <input
                type="text"
                value={reminderDate && reminderDate.trim() ? formatDateForDisplay(reminderDate) : ''}
                onChange={(e) => setReminderDate(e.target.value)}
                pattern="\d{4}-\d{2}-\d{2}"
                placeholder="yyyy-mm-dd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priminimo žinutė
              </label>
              <input
                type="text"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Pvz.: perskambinti, patvirtinti užsakymą..."
              />
            </div>
          </div>
          
          {/* Existing Reminders */}
          {reminders.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Esami priminimai:</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-gray-800 font-medium">{reminder.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Iki: {new Date(reminder.due_date).toLocaleDateString('lt-LT')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Ištrinti
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Uždaryti
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Išsaugoma...' : 'Išsaugoti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}