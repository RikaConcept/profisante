import React, { useState } from 'react';
import { X } from 'lucide-react';
import { sendOrderNotification } from '../services/notifications';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
}

export default function OrderForm({ isOpen, onClose, productName }: OrderFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await sendOrderNotification({
        ...formData,
        productName
      });

      if (!result.success) {
        throw new Error('Échec de l\'envoi de la commande');
      }

      setFormData({ name: '', phone: '', location: '' });
      onClose();
      alert('Votre commande a été enregistrée avec succès ! Nous vous contacterons bientôt.');
    } catch (error) {
      setSubmitError('Une erreur est survenue. Veuillez réessayer.');
      console.error('Erreur de soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold mb-4">Commander {productName}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu de livraison
            </label>
            <textarea
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>

          {submitError && (
            <div className="text-red-600 text-sm">{submitError}</div>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Envoi en cours...' : 'Confirmer la commande'}
          </button>
        </form>
      </div>
    </div>
  );
}