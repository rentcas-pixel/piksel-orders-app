'use client';

import { useState, useEffect } from 'react';
import { Order, Comment, Reminder } from '@/types';
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
  const [formData, setFormData] = useState<Partial<Order> & { screens?: string[] }>({});
  const [comment, setComment] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [intensity, setIntensity] = useState('kas_4');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<'main' | 'screens'>('main');
  const [newScreen, setNewScreen] = useState('');

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
        screens: (order as any).screens || []
      });
      
      if (order.intensity) {
        setIntensity(order.intensity);
      }

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

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
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
      
      console.log('🔍 calculateMonthlyDistribution input:', { fromDate, toDate, totalAmount });
      
      // Clean dates by removing time part first
      const cleanFromDate = fromDate.split(' ')[0];
      const cleanToDate = toDate.split(' ')[0];
      
      const [startYear, startMonth, startDay] = cleanFromDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = cleanToDate.split('-').map(Number);
      
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
      }
      
      // Calculate total days manually
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
      
      // Iterate through each day
      let currentDate = new Date(start);
      const endDate = new Date(end);
      
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1; // +1 to get 1-based month numbers
        const year = currentDate.getFullYear();
        const monthKey = `${year}-${month}`;
        
        let monthEntry = monthlyDistribution.find(m => m.month === monthKey);
        
        if (!monthEntry) {
          monthEntry = {
            month: monthKey,
            year,
            days: 0,
            amount: 0,
            monthName: monthNames[month - 1] // -1 because monthNames is 0-based
          };
          monthlyDistribution.push(monthEntry);
        }
        
        monthEntry.days++;
        
        // Move to next day
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        currentDate = nextDay;
      }
      
      // Calculate amounts for each month
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
    } catch (error) {
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

  // Handle save
  const handleSave = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      // Update order in PocketBase
      const updatedOrder = await PocketBaseService.updateOrder(order.id, formData);
      
      // Save reminder if exists
      if (reminderDate && reminderMessage.trim()) {
        await SupabaseService.addReminder(order.id, {
          title: reminderMessage,
          due_date: reminderDate,
          is_completed: false
        });
      }
      
      // Handle file uploads here if needed
      
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

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('main')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'main'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pagrindinė informacija
            </button>
            <button
              onClick={() => setActiveTab('screens')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'screens'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ekranai
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Main Tab */}
          {activeTab === 'main' && (
            <>
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
                  </div>

                  {/* Komentaras */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Komentaras
                    </label>
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
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (comment.trim()) {
                            handleSaveComment();
                          }
                        }
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Įveskite komentarą... (Enter - išsaugoti komentarą, Shift+Enter - nauja eilutė)"
                    />
                    
                    {/* Existing Comments */}
                    {comments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Esami komentarai:</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {comments.map((comment) => (
                            <div key={comment.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-sm text-gray-800">{comment.text}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(comment.created_at).toLocaleString('lt-LT')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                  </div>

                  {/* Priminimo data */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priminimo data
                    </label>
                    <input
                      type="text"
                      key={`reminder-${reminderDate}`}
                      value={reminderDate && reminderDate.trim() ? formatDateForDisplay(reminderDate) : ''}
                      onChange={(e) => setReminderDate(e.target.value)}
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
                    
                    {/* Existing Reminders */}
                    {reminders.length > 0 && (
                      <div className="mt-4">
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
                
                {/* Monthly Distribution */}
                {formData.from && formData.to && formData.final_price && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
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
              </div>
            </>
          )}

          {/* Screens Tab */}
          {activeTab === 'screens' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-4">Užsakyme esančių ekranų sąrašas</h3>
                
                {/* Add New Screen */}
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newScreen}
                    onChange={(e) => setNewScreen(e.target.value)}
                    placeholder="Įveskite ekrano pavadinimą..."
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newScreen.trim()) {
                        const newScreens = [...(formData.screens || []), newScreen.trim()];
                        setFormData(prev => ({ ...prev, screens: newScreens }));
                        setNewScreen('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newScreen.trim()) {
                        const newScreens = [...(formData.screens || []), newScreen.trim()];
                        setFormData(prev => ({ ...prev, screens: newScreens }));
                        setNewScreen('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Pridėti
                  </button>
                </div>
                
                {formData.screens && formData.screens.length > 0 ? (
                  <div className="space-y-3">
                    {formData.screens.map((screen, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white border border-blue-200 rounded-lg">
                        <span className="text-blue-900 font-medium">{screen}</span>
                        <button
                          onClick={() => {
                            const newScreens = formData.screens?.filter((_, i) => i !== index) || [];
                            setFormData(prev => ({ ...prev, screens: newScreens }));
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-blue-600">
                    <p>Šiame užsakyme nėra pasirinktų ekranų</p>
                  </div>
                )}
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
