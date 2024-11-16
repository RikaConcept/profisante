import React, { useState } from 'react';
import CountdownTimer from './components/CountdownTimer';
import ProductCard from './components/ProductCard';
import OrderForm from './components/OrderForm';
import { Phone } from 'lucide-react';
import { products } from './data/products';

function App() {
  const [orderForm, setOrderForm] = useState({ isOpen: false, productName: '' });
  const [isOfferExpired, setIsOfferExpired] = useState(false);

  const testimonials = [
    {
      id: "video1",
      url: "https://www.youtube.com/embed/your-video-id-1"
    },
    {
      id: "video2",
      url: "https://www.youtube.com/embed/your-video-id-2"
    }
  ];

  const currentProducts = products.map(product => ({
    ...product,
    discount: isOfferExpired ? 0 : product.discount
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-600 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-center">ProfiSanté</h1>
          <p className="text-center mt-2">Votre partenaire santé et bien-être</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-4">
            {isOfferExpired ? 'Offre Terminée' : 'Offre Spéciale - Temps Restant'}
          </h2>
          <CountdownTimer onExpire={() => setIsOfferExpired(true)} />
          {isOfferExpired && (
            <p className="text-center mt-4 text-red-600">
              Les offres promotionnelles sont terminées. Les prix affichés sont les prix réguliers.
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {currentProducts.map((product) => (
            <ProductCard
              key={product.title}
              {...product}
              onBuy={() => setOrderForm({ 
                isOpen: true, 
                productName: product.title 
              })}
            />
          ))}
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            Témoignages de nos clients satisfaits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((video) => (
              <div key={video.id} className="aspect-w-16 aspect-h-9">
                <iframe
                  src={video.url}
                  title="Témoignage client"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-purple-100 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Besoin de plus d'informations ?</h2>
          <p className="mb-4">Contactez-nous sur WhatsApp pour toute question</p>
          <a
            href="https://wa.me/0596108695"
            className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition"
          >
            <Phone size={20} />
            Contactez-nous sur WhatsApp
          </a>
        </section>
      </main>

      <OrderForm
        isOpen={orderForm.isOpen}
        onClose={() => setOrderForm({ isOpen: false, productName: '' })}
        productName={orderForm.productName}
      />
    </div>
  );
}

export default App;