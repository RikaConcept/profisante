import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  title: string;
  description: string;
  price: number;
  discount: number;
  image: string;
  onBuy: () => void;
}

export default function ProductCard({ 
  title, 
  description, 
  price, 
  discount, 
  image, 
  onBuy 
}: ProductCardProps) {
  const finalPrice = price - discount;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition hover:scale-105">
      <div className="relative h-64">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://via.placeholder.com/400x300?text=Image+non+disponible';
          }}
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-2xl font-bold text-purple-600">{finalPrice.toLocaleString()} FCFA</span>
            {discount > 0 && (
              <span className="ml-2 text-sm line-through text-gray-400">
                {price.toLocaleString()} FCFA
              </span>
            )}
          </div>
          {discount > 0 && (
            <span className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">
              -{discount.toLocaleString()} FCFA
            </span>
          )}
        </div>
        <button
          onClick={onBuy}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition"
        >
          <ShoppingCart size={20} />
          Acheter
        </button>
      </div>
    </div>
  );
}