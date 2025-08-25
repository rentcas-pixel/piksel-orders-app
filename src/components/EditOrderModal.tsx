'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types';
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
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [comment, setComment] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [intensity, setIntensity] = useState('kas_4');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (order) {
      console.log('🔍 EditOrderModal: order data:', order);
      console.log('🔍 EditOrderModal: from date:', order.from, 'type:', typeof order.from);
      console.log('🔍 EditOrderModal: to date:', order.to, 'type:', typeof order.to);
      
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
        invoice_sent: order.invoice_sent
      });
      
      // Initialize intensity if it exists in order
      if (order.intensity) {
        setIntensity(order.intensity);
      }
    }
  }, [order]);

  const handleInputChange = (field: keyof Order, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };



  const calculateWeek = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // ISO week calculation - Monday as first day of week
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay()) / 7);
      return `W${weekNumber.toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    console.log('🔍 formatDateForDisplay input:', dateString, 'type:', typeof dateString);
    
    try {
      // Handle different date formats from PocketBase
      
      // If it's already in yyyy-mm-dd format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.log('✅ Already yyyy-mm-dd format:', dateString);
        return dateString;
      }
      
      // Handle dd/mm/yyyy format specifically
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('/');
        const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log('✅ Converted dd/mm/yyyy to yyyy-mm-dd:', dateString, '→', result);
        return result;
      }
      
      // Handle dd.mm.yyyy format
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('.');
        const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log('✅ Converted dd.mm.yyyy to yyyy-mm-dd:', dateString, '→', result);
        return result;
      }
      
      // Try to parse the date with other formats
      const date = new Date(dateString);
      console.log('🔍 Parsed date:', date, 'isValid:', !isNaN(date.getTime()));
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('❌ Invalid date, returning original:', dateString);
        return dateString; // Return original if invalid
      }
      
      // Format to yyyy-mm-dd
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      
      console.log('✅ Converted to yyyy-mm-dd:', dateString, '→', result);
      return result;
    } catch (error) {
      console.log('❌ Error in formatDateForDisplay:', error);
      return dateString;
    }
  };



  const handleSave = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      // Update order in PocketBase
      const updatedOrder = await PocketBaseService.updateOrder(order.id, formData);
      
      // Save comment if exists
      if (comment.trim()) {
        await SupabaseService.addComment({
          order_id: order.id,
          content: comment
        });
        console.log('✅ Komentaras išsaugotas Supabase');
      }

      // Save reminder if exists
      if (reminderDate && reminderMessage.trim()) {
        await SupabaseService.addReminder(order.id, {
          title: reminderMessage,
          due_date: reminderDate,
          is_completed: false
        });
        console.log('✅ Priminimas išsaugotas Supabase');
      }

      // Upload files if exists
      for (const file of selectedFiles) {
        await SupabaseService.uploadFile(order.id, file);
        console.log('✅ Failas išsaugotas Supabase');
      }

      console.log('✅ Užsakymas atnaujintas, modalas užsidaro');
      
      // Clear form data after successful save
      setComment('');
      setReminderDate('');
      setReminderMessage('');
      setSelectedFiles([]);
      
      onOrderUpdated(updatedOrder);
      onClose();
    } catch (error) {
      console.error('❌ Failed to update order:', error);
      alert('Klaida išsaugant duomenis. Bandykite dar kartą.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order || !confirm('Ar tikrai norite ištrinti šį užsakymą?')) return;
    
    try {
      await PocketBaseService.deleteOrder(order.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
  };

  if (!isOpen || !order) return null;

  const broadcastPeriod = formData.from && formData.to 
    ? `${formatDateForDisplay(formData.from)} → ${formatDateForDisplay(formData.to)}` 
    : '';
  
  // Calculate weeks for both dates
  const startWeek = formData.from ? calculateWeek(formData.from) : '';
  const endWeek = formData.to ? calculateWeek(formData.to) : '';
  const weeksDisplay = startWeek && endWeek ? `${startWeek} → ${endWeek}` : startWeek || endWeek || '';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
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
            <p className="text-gray-600">Kliento detalės</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Pavadinimas */}
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

              {/* Užsakymo Nr. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Užsakymo Nr.
                </label>
                <input
                  type="text"
                  value={formData.invoice_id || ''}
                  onChange={(e) => handleInputChange('invoice_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Data nuo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data nuo
                </label>
                <input
                  type="text"
                  key={`from-${formData.from}`}
                  value={formData.from ? formatDateForDisplay(formData.from) : ''}
                  onChange={(e) => handleInputChange('from', e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {/* Removed CalendarIcon - browser shows its own icon */}
              </div>

              {/* Komentaras */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Komentaras
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Įveskite komentarą..."
                />
              </div>

              {/* Failai / Print screen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Failai / Print screen
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500">
                    Galite ir įklijuoti ekrano nuotrauką su Cmd/Ctrl+V
                  </p>
                  {selectedFiles.length > 0 && (
                    <div className="text-sm text-gray-600">
                      Pasirinkta failų: {selectedFiles.length}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Statusas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statusas
                </label>
                <select
                  value={formData.approved ? 'taip' : 'ne'}
                  onChange={(e) => handleInputChange('approved', e.target.value === 'taip')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="taip">Patvirtinta</option>
                  <option value="ne">Nepatvirtinta</option>
                </select>
              </div>

              {/* Intensyvumas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intensyvumas
                </label>
                <select
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="kas_4">Kas 4</option>
                  <option value="kas_6">Kas 6</option>
                  <option value="kas_8">Kas 8</option>
                  <option value="kas_12">Kas 12</option>
                  <option value="kas_24">Kas 24</option>
                </select>
              </div>

              {/* Data iki */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data iki
                </label>
                <input
                  type="text"
                  key={`to-${formData.to}`}
                  value={formData.to ? formatDateForDisplay(formData.to) : ''}
                  onChange={(e) => handleInputChange('to', e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {/* Removed CalendarIcon - browser shows its own icon */}
              </div>

              {/* Priminimo data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priminimo data
                </label>
                <input
                  type="text"
                  key={`reminder-${reminderDate}`}
                  value={(() => {
                    const formattedValue = reminderDate && reminderDate.trim() ? formatDateForDisplay(reminderDate) : '';
                    console.log('🔍 Reminder date input value:', { reminderDate, formattedValue });
                    return formattedValue;
                  })()}
                  onChange={(e) => {
                    console.log('🔍 Reminder date changed:', e.target.value);
                    setReminderDate(e.target.value);
                  }}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Priminimo žinutė */}
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
          </div>

          {/* Additional Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Transliacijų laikotarpis:</span> 
                <span className="ml-2 font-semibold text-blue-600">{broadcastPeriod}</span>
              </div>
              <div>
                <span className="font-medium">Savaitės:</span> 
                <span className="ml-2 font-semibold text-green-600">{weeksDisplay}</span>
              </div>
            </div>
          </div>
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
