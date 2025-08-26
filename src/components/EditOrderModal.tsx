'use client';

import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { Order, Comment, Reminder, FileAttachment } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (order: Order) => void;
}

export function EditOrderModal({ order, isOpen, onClose, onOrderUpdated }: EditOrderModalProps) {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [printScreens, setPrintScreens] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [pendingPrintscreens, setPendingPrintscreens] = useState<FileAttachment[]>([]);

  useEffect(() => {
    if (order) {
      setFormData({
        client: order.client,
        agency: order.agency,
        invoice_id: order.invoice_id,
        from: order.from,
        to: order.to,
        final_price: order.final_price || 0,
        approved: order.approved,
        media_received: order.media_received,
        invoice_sent: order.invoice_sent,
        viaduct: order.viaduct,
      });
    }
  }, [order]);

  const loadComments = useCallback(async () => {
    if (!order) return;
    try {
      const commentsData = await SupabaseService.getComments(order.id);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }, [order]);

  const loadReminders = useCallback(async () => {
    if (!order) return;
    try {
      const remindersData = await SupabaseService.getReminders(order.id);
      setReminders(remindersData);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  }, [order]);

  const loadPrintScreens = useCallback(async () => {
    if (!order) return;
    try {
      const printScreensData = await SupabaseService.getPrintscreensForOrder(order.id);
      setPrintScreens(printScreensData);
      // Clear pending printscreens when loading existing ones
      setPendingPrintscreens([]);
    } catch (error) {
      console.error('Error loading print screens:', error);
    }
  }, [order]);

  useEffect(() => {
    if (order && isOpen) {
      loadComments();
      loadReminders();
      loadPrintScreens();
    }
  }, [order, isOpen, loadComments, loadReminders, loadPrintScreens]);

  const handleInputChange = (field: keyof Order, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      const updatedOrder = await PocketBaseService.updateOrder(order.id, formData);
      onOrderUpdated(updatedOrder);
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    
    if (confirm('Ar tikrai norite ištrinti šį užsakymą?')) {
      try {
        await PocketBaseService.deleteOrder(order.id);
        onClose();
      } catch (error) {
        console.error('Error deleting order:', error);
      }
    }
  };

  const handleAddComment = async () => {
    if (!order || !newComment.trim()) return;
    
    try {
      // Save comment to Supabase
      const comment = await SupabaseService.addComment({
        order_id: order.id,
        text: newComment.trim()
      });
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      // Fallback: create temporary comment if Supabase fails
              const tempComment = {
          id: `temp-${Date.now()}`,
          text: newComment.trim(),
          created_at: new Date().toISOString(),
          order_id: order.id
        } as Comment;
      
      setComments(prev => [...prev, tempComment]);
      setNewComment('');
    }
  };

  const handleAddReminder = async () => {
    if (!order || !reminderDate || !reminderMessage.trim()) return;
    
    try {
      // Convert date to proper format for Supabase
      const formattedDate = new Date(reminderDate).toISOString().split('T')[0];
      
      // Save reminder to Supabase
      const reminder = await SupabaseService.addReminder(order.id, {
        due_date: formattedDate,
        title: reminderMessage.trim(),
        is_completed: false
      });
      setReminders(prev => [...prev, reminder]);
      setReminderDate('');
      setReminderMessage('');
    } catch (error) {
      console.error('Error adding reminder:', error);
      // Fallback: create temporary reminder if Supabase fails
              const tempReminder = {
          id: `temp-${Date.now()}`,
          due_date: reminderDate,
          title: reminderMessage.trim(),
          is_completed: false,
          order_id: order.id,
          created_at: new Date().toISOString()
        } as Reminder;
      
      setReminders(prev => [...prev, tempReminder]);
      setReminderDate('');
      setReminderMessage('');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await SupabaseService.deleteReminder(reminderId);
      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const handlePrintscreenView = (printscreen: FileAttachment) => {
    window.open(printscreen.file_url, '_blank');
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !order) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Upload printscreen
          const uploadedFile = await SupabaseService.uploadPrintscreen(order.id, file);
          
          // Add to pending printscreens for immediate display
          setPendingPrintscreens(prev => [...prev, uploadedFile]);
          
        } catch (error) {
          console.error('Error uploading printscreen:', error);
        }
      }
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return dateString;
    }
  };

  const calculateWeek = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // ISO 8601 week calculation
      
      // Adjust for ISO week numbering (week 1 starts on Monday of first week with 4+ days)
      const jan4 = new Date(date.getFullYear(), 0, 4);
      const jan4Weekday = jan4.getDay() || 7; // Convert Sunday (0) to 7
      const week1Start = new Date(jan4);
      week1Start.setDate(jan4.getDate() - jan4Weekday + 1);
      
      const daysFromWeek1 = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000));
      const isoWeekNumber = Math.ceil((daysFromWeek1 + 1) / 7);
      
      return `W${isoWeekNumber}`;
    } catch {
      return '';
    }
  };

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
        'sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis',
        'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis'
      ];
      
              const currentDate = new Date(start);
      const endDate = new Date(end);
      
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const monthKey = `${year}-${month}`;
        
        let monthEntry = monthlyDistribution.find(m => m.month === monthKey);
        
        if (!monthEntry) {
          monthEntry = {
            month: monthKey,
            year: year,
            days: 0,
            amount: 0,
            monthName: monthNames[month - 1]
          };
          monthlyDistribution.push(monthEntry);
        }
        
        monthEntry.days++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      monthlyDistribution.forEach(month => {
        month.amount = (month.days / manualDayCount) * totalAmount;
      });
      
      return monthlyDistribution.map(m => ({
        month: parseInt(m.month.split('-')[1]),
        year: m.year,
        monthName: m.monthName,
        days: m.days,
        amount: m.amount
      }));
    } catch (error) {
      console.error('Error in calculateMonthlyDistribution:', error);
      return [];
    }
  };
  
  const startWeek = formData.from ? calculateWeek(formData.from) : '';
  const endWeek = formData.to ? calculateWeek(formData.to) : '';
  const weeksDisplay = startWeek && endWeek ? `${startWeek} → ${endWeek}` : startWeek || endWeek || '';

  if (!isOpen || !order) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{order.client}</h2>
            <p className="text-gray-600">{order.agency} | {order.invoice_id}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Media</span>
              <button
                type="button"
                onClick={() => handleInputChange('media_received', !formData.media_received)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.media_received ? 'bg-green-300' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.media_received ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Sąskaita</span>
              <button
                type="button"
                onClick={() => handleInputChange('invoice_sent', !formData.invoice_sent)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.invoice_sent ? 'bg-green-300' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.invoice_sent ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
          <button
              type="button"
            onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Main Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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

          {/* Dates Section */}
          <div className="space-y-2">
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

                        <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-900">
                <span className="font-normal">Savaitės:</span> <span className="font-semibold">{weeksDisplay}</span>
              </div>
            </div>
              </div>


          {/* Sums Section */}
                {formData.from && formData.to && formData.final_price && (
            <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      {(() => {
                        const distribution = calculateMonthlyDistribution(formData.from, formData.to, formData.final_price);
                        return distribution.map((month) => (
                          <div key={month.month} className="text-sm text-gray-900">
                            {month.monthName.charAt(0).toUpperCase() + month.monthName.slice(1)} {month.year} ({month.days} d.) → {month.amount.toFixed(2)}€
                          </div>
                        ));
                      })()}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-900">
                          <span className="font-normal">Viso:</span> <span className="font-semibold">{formData.final_price?.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
          

          




          {/* Comments Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Komentaras
              </label>
              <div
                contentEditable
                onInput={(e) => setNewComment(e.currentTarget.textContent || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                onPaste={handlePaste}
                data-placeholder="Įveskite komentarą... (Enter - išsaugoti, Cmd+V - printscreen)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none min-h-[6rem] overflow-y-auto"
                style={{ whiteSpace: 'pre-wrap' }}
              />
              
              {comments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">
                        {new Date(comment.created_at).toLocaleString('lt-LT')}
                      </div>
                      <div className="text-sm text-gray-900">{comment.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Printscreens
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Pending printscreens (just uploaded) */}
                  {pendingPrintscreens.map((printscreen) => (
                    <div key={printscreen.id} className="relative">
                      <Image
                        src={printscreen.file_url}
                        alt="Printscreen"
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => handlePrintscreenView(printscreen)}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await SupabaseService.deleteFile(printscreen.id);
                            setPendingPrintscreens(prev => prev.filter(p => p.id !== printscreen.id));
                            setPrintScreens(prev => prev.filter(p => p.id !== printscreen.id));
                          } catch (error) {
                            console.error('Error deleting printscreen:', error);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full text-xs hover:bg-gray-800 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* Existing printscreens */}
                  {printScreens.map((printscreen) => (
                    <div key={printscreen.id} className="relative">
                      <Image
                        src={printscreen.file_url}
                        alt="Printscreen"
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => handlePrintscreenView(printscreen)}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await SupabaseService.deleteFile(printscreen.id);
                            setPrintScreens(prev => prev.filter(p => p.id !== printscreen.id));
                          } catch (error) {
                            console.error('Error deleting printscreen:', error);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full text-xs hover:bg-gray-800 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {pendingPrintscreens.length === 0 && printScreens.length === 0 && (
                    <div className="text-sm text-gray-400 italic">
                      Cmd+V į komentaro lauką pridėti printscreen
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reminders Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priminimo žinutė
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Įveskite priminimo žinutę..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddReminder}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Pridėti
                </button>
              </div>
            </div>
          </div>

          {/* Reminders List */}
          {reminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Priminimai</h3>
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(reminder.due_date).toLocaleDateString('lt-LT')}
                      </div>
                      <div className="text-sm text-gray-600">{reminder.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Ištrinti
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Ištrinti
          </button>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Uždaryti
            </button>
            <button
              type="button"
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