import React, { useState, useEffect } from 'react';
import { Package, Receipt, Download, Mail, X, ShoppingCart, Plus, Minus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, updateDoc, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

const firebaseConfig = {
  apiKey: "AIzaSyA7m8B6viZif6UIB-MtocxpbpYwDgKYzdU",
  authDomain: "rr-pos-system.firebaseapp.com",
  projectId: "rr-pos-system",
  storageBucket: "rr-pos-system.firebasestorage.app",
  messagingSenderId: "252327523307",
  appId: "1:252327523307:web:f2a52f195de36b3f4ddfae",
  measurementId: "G-G944RLNKYT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Initialize EmailJS
emailjs.init("9NLEYJK7abrNW-HiS");

export default function ClothingPOS() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [activeTab, setActiveTab] = useState('stock');
  const [salesHistory, setSalesHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
const [searchDate, setSearchDate] = useState('');
const [quantityToSell, setQuantityToSell] = useState(1);
const [selectedSize, setSelectedSize] = useState('');
const [customerEmail, setCustomerEmail] = useState('');
const [showExchangeModal, setShowExchangeModal] = useState(false);
const [exchangeReceipt, setExchangeReceipt] = useState(null);
const [exchangeProduct, setExchangeProduct] = useState(null);
const [exchangeSize, setExchangeSize] = useState('');
const [exchangeQuantity, setExchangeQuantity] = useState(1);const [returnQuantity, setReturnQuantity] = useState(1);
const [showReturnModal, setShowReturnModal] = useState(false);
const [returnReceipt, setReturnReceipt] = useState(null);


  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSalesHistory(salesData);
    });
    return () => unsubscribe();
  }, []);

 const openProductModal = (product) => {
  setSelectedProduct(product);
  setQuantityToSell(1);
  setSelectedSize('');
  setCustomerEmail('');
  setShowProductModal(true);
};


  const closeProductModal = () => {
  setShowProductModal(false);
  setSelectedProduct(null);
};




const openReturnModal = (receipt) => {
  setReturnReceipt(receipt);
  setReturnQuantity(1);
  setShowReturnModal(true);
};

const handleReturn = async () => {
  if (!returnReceipt) return;

  if (returnQuantity <= 0 || returnQuantity > returnReceipt.quantity) {
    alert('Invalid return quantity');
    return;
  }

  if (!window.confirm(`Are you sure you want to return ${returnQuantity} unit(s) of ${returnReceipt.productName} (Size ${returnReceipt.size})?`)) {
    return;
  }

  try {
    const product = products.find(p => p.id === returnReceipt.productId);
    
    if (!product) {
      alert('Product not found in inventory');
      return;
    }

    // Update the product stock
    const productRef = doc(db, 'products', returnReceipt.productId);
    const updatedSizes = { ...product.sizes };
    updatedSizes[returnReceipt.size] = (updatedSizes[returnReceipt.size] || 0) + returnQuantity;

    await updateDoc(productRef, {
      stock: product.stock + returnQuantity,
      sizes: updatedSizes
    });

    // If returning all items, mark as fully returned
   // Mark the sale record based on return type
const saleRef = doc(db, 'sales', returnReceipt.id);
if (returnQuantity === returnReceipt.quantity) {
  // Full return - mark as returned
  await updateDoc(saleRef, {
    returned: true,
    returnedAt: new Date().toISOString()
  });
} else {
  // Partial return - update quantities and total
  const newQuantity = returnReceipt.quantity - returnQuantity;
  const newTotal = newQuantity * returnReceipt.pricePerUnit;
  
  await updateDoc(saleRef, {
    quantity: newQuantity,
    total: newTotal,
    partialReturn: true,
    returnedQuantity: (returnReceipt.returnedQuantity || 0) + returnQuantity,
    lastReturnAt: new Date().toISOString()
  });
}

    setShowReturnModal(false);
    alert(`✅ Return processed successfully!\n${returnQuantity} unit(s) of size ${returnReceipt.size} have been returned to stock.`);
  } catch (error) {
    console.error('Error processing return:', error);
    alert('❌ Failed to process return. Please try again.');
  }
};


const completeSale = async () => {
    // Check selectedProduct FIRST
    if (!selectedProduct) {
      alert('No product selected');
      return;
    }

  // DEBUG: Log the selected product to see what data we have
  console.log('Selected Product:', selectedProduct);
  console.log('Product Name:', selectedProduct.name);
  console.log('Product SKU:', selectedProduct.sku);
  console.log('Product Price:', selectedProduct.price);

  // Handle the field name with trailing space (from Firestore)
  const productName = selectedProduct.name || selectedProduct['name '] || '';
  
  // Verify all required fields exist
  if (!productName || !selectedProduct.sku || !selectedProduct.price) {
    alert('Product data is incomplete. Please try selecting the product again.');
    console.error('Missing product fields:', {
      name: productName,
      sku: selectedProduct.sku,
      price: selectedProduct.price,
      stock: selectedProduct.stock
    });
    return;
  }

  if (!customerEmail || !customerEmail.includes('@')) {
    alert('Please enter a valid email address');
    return;
  }

  if (quantityToSell <= 0 || quantityToSell > selectedProduct.stock) {
    alert('Invalid quantity');
    return;
  }

 try {
    if (!selectedSize) {
      alert('Please select a size');
      return;
    }

    const productRef = doc(db, 'products', selectedProduct.id);
    
    // Check if size exists and has enough stock
    if (!selectedProduct.sizes || !selectedProduct.sizes[selectedSize]) {
      alert('Size not available');
      return;
    }
    
    const currentSizeStock = selectedProduct.sizes[selectedSize];
    if (quantityToSell > currentSizeStock) {
      alert(`Not enough stock for size ${selectedSize}. Available: ${currentSizeStock}`);
      return;
    }

    // Update both total stock and size-specific stock
    const updatedSizes = { ...selectedProduct.sizes };
    updatedSizes[selectedSize] = currentSizeStock - quantityToSell;

    await updateDoc(productRef, {
      stock: selectedProduct.stock - quantityToSell,
      sizes: updatedSizes
    });

       const total = selectedProduct.price * quantityToSell;

    const receipt = {
      productId: selectedProduct.id,
      productName: productName,
      sku: selectedProduct.sku,
      size: selectedSize,
      quantity: quantityToSell,
      pricePerUnit: selectedProduct.price,
      total: total,
      customerEmail: customerEmail,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString('en-ZA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    console.log('Receipt object before saving:', receipt);

    const docRef = await addDoc(collection(db, 'sales'), receipt);
    
    const receiptWithId = { ...receipt, id: docRef.id };
    setLastReceipt(receiptWithId);
    
    // Auto-send email to customer
    await emailReceipt(receiptWithId);
    
    setShowProductModal(false);
    setShowSuccessModal(true);
    setSelectedProduct(null);

  } catch (error) {
    console.error('Error completing sale:', error);
    alert('Error completing sale. Please try again.');
  }
};



    const openExchangeModal = (receipt) => {
  setExchangeReceipt(receipt);
  setExchangeProduct(null);
  setExchangeSize('');
  setExchangeQuantity(receipt.quantity);
  setShowExchangeModal(true);
};

const handleExchange = async () => {
  if (!exchangeProduct || !exchangeSize) {
    alert('Please select a product and size for exchange');
    return;
  }

  if (exchangeQuantity <= 0) {
    alert('Invalid quantity');
    return;
  }

  try {
    const originalProduct = products.find(p => p.id === exchangeReceipt.productId);
    const newProduct = products.find(p => p.id === exchangeProduct.id);

    if (!originalProduct || !newProduct) {
      alert('Product not found in inventory');
      return;
    }

    // Check if new product has enough stock
    if (!newProduct.sizes || !newProduct.sizes[exchangeSize]) {
      alert('Size not available');
      return;
    }

    if (exchangeQuantity > newProduct.sizes[exchangeSize]) {
      alert(`Not enough stock for size ${exchangeSize}. Available: ${newProduct.sizes[exchangeSize]}`);
      return;
    }

    // Return original product to stock
    // Return original product to stock
// Check if exchanging within the same product or different products
// Check if exchanging within the same product or different products
if (exchangeReceipt.productId === exchangeProduct.id) {
  // Same product - only update size distribution, total stock stays the same
  const productRef = doc(db, 'products', exchangeReceipt.productId);
  const updatedSizes = { ...originalProduct.sizes };
  
  // Check if exchanging the same size (shouldn't happen, but just in case)
  if (exchangeReceipt.size === exchangeSize) {
    alert('Cannot exchange for the same size. Please select a different size.');
    return;
  }
  
  // Add back the original size (what customer is returning)
  updatedSizes[exchangeReceipt.size] = (updatedSizes[exchangeReceipt.size] || 0) + exchangeReceipt.quantity;
  
  // Deduct the new size (what customer is taking)
  updatedSizes[exchangeSize] = (updatedSizes[exchangeSize] || 0) - exchangeQuantity;
  
  await updateDoc(productRef, {
    sizes: updatedSizes
    // Note: stock stays the same because we're returning items and taking items!
  });
} else {
  // Different products - update both products
  
  // Return original product to stock
  const originalProductRef = doc(db, 'products', exchangeReceipt.productId);
  const originalUpdatedSizes = { ...originalProduct.sizes };
  originalUpdatedSizes[exchangeReceipt.size] = (originalUpdatedSizes[exchangeReceipt.size] || 0) + exchangeReceipt.quantity;
  
  await updateDoc(originalProductRef, {
    stock: originalProduct.stock + exchangeReceipt.quantity,
    sizes: originalUpdatedSizes
  });
  
  // Deduct new product from stock
  const newProductRef = doc(db, 'products', exchangeProduct.id);
  const newUpdatedSizes = { ...newProduct.sizes };
  newUpdatedSizes[exchangeSize] = newUpdatedSizes[exchangeSize] - exchangeQuantity;
  
  await updateDoc(newProductRef, {
    stock: newProduct.stock - exchangeQuantity,
    sizes: newUpdatedSizes
  });
}

    // Calculate price difference
    const originalTotal = exchangeReceipt.total;
    const newTotal = exchangeProduct.price * exchangeQuantity;
    const priceDifference = newTotal - originalTotal;

    // Create exchange record
    const exchangeRecord = {
      type: 'exchange',
      originalReceiptId: exchangeReceipt.id,
      originalProduct: {
        id: exchangeReceipt.productId,
        name: exchangeReceipt.productName,
        sku: exchangeReceipt.sku,
        size: exchangeReceipt.size,
        quantity: exchangeReceipt.quantity,
        price: exchangeReceipt.pricePerUnit
      },
      newProduct: {
        id: exchangeProduct.id,
        name: exchangeProduct.name || exchangeProduct['name '] || '',
        sku: exchangeProduct.sku,
        size: exchangeSize,
        quantity: exchangeQuantity,
        price: exchangeProduct.price
      },
      priceDifference: priceDifference,
      total: newTotal,
      customerEmail: exchangeReceipt.customerEmail,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString('en-ZA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    await addDoc(collection(db, 'sales'), exchangeRecord);

    // Mark original sale as exchanged
    const saleRef = doc(db, 'sales', exchangeReceipt.id);
    await updateDoc(saleRef, {
      exchanged: true,
      exchangedAt: new Date().toISOString()
    });

    setShowExchangeModal(false);
    alert(`✅ Exchange processed successfully!\n${priceDifference >= 0 ? 'Amount to collect: R' + priceDifference.toFixed(2) : 'Refund amount: R' + Math.abs(priceDifference).toFixed(2)}`);
  } catch (error) {
    console.error('Error processing exchange:', error);
    alert('❌ Failed to process exchange. Please try again.');
  }
};

    // Update the product stock
   
const downloadReceipt = (receipt) => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 600;

    const renderReceipt = (logoImg) => {
      // Background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Logo
      if (logoImg) {
        const logoWidth = 120;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        ctx.drawImage(logoImg, (canvas.width - logoWidth) / 2, 20, logoWidth, logoHeight);
      }
      
      // Company name
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('R&R AGENCIES', canvas.width / 2, logoImg ? 140 : 50);
      
      // Receipt number
      ctx.font = '16px Arial';
      ctx.fillStyle = '#374151';
      ctx.fillText(`Receipt #${receipt.id.slice(0, 8).toUpperCase()}`, canvas.width / 2, logoImg ? 170 : 80);
      
      // Date
      ctx.font = '14px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(receipt.date, canvas.width / 2, logoImg ? 195 : 105);
      
      // Divider
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, logoImg ? 220 : 130);
      ctx.lineTo(360, logoImg ? 220 : 130);
      ctx.stroke();
      
      // Product details
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#111827';
      ctx.fillText('Product Details', 40, logoImg ? 250 : 160);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#374151';
      ctx.fillText(`Product: ${receipt.productName}`, 40, logoImg ? 280 : 190);
      ctx.fillText(`SKU: ${receipt.sku} | Size: ${receipt.size}`, 40, logoImg ? 305 : 215);
      ctx.fillText(`Quantity: ${receipt.quantity}`, 40, logoImg ? 330 : 240);
      ctx.fillText(`Price per unit: R${receipt.pricePerUnit.toFixed(2)}`, 40, logoImg ? 355 : 265);
      
      // Customer email
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#111827';
      ctx.fillText('Customer', 40, logoImg ? 395 : 305);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#374151';
      ctx.fillText(receipt.customerEmail, 40, logoImg ? 420 : 330);
      
      // Divider
      ctx.beginPath();
      ctx.moveTo(40, logoImg ? 445 : 355);
      ctx.lineTo(360, logoImg ? 445 : 355);
      ctx.stroke();
      
      // Total
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText('TOTAL:', 40, logoImg ? 480 : 390);
      ctx.textAlign = 'right';
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#0ea5e9';
      ctx.fillText(`R${receipt.total.toFixed(2)}`, 360, logoImg ? 480 : 390);
      
      // Footer
      ctx.textAlign = 'center';
      ctx.font = '12px Arial';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('Thank you for your business!', canvas.width / 2, logoImg ? 540 : 450);
      ctx.fillText('www.randragencies.online', canvas.width / 2, logoImg ? 560 : 470);
      
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `receipt-${receipt.id}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    const logoBase64 = 'data:image/png;base64,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'; // PASTE YOUR BASE64 STRING HERE
   // Load logo and render receipt
    const logo = new Image();
    logo.onload = () => renderReceipt(logo);
    logo.onerror = () => renderReceipt(null);
    logo.src = logoBase64;

  } catch (error) {
    console.error('Error generating receipt:', error);
    alert('Failed to generate receipt. Please try again.');
  }
};

const emailReceipt = async (receipt) => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 600;

    const renderReceipt = (logoImg) => {
      // Clear canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add your receipt rendering logic here
      ctx.fillStyle = 'black';
      ctx.font = '20px Arial';
      ctx.fillText('R&R AGENCIES', 150, 50);
      ctx.font = '14px Arial';
      ctx.fillText(`Receipt #${receipt.id.slice(0, 8)}`, 20, 100);
      ctx.fillText(`Product: ${receipt.productName}`, 20, 130);
      ctx.fillText(`Quantity: ${receipt.quantity}`, 20, 160);
      ctx.fillText(`Total: R${receipt.total.toFixed(2)}`, 20, 190);
    };

    const renderReceiptAndSend = (logoImg = null) => {
      renderReceipt(logoImg);
      
      // Convert canvas to base64 string
      canvas.toBlob(async (blob) => {
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          
          try {
           const templateParams = {
    to_email: receipt.customerEmail,
    receipt_number: receipt.id.slice(0, 8).toUpperCase(),
    customer_email: receipt.customerEmail,
    product_name: receipt.productName,
    sku: receipt.sku,
    size: receipt.size,
    quantity: receipt.quantity,
    price_per_unit: `R${receipt.pricePerUnit.toFixed(2)}`,
    total_amount: `R${receipt.total.toFixed(2)}`,
    date: receipt.date,
    company_name: "R&R AGENCIES",
    company_website: "www.randragencies.online",
    company_email: "info@randragencies.online",
    receipt_image: base64data
};

            // Send email using EmailJS
            const response = await emailjs.send(
              'service_0lqd7mk',
              'template_1jx77au',
              templateParams
            );

            if (response.status === 200) {
              alert(`✅ Receipt successfully sent to ${receipt.customerEmail}`);
            }
          } catch (error) {
            console.error('Error sending email:', error);
            alert(`❌ Failed to send receipt. Error: ${error.text || error.message}`);
          } finally {
            // Reset button text
            if (event?.target && originalText) {
              event.target.textContent = originalText;
            }
          }
        };
      }, 'image/png');
    };

    const logoBase64 = 'data:image/png;base64,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'; // PASTE YOUR BASE64 STRING HERE
    
    if (logoBase64) {
      const logo = new Image();
      logo.onload = () => renderReceiptAndSend(logo);
      logo.onerror = () => renderReceiptAndSend(null);
      logo.src = logoBase64;
    } else {
      renderReceiptAndSend(null);
    }
    
  } catch (error) {
    console.error('Error in emailReceipt:', error);
    alert('Failed to send receipt email. Please try again.');
  }
};

 const filteredSales = salesHistory.filter(sale => {
  const emailMatch = searchEmail === '' || 
    (sale.customerEmail && sale.customerEmail.toLowerCase().includes(searchEmail.toLowerCase()));
  
  const dateMatch = searchDate === '' || 
    (sale.date && sale.date.includes(searchDate));
  
  return emailMatch && dateMatch;
});

  return (
   <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #dbeafe 0%, #f0f9ff 50%, #e0f2fe 100%)' }}>
      <style>{`
        html, body, #root {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        * {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      
      <nav style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.1), 0 2px 4px -1px rgba(37, 99, 235, 0.06)', borderBottom: '2px solid #dbeafe' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '4rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #2563eb, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              R&R POS System
            </h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setActiveTab('stock')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.5rem',
                  background: activeTab === 'stock' ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                  color: activeTab === 'stock' ? 'white' : '#4b5563',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Package style={{ width: '20px', height: '20px', marginRight: '0.5rem' }} />
                Stock
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.5rem',
                  background: activeTab === 'sales' ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                  color: activeTab === 'sales' ? 'white' : '#4b5563',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Receipt style={{ width: '20px', height: '20px', marginRight: '0.5rem' }} />
                Sales
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem' }}>
        {activeTab === 'stock' && (
          <div style={{ background: 'white', borderRadius: '1.5rem', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05)', border: '2px solid #dbeafe' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#111827' }}>Product Inventory</h2>
              {products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
                  <Package style={{ width: '64px', height: '64px', margin: '0 auto 0.75rem', opacity: '0.5' }} />
                  <p>No products in database</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>Image</th>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>Product Name</th>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>SKU</th>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>Price</th>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>Stock</th>
                        <th style={{ textAlign: 'left', padding: '1.25rem 1rem', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1e40af', borderBottom: '2px solid #bfdbfe' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id} style={{ background: 'white', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(90deg, #ffffff 0%, #eff6ff 100%)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                          <td style={{ padding: '1.25rem 1rem' }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0.75rem', border: '2px solid #dbeafe' }} /> : <div style={{ width: '64px', height: '64px', background: '#dbeafe', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package style={{ width: '32px', height: '32px', color: '#93c5fd' }} /></div>}</td>
                          <td style={{ padding: '1.25rem 1rem', fontWeight: '600', color: '#111827' }}>{product.name}</td>
                          <td style={{ padding: '1.25rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{product.sku}</td>
                          <td style={{ padding: '1.25rem 1rem', fontSize: '1.125rem', fontWeight: '800', color: '#2563eb' }}>R{product.price}</td>
                          <td style={{ padding: '1.25rem 1rem' }}><span style={{ padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: '700', background: product.stock === 0 ? '#fee2e2' : product.stock < 5 ? '#fef3c7' : '#e0f2fe', color: product.stock === 0 ? '#991b1b' : product.stock < 5 ? '#92400e' : '#0369a1', display: 'inline-block' }}>{product.stock}</span></td>
                          <td style={{ padding: '1.25rem 1rem' }}><button onClick={() => openProductModal(product)} style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={{ background: 'white', borderRadius: '1.5rem', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05)', border: '2px solid #dbeafe' }}>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input type="text" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="Search by email..." style={{ flex: '1', minWidth: '250px', padding: '0.75rem 1rem', border: '2px solid #bfdbfe', borderRadius: '0.75rem', fontSize: '0.875rem', background: 'white', color: '#000' }} />
<input type="text" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} placeholder="Search by date..." style={{ flex: '1', minWidth: '250px', padding: '0.75rem 1rem', border: '2px solid #bfdbfe', borderRadius: '0.75rem', fontSize: '0.875rem', background: 'white', color: '#000' }} />
                {(searchEmail || searchDate) && (
                  <button onClick={() => { setSearchEmail(''); setSearchDate(''); }} style={{ padding: '0.75rem 1.5rem', background: '#ef4444', border: 'none', borderRadius: '0.75rem', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Clear</button>
                )}
              </div>

              {filteredSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
                  <Receipt style={{ width: '64px', height: '64px', margin: '0 auto 0.75rem', opacity: '0.5' }} />
                  <p>No sales found</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {filteredSales.map((receipt) => (
                    <div key={receipt.id} style={{ border: '2px solid #dbeafe', borderRadius: '1rem', padding: '1rem', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#111827' }}>Receipt #{receipt.id.slice(0, 8)}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{receipt.date}</div>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>{receipt.customerEmail}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0ea5e9' }}>R{receipt.total ? receipt.total.toFixed(2) : '0.00'}</div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button onClick={() => downloadReceipt(receipt)} style={{ color: '#2563eb', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
                            <button onClick={() => emailReceipt(receipt)} style={{ color: '#0ea5e9', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}>Email</button>
                          <button onClick={() => openReturnModal(receipt)} disabled={receipt.returned || receipt.exchanged} style={{ color: (receipt.returned || receipt.exchanged) ? '#9ca3af' : '#ef4444', fontSize: '0.875rem', background: 'none', border: 'none', cursor: (receipt.returned || receipt.exchanged) ? 'not-allowed' : 'pointer' }}>{receipt.returned ? 'Returned' : receipt.exchanged ? 'Exchanged' : 'Return'}</button>
                            {!receipt.returned && (
                              <button onClick={() => openExchangeModal(receipt)} style={{ color: '#8b5cf6', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}>Exchange</button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.875rem', background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' ,'color': '#1e3a8a'  }}>
                          <span>{receipt.productName} ({receipt.sku}) - Size {receipt.size}</span>
                          <span>{receipt.quantity}x R{receipt.pricePerUnit ? receipt.pricePerUnit.toFixed(2) : '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showProductModal && selectedProduct && (
        <div style={{ position: 'fixed', inset: '0', background: 'rgba(30, 64, 175, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: '50' }}>
          <div style={{ background: 'white', borderRadius: '1rem', maxWidth: '48rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.25)', border: '2px solid #dbeafe' }}>
            <div style={{ position: 'sticky', top: '0', background: 'white', borderBottom: '1px solid #e5e7eb', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: '10' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Product Details</h3>
              <button onClick={closeProductModal} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div>
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ width: '100%', borderRadius: '0.5rem', border: '2px solid #dbeafe', maxHeight: '400px', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '100%', height: '256px', background: '#dbeafe', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package style={{ width: '96px', height: '96px', color: '#93c5fd' }} />
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>{selectedProduct.name}</h4>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>SKU: {selectedProduct.sku}</div>
                  <div style={{ fontSize: '1.875rem', fontWeight: '700', color: '#2563eb', marginBottom: '1.5rem' }}>R{selectedProduct.price}</div>
                  
                  <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '600', color: '#1e3a8a' }}>Current Stock:</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0369a1' }}>{selectedProduct.stock}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <h5 style={{ fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', fontSize: '1.125rem' }}>
                      <ShoppingCart style={{ width: '20px', height: '20px', marginRight: '0.5rem' }} />
                      Make a Sale
                    </h5>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#1e3a8a', marginBottom: '0.5rem' }}>Size</label>
                     <select value={selectedSize} onChange={(e) => { setSelectedSize(e.target.value); setQuantityToSell(1); }} disabled={selectedProduct.stock === 0} style={{ width: '100%', padding: '0.5rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }}>
                        <option value="">-- Select a size --</option>
                        {selectedProduct.sizes && Object.entries(selectedProduct.sizes).map(([size, sizeStock]) => (
                          <option key={size} value={size} disabled={sizeStock === 0}>
                            {size} ({sizeStock} available)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#1e3a8a', marginBottom: '0.5rem' }}>Quantity</label>
                    <input type="number" min="1" max={selectedSize && selectedProduct.sizes ? selectedProduct.sizes[selectedSize] : 0} value={quantityToSell} onChange={(e) => setQuantityToSell(Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedSize && selectedProduct.sizes ? selectedProduct.sizes[selectedSize] : 0))} disabled={!selectedSize || selectedProduct.stock === 0} style={{ width: '100%', padding: '0.5rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }} />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#1e3a8a', marginBottom: '0.5rem' }}>Customer Email</label>
                     <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="customer@example.com" disabled={selectedProduct.stock === 0} style={{ width: '100%', padding: '0.5rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }} />
                    </div>

                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', color: '#1e3a8a' }}>Total:</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e3a8a' }}>R{(selectedProduct.price * quantityToSell).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button onClick={completeSale} disabled={!customerEmail || !customerEmail.includes('@') || selectedProduct.stock === 0} style={{ width: '100%', background: (!customerEmail || !customerEmail.includes('@') || selectedProduct.stock === 0) ? '#d1d5db' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: (!customerEmail || !customerEmail.includes('@') || selectedProduct.stock === 0) ? 'not-allowed' : 'pointer', fontSize: '1rem' }}>
                      {selectedProduct.stock === 0 ? 'Out of Stock' : 'Complete Sale'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && lastReceipt && (
        <div style={{ position: 'fixed', inset: '0', background: 'rgba(30, 64, 175, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: '50' }}>
          <div style={{ background: 'white', borderRadius: '1rem', maxWidth: '28rem', width: '100%', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.25)', border: '2px solid #dbeafe' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '64px', height: '64px', background: '#e0f2fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <svg style={{ width: '32px', height: '32px', color: '#0369a1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Sale Complete!</h2>
              <p style={{ color: '#6b7280' }}>Receipt sent to {lastReceipt.customerEmail}</p>
            </div>

            <div style={{ borderTop: '1px dashed #e5e7eb', borderBottom: '1px dashed #e5e7eb', paddingTop: '1rem', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Receipt #{lastReceipt.id.slice(0, 8)}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: '700', color: '#0ea5e9', marginBottom: '0.75rem' }}>R{lastReceipt.total.toFixed(2)}</div>
              
              <div style={{ textAlign: 'left', fontSize: '0.875rem', background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lastReceipt.quantity}x {lastReceipt.productName}</span>
                  <span>R{lastReceipt.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => downloadReceipt(lastReceipt)} style={{ width: '100%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                <Download style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                Download Receipt
              </button>
              <button onClick={() => setShowSuccessModal(false)} style={{ width: '100%', border: '2px solid #e5e7eb', color: '#374151', padding: '0.5rem', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showExchangeModal && exchangeReceipt && (
        <div style={{ position: 'fixed', inset: '0', background: 'rgba(139, 92, 246, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: '50' }}>
          <div style={{ background: 'white', borderRadius: '1rem', maxWidth: '48rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.25)', border: '2px solid #a78bfa' }}>
            <div style={{ position: 'sticky', top: '0', background: 'white', borderBottom: '1px solid #e5e7eb', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: '10' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#7c3aed' }}>Process Exchange</h3>
              <button onClick={() => setShowExchangeModal(false)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ background: '#faf5ff', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ fontWeight: '600', color: '#7c3aed', marginBottom: '0.5rem' }}>Original Purchase</h4>
               <div style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                  <div style={{ color: '#1f2937' }}>{exchangeReceipt.productName} - Size {exchangeReceipt.size}</div>
                 <div style={{ color: '#1f2937' }}>{exchangeReceipt.quantity}x R{exchangeReceipt.pricePerUnit}</div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#7c3aed', marginBottom: '0.5rem' }}>
                  Select Product to Exchange
                </label>
                <select onChange={(e) => { const product = products.find(p => p.id === e.target.value); setExchangeProduct(product || null); setExchangeSize(''); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #a78bfa', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }}>
                  <option value="">-- Select a product --</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} (R{product.price})
                    </option>
                  ))}
                </select>
              </div>

              {exchangeProduct && (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#7c3aed', marginBottom: '0.5rem' }}>
                      Select Size
                    </label>
                   <select value={exchangeSize} onChange={(e) => setExchangeSize(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid #a78bfa', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }}>
                      <option value="">-- Select a size --</option>
                      {exchangeProduct.sizes && Object.entries(exchangeProduct.sizes).map(([size, stock]) => (
                        <option key={size} value={size} disabled={stock === 0}>
                          {size} ({stock} available)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#7c3aed', marginBottom: '0.5rem' }}>
                      Quantity
                    </label>
                    <input type="number" min="1" max={exchangeSize && exchangeProduct.sizes ? exchangeProduct.sizes[exchangeSize] : 0} value={exchangeQuantity} onChange={(e) => setExchangeQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), exchangeSize && exchangeProduct.sizes ? exchangeProduct.sizes[exchangeSize] : 0))} style={{ width: '100%', padding: '0.75rem', border: '2px solid #a78bfa', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }} />
                  </div>

                  <button onClick={handleExchange} style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
                    Process Exchange
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showReturnModal && returnReceipt && (
  <div style={{ position: 'fixed', inset: '0', background: 'rgba(239, 68, 68, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: '50' }}>
    <div style={{ background: 'white', borderRadius: '1rem', maxWidth: '28rem', width: '100%', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)', border: '2px solid #fecaca' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>Process Return</h3>
        <button onClick={() => setShowReturnModal(false)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X style={{ width: '24px', height: '24px' }} />
        </button>
      </div>

      <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
        <h4 style={{ fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>Original Purchase</h4>
        <div style={{ fontSize: '0.875rem', color: '#1f2937' }}>
          <div>{returnReceipt.productName} - Size {returnReceipt.size}</div>
          <div>Quantity purchased: {returnReceipt.quantity}</div>
          <div>Price per unit: R{returnReceipt.pricePerUnit.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>
          Quantity to Return
        </label>
        <input 
          type="number" 
          min="1" 
          max={returnReceipt.quantity} 
          value={returnQuantity} 
          onChange={(e) => setReturnQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), returnReceipt.quantity))} 
          style={{ width: '100%', padding: '0.75rem', border: '2px solid #fecaca', borderRadius: '0.5rem', fontSize: '1rem', color: '#000', background: 'white' }} 
        />
      </div>

      <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '2px solid #fecaca' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '600', color: '#dc2626' }}>Refund Amount:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>R{(returnReceipt.pricePerUnit * returnQuantity).toFixed(2)}</span>
        </div>
      </div>

      <button 
        onClick={handleReturn} 
        style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
      >
        Process Return
      </button>
    </div>
  </div>
)}
    </div>
  );
}