'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ChatBubbleLeftIcon, BellIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { Order, Comment, Reminder, FileAttachment } from '@/types';
import { SupabaseService } from '@/lib/supabase-service';

import { format } from 'date-fns';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'reminders' | 'files'>('details');
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);

  const [newComment, setNewComment] = useState('');
  const [newReminder, setNewReminder] = useState({ title: '', due_date: '', is_completed: false });

  useEffect(() => {
    const loadOrderData = async () => {
      if (!order) return;
      
      try {
        const [commentsData, remindersData, filesData] = await Promise.all([
          SupabaseService.getComments(order.id),
          SupabaseService.getReminders(order.id),
          SupabaseService.getFiles(order.id)
        ]);
        
        setComments(commentsData);
        setReminders(remindersData);
        setFiles(filesData);
      } catch (error) {
        console.error('Failed to load order data:', error);
      }
    };

    if (order && isOpen) {
      loadOrderData();
    }
  }, [order, isOpen]);

  const handleAddComment = async () => {
    if (!order || !newComment.trim()) return;
    
    try {
      const comment = await SupabaseService.addComment({
        order_id: order.id,
        text: newComment
      });
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleAddReminder = async () => {
    if (!order || !newReminder.title.trim() || !newReminder.due_date) return;
    
    try {
      const reminder = await SupabaseService.addReminder(order.id, {
        title: newReminder.title,
        due_date: newReminder.due_date,
        is_completed: false
      });
      setReminders(prev => [...prev, reminder]);
      setNewReminder({ title: '', due_date: '', is_completed: false });
    } catch (error) {
      console.error('Failed to add reminder:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!order || !event.target.files?.length) return;
    
    try {
      const file = event.target.files[0];
      const fileAttachment = await SupabaseService.uploadFileToStorage(order.id, file);
      setFiles(prev => [fileAttachment, ...prev]);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const getStatusColor = (approved: boolean) => {
    if (approved) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const getStatusText = (approved: boolean) => {
    return approved ? 'Patvirtinta' : 'Nepatvirtinta';
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('lt-LT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
              Užsakymo detalės: {order.client}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'details', label: 'Detalės', icon: null },
                { id: 'comments', label: 'Komentarai', icon: ChatBubbleLeftIcon },
                { id: 'reminders', label: 'Priminimai', icon: BellIcon },
                { id: 'files', label: 'Failai', icon: PaperClipIcon }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'details' | 'comments' | 'reminders' | 'files')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {tab.icon && <tab.icon className="w-4 h-4" />}
                    <span>{tab.label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Pagrindinė informacija</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Klientas</dt>
                        <dd className="text-sm text-gray-900 dark:text-white">{order.client}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Agentūra</dt>
                        <dd className="text-sm text-gray-900 dark:text-white">{order.agency || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Užsakymo Nr.</dt>
                        <dd className="text-sm text-gray-900 dark:text-white">{order.invoice_id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Statusas</dt>
                        <dd>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.approved)}`}>
                            {getStatusText(order.approved)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Datos ir kaina</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Data nuo</dt>
                        <dd className="text-sm text-gray-900 dark:text-white">{formatDate(order.from)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Data iki</dt>
                        <dd className="text-sm text-gray-900 dark:text-white">{formatDate(order.to)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Galutinė kaina</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(order.final_price)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Papildoma informacija</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={order.viaduct}
                        readOnly
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Viadukas</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={order.media_received}
                        readOnly
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Medija gauta</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={order.invoice_sent}
                        readOnly
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Sąskaita išsiųsta</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Pridėti komentarą..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pridėti
                  </button>
                </div>
                
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                                                  <p className="text-sm text-gray-900 dark:text-white">{comment.text}</p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      Komentarų nėra
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reminders' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pridėti priminimą</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Pavadinimas"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />

                    <input
                      type="date"
                      value={newReminder.due_date}
                      onChange={(e) => setNewReminder(prev => ({ ...prev, due_date: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={handleAddReminder}
                    disabled={!newReminder.title.trim() || !newReminder.due_date}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pridėti priminimą
                  </button>
                </div>
                
                <div className="space-y-3">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white">{reminder.title}</h5>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Iki: {formatDate(reminder.due_date)}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={reminder.is_completed}
                          onChange={async (e) => {
                            try {
                              await SupabaseService.updateReminder(reminder.id, { is_completed: e.target.checked });
                              setReminders(prev => prev.map(r => 
                                r.id === reminder.id ? { ...r, is_completed: e.target.checked } : r
                              ));
                            } catch (error) {
                              console.error('Failed to update reminder:', error);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                  {reminders.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      Priminimų nėra
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pridėti failą</h4>
                  <div className="flex items-center space-x-3">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <PaperClipIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div key={file.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <PaperClipIcon className="w-8 h-8 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.filename}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex space-x-2">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Peržiūrėti
                        </a>
                        <button
                          onClick={async () => {
                            try {
                              await SupabaseService.deleteFile(file.id);
                              setFiles(prev => prev.filter(f => f.id !== file.id));
                            } catch (error) {
                              console.error('Failed to delete file:', error);
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Ištrinti
                        </button>
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8 col-span-full">
                      Failų nėra
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
