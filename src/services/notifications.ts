import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_qg6hsuc';
const EMAILJS_TEMPLATE_ID = 'template_9nup6xb';
const EMAILJS_PUBLIC_KEY = '-su_AKiGdDwbxpKvT';

export const sendOrderNotification = async (orderData: {
  name: string;
  phone: string;
  location: string;
  productName: string;
}) => {
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: 'profisante@gmail.com',
        customer_name: orderData.name,
        customer_phone: orderData.phone,
        customer_location: orderData.location,
        product_name: orderData.productName,
      },
      EMAILJS_PUBLIC_KEY
    );

    return { success: true };
  } catch (error) {
    console.error('Notification error:', error);
    return { success: false, error };
  }
};