'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Coffee, Heart, Menu, Minus, Package, Plus, QrCode, ShoppingBag, Sparkles, X } from 'lucide-react';

const productVisuals = { mini: '/images/tiramio-open-mini.webp', classic: '/images/tiramio-open-classic.webp', share: '/images/tiramio-open-share.webp' };
const products = [
  { id: 'mini', name: 'TiraMio Mini', weight: '100 g', price: 69, referencePrice: 69, saving: 0, description: 'Your personal pause. Just enough to make the day sweeter.', image: productVisuals.mini, tag: 'PERSONAL TREAT', unitValue: '₹69 / 100 g', valueNote: 'A lovely little treat' },
  { id: 'classic', name: 'TiraMio Classic', weight: '200 g', price: 129, referencePrice: 138, saving: 9, description: 'The just-right box for your favourite dessert moment.', image: productVisuals.classic, tag: 'MOST LOVED · SAVE ₹9', unitValue: '₹64.50 / 100 g', valueNote: 'Save ₹9 compared with two Mini boxes' },
  { id: 'share', name: 'TiraMio Share Box', weight: '300 g', price: 189, referencePrice: 207, saving: 18, description: 'More layers, more spoons, more reasons to gather.', image: productVisuals.share, tag: 'BEST VALUE · SAVE ₹18', unitValue: '₹63 / 100 g', valueNote: 'Save ₹18 compared with three Mini boxes' }
];
const api = process.env.NEXT_PUBLIC_API_URL || '';
const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918433198122';
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Reveal({ children, className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.16 }} transition={{ duration: reduce ? 0 : .7, delay, ease: [.2, .7, .25, 1] }}>{children}</motion.div>;
}

export default function Storefront() {
  const [catalogue, setCatalogue] = useState(products);
  const [qty, setQty] = useState({ mini: 0, classic: 0, share: 0 });
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', fulfilment: 'Pickup', address: '', notes: '', payment: 'Pay on pickup / delivery' });
  const [trackingForm, setTrackingForm] = useState({ orderId: '', phone: '' });

  useEffect(() => {
    if (!api) return;
    let active = true;
    fetch(`${api}/api/products`).then(response => { if (!response.ok) throw new Error('Catalogue unavailable'); return response.json(); })
      .then(data => { if (!active || !Array.isArray(data.products) || !data.products.length) return; setCatalogue(data.products.map(item => ({
        id: item.id, name: item.name, weight: `${item.weightGrams} g`, price: Number(item.price),
        referencePrice: Math.round((Number(item.weightGrams || 100) / 100) * 69),
        saving: Math.max(0, Math.round((Number(item.weightGrams || 100) / 100) * 69) - Number(item.price)),
        description: item.shortDescription || 'A little dessert moment, made for you.',
        image: productVisuals[item.id] || item.imageUrl || '/images/tiramisu-hero.jpg',
        tag: item.id === 'share' ? 'BEST VALUE · SAVE ₹18' : item.id === 'classic' ? 'MOST LOVED · SAVE ₹9' : 'PERSONAL TREAT',
        unitValue: `₹${(Number(item.price) * 100 / Number(item.weightGrams || 100)).toFixed(2).replace(/\.00$/, '')} / 100 g`,
        valueNote: item.id === 'share' ? 'Save ₹18 compared with three Mini boxes' : item.id === 'classic' ? 'Save ₹9 compared with two Mini boxes' : 'A lovely little treat'
      }))); })
      .catch(() => { /* Keep the bundled menu as a resilient fallback. */ });
    return () => { active = false; };
  }, []);

  const count = useMemo(() => Object.values(qty).reduce((sum, value) => sum + value, 0), [qty]);
  const total = useMemo(() => catalogue.reduce((sum, item) => sum + item.price * (qty[item.id] || 0), 0), [catalogue, qty]);
  const chosen = useMemo(() => catalogue.filter(item => (qty[item.id] || 0) > 0), [catalogue, qty]);
  const message = text => { setToast(text); window.clearTimeout(message.timer); message.timer = window.setTimeout(() => setToast(''), 2600); };
  const updateQty = (id, delta) => {
    setQty(old => ({ ...old, [id]: Math.max(0, (old[id] || 0) + delta) }));
    if (delta > 0) message(`${catalogue.find(p => p.id === id)?.name || 'Dessert'} added to your box.`);
  };
  const open = id => setModal(id);
  const close = () => setModal('');
  const openChat = text => { window.location.assign(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`); };
  const showCheckout = () => { if (!count) return message('Choose at least one TiraMio box first.'); open('checkout'); };

  async function loadRazorpay() {
    if (window.Razorpay) return true;
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true); script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!count || busy) return;
    if (!/^[6-9]\d{9}$/.test(form.phone)) return message('Please enter a valid 10-digit Indian mobile number.');
    if (form.fulfilment === 'Delivery' && !form.address.trim()) return message('Please add your delivery address.');
    if (form.payment === 'Online payment' && !api) return message('Online payment is not active in this preview. Configure the Express API and Razorpay keys to enable it.');
    setBusy(true);
    const payload = {
      customerName: form.name.trim(), phone: form.phone, fulfilment: form.fulfilment,
      address: form.fulfilment === 'Delivery' ? form.address.trim() : null,
      notes: form.notes.trim() || null,
      items: chosen.map(item => ({ productId: item.id, quantity: qty[item.id] }))
    };
    try {
      let orderRef = `TIRA-${Math.floor(1000 + Math.random() * 9000)}`;
      if (api) {
        const response = await fetch(`${api}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not create the order. Please try again.');
        orderRef = data.orderRef;
        if (form.payment.startsWith('Online')) {
          const loaded = await loadRazorpay();
          if (!loaded) throw new Error('Online checkout could not load. Please choose WhatsApp order instead.');
          const payResponse = await fetch(`${api}/api/payments/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderRef, phone: form.phone }) });
          const payData = await payResponse.json();
          if (!payResponse.ok) throw new Error(payData.message || 'Online payment is not configured yet.');
          const checkout = new window.Razorpay({
            key: payData.keyId, amount: payData.amount, currency: payData.currency || 'INR', name: 'TiraMio Tiramisu',
            description: `Order ${orderRef}`, order_id: payData.gatewayOrderId,
            prefill: { name: form.name, contact: form.phone }, theme: { color: '#3b1e14' },
            handler: async result => {
              const verify = await fetch(`${api}/api/payments/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderRef, phone: form.phone, ...result }) });
              const verified = await verify.json();
              if (verify.ok && verified.verified) { setQty(Object.fromEntries(catalogue.map(item => [item.id, 0]))); message(`Payment received for ${orderRef}.`); }
              else message('Payment verification is pending. Contact TiraMio with your order reference.');
            }
          });
          checkout.open(); setBusy(false); close(); return;
        }
      }
      const lines = chosen.map(item => `• ${item.name} (${item.weight}) × ${qty[item.id]} = ${money(item.price * qty[item.id])}`).join('\n');
      const text = `Hi TiraMio! I'd like to place an order.\n\nOrder reference: ${orderRef}\n${lines}\n\nSubtotal: ${money(total)}\nName: ${form.name}\nMobile: ${form.phone}\nFulfilment: ${form.fulfilment}${form.address ? `\nAddress: ${form.address}` : ''}\nPayment: ${form.payment}${form.notes ? `\nNotes: ${form.notes}` : ''}\n\nPlease confirm availability and the final total. Thank you!`;
      openChat(text); setQty(Object.fromEntries(catalogue.map(item => [item.id, 0]))); close(); message(`Order request ${orderRef} is ready in WhatsApp.`);
    } catch (error) {
      message(error.message || 'Something went wrong. Please try WhatsApp ordering.');
    } finally { setBusy(false); }
  }

  async function trackOrder(event) {
    event.preventDefault(); setTracking(null); setTrackingError('');
    if (!/^[6-9]\d{9}$/.test(trackingForm.phone)) return setTrackingError('Enter the 10-digit mobile number used for the order.');
    if (!api) return setTrackingError('Order tracking becomes live after the Express API and PostgreSQL database are connected. For now, message us on WhatsApp with your order reference.');
    try {
      const response = await fetch(`${api}/api/orders/${encodeURIComponent(trackingForm.orderId.trim())}/track?phone=${encodeURIComponent(trackingForm.phone)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'We could not find that order.');
      setTracking(data);
    } catch (error) { setTrackingError(error.message); }
  }

  const timeline = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
  const stageLabels = ['Order placed', 'Confirmed', 'Preparing', 'On the way', 'Delivered'];
  const stageDescriptions = ['Your request has reached TiraMio.', 'Your order is confirmed.', 'Your dessert is being prepared.', 'Your box is on its way.', 'Time for your first spoonful!'];
  const currentStage = tracking ? Math.max(0, timeline.indexOf(tracking.status)) : 0;

  return (
    <>
      <div className="announcement"><span className="sparkle">✦</span> A little box of happiness, made with care <span className="sparkle">✦</span></div>
      <header className="site-header" id="top">
        <a className="brand" href="#top" aria-label="TiraMio home"><span className="brand-mark"><span className="cake-stack"><i/><i/><i/></span></span><span className="brand-copy"><strong>TiraMio</strong><small>T I R A M I S U</small></span></a>
        <nav className="desktop-nav"><a href="#menu">Our menu</a><a href="#story">Our story</a><a href="#moments">The TiraMio feeling</a><a href="#track">Track order</a></nav>
        <div className="header-actions"><button className="text-button track-link" onClick={() => open('track')}>Track order <span>↗</span></button><button className="cart-trigger" onClick={() => open('cart')}><ShoppingBag size={16}/><span>Your box</span><b>{count}</b></button><button className="menu-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X/> : <Menu/>}</button></div>
      </header>
      {mobileNav && <nav className="mobile-nav open"><a onClick={() => setMobileNav(false)} href="#menu">Our menu</a><a onClick={() => setMobileNav(false)} href="#story">Our story</a><a onClick={() => setMobileNav(false)} href="#moments">The TiraMio feeling</a><a onClick={() => { setMobileNav(false); open('track'); }} href="#track">Track order</a></nav>}
      <main>
        <section className="hero section-wrap" aria-label="Welcome to TiraMio">
          <div className="hero-poster" aria-hidden="true"><img src="/images/tiramio-hero-poster.webp" alt="" /></div>
          <video
            className="hero-background-video"
            src="/videos/tiramio-scroll.mp4"
            poster="/images/tiramio-hero-poster.webp"
            autoPlay
            loop
            muted
            defaultMuted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line"/> A CLASSIC, WITH A LITTLE LOVE <span className="eyebrow-line"/></div>
              <h1>Some days call<br/>for <em>another</em><br/><span>spoonful.</span></h1>
              <p className="hero-tagline">Layers of Love, in Every Bite.</p>
              <p className="hero-desc">Meet your new little indulgence: soft coffee-kissed layers, dreamy cream and a generous snowfall of cocoa.</p>
              <div className="hero-actions">
                <a className="button button-dark" href="#menu">Choose your TiraMio <ArrowUpRight size={16}/></a>
                <button className="button button-light" onClick={() => open('qr')}><QrCode size={15}/> Scan &amp; order</button>
              </div>
              <div className="hero-proof"><span className="proof-stars">★★★★★</span><span>Made for slow moments &amp; happy spoons</span></div>
            </div>
            <div className="hero-art">
              <div className="hero-image-frame">
                <img src="/images/tiramisu-hero.jpg" alt="A close-up of TiraMio's rich mascarpone and espresso tiramisu" fetchPriority="high" />
              </div>
              <div className="hero-stamp"><span>THE</span><b>little<br/>luxury</b><span>YOU DESERVE</span><i>✦</i></div>
              <div className="hero-note"><span className="note-squiggle">〰</span> Made with<br/>a little extra love</div>
            </div>
          </div>
          <div className="hero-bottom-note"><span>01</span> THE TIRAMIO EDITION <span className="bottom-rule"/> MADE TO MAKE YOU SMILE</div>
        </section>
        <div className="ticker"><div className="ticker-track">{Array.from({length:2}).map((_,i)=><span className="ticker-set" key={i}>COFFEE-KISSED LAYERS　✳　 VELVETY CREAM　✳　 COCOA ON TOP　✳　 HAPPINESS IN A BOX　✳　</span>)}</div></div>
        <section className="menu-section section-wrap" id="menu"><Reveal className="section-heading"><div><div className="eyebrow left">THE MENU <span className="eyebrow-line"/></div><h2>Pick your <em>happy.</em></h2></div><p>Three sizes. One very good decision.<br/>Made for a little treat or a lot of sharing.</p></Reveal>
          <div className="product-grid">{catalogue.map((item,index)=>(
            <Reveal key={item.id} delay={index*.1} className={`product-card ${item.id==='classic'?'featured':''} ${item.id==='share'?'best-value':''}`}>
              <div className={`product-photo photo-${item.id}`}>
                <img className="product-open-gif" src={item.image} alt={`${item.name} open TiraMio box with tiramisu inside`} loading="lazy" decoding="async" />
                <span className={`photo-tag ${item.id!=='mini'?'featured-tag':''}`}>{item.tag}</span>
                <button className="quick-add" onClick={() => updateQty(item.id,1)} aria-label={`Add ${item.name}`}><Plus size={18}/></button>
              </div>
              <div className="product-info">
                <div className="product-meta"><span>0{index+1} / {item.id.toUpperCase()}</span><span>{item.weight}</span></div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className={`unit-value ${item.id==='mini'?'unit-standard':''}`}>
                  <div className="unit-value-top"><strong>{item.unitValue}</strong>{item.saving > 0 && <span className="saving-pill">SAVE {money(item.saving)}</span>}</div>
                  <span>{item.valueNote}</span>
                </div>
                <div className="product-buy">
                  <div className="price-stack"><strong>{money(item.price)}</strong>{item.referencePrice > item.price && <del>{money(item.referencePrice)}</del>}</div>
                  <button className="add-button" onClick={() => updateQty(item.id,1)}>Add to box <span>＋</span></button>
                </div>
              </div>
            </Reveal>
          ))}</div>
          <div className="menu-foot"><span>✦</span> Not sure which size? Start with the Classic. <a href="#order">Build your box ↓</a></div>
        </section>
        <section className="story-section" id="story"><div className="story-inner section-wrap"><Reveal className="story-visual"><div className="story-photo"><img src="/images/tiramisu-hero.jpg" alt="A rich tiramisu dessert close up"/></div><div className="story-label"><span>MADE WITH CARE</span><strong>Big<br/>happiness.</strong><i>✦</i></div><div className="story-caption">A moment worth slowing down for.</div></Reveal><Reveal className="story-copy" delay={.12}><div className="eyebrow left">A SWEET LITTLE STORY <span className="eyebrow-line"/></div><h2>Not just dessert.<br/><em>A feeling.</em></h2><p className="story-lead">TiraMio is our love letter to the little moments that deserve something special.</p><p>Inspired by the classic Italian favourite, every box brings together coffee-kissed sponge, soft cream and cocoa in a few perfectly indulgent layers. Made to be opened, shared, savoured — and remembered.</p><div className="story-signoff"><span className="signature">Made with love</span><span className="signoff-heart">♥</span></div><a className="underlined-link" href="#menu">Find your favourite <ArrowUpRight size={15}/></a></Reveal></div></section>
        <section className="ritual-section section-wrap" id="moments"><Reveal className="section-heading center"><div className="eyebrow">THE TIRAMIO FEELING</div><h2>A little joy, <em>layer by layer.</em></h2><p>For the coffee lover. For the sweet tooth. For the “just one more spoon” person.</p></Reveal><div className="ritual-grid">{[{icon:<Coffee/>,title:'Coffee-kissed',desc:'A gentle coffee note in every soft layer.'},{icon:<Sparkles/>,title:'Cloud-soft cream',desc:'Silky, smooth and made for slow spoonfuls.'},{icon:<LayersIcon/>,title:'Cocoa finish',desc:'A final dusting of chocolatey goodness.'},{icon:<Heart/>,title:'Made to share',desc:'Little boxes for moments worth keeping.'}].map((v,i)=><Reveal className="ritual-item" key={v.title} delay={i*.07}><span className="ritual-icon">{v.icon}</span><h3>{v.title}</h3><p>{v.desc}</p></Reveal>)}</div></section>
        <section className="order-section" id="order"><div className="order-inner section-wrap"><Reveal className="order-copy"><div className="eyebrow left">YOUR NEXT HAPPY MOMENT <span className="eyebrow-line"/></div><h2>Good things<br/>come in <em>little boxes.</em></h2><p>Build your TiraMio box in a few taps. We’ll help you take it from craving to doorstep.</p><div className="order-perks"><span>✓ Easy WhatsApp ordering</span><span>✓ Pickup or delivery details</span><span>✓ Order status updates</span></div></Reveal><Reveal className="order-panel" delay={.1}><div className="panel-top"><span>01 — MAKE IT YOURS</span><span className="panel-dot">●</span></div><h3>Build your box</h3><p className="panel-subtitle">Choose your favourites to get started.</p>{catalogue.map(item=><div className="builder-item" key={item.id}><div><b>{item.name}</b><small>{item.weight} · {money(item.price)}</small></div><div className="stepper"><button onClick={()=>updateQty(item.id,-1)} aria-label={`Decrease ${item.name}`}><Minus size={12}/></button><output>{qty[item.id] || 0}</output><button onClick={()=>updateQty(item.id,1)} aria-label={`Increase ${item.name}`}><Plus size={12}/></button></div></div>)}<div className="panel-total"><span>Your box total</span><strong>{money(total)}</strong></div><button className="button button-dark button-full" onClick={showCheckout}>Continue to details <ArrowUpRight size={16}/></button><p className="panel-note">No payment required to send an enquiry. Confirm availability with us on WhatsApp.</p></Reveal></div></section>
        <section className="track-section section-wrap" id="track"><Reveal className="track-card"><div className="track-copy"><div className="eyebrow left">A LITTLE UPDATE, RIGHT ON TIME <span className="eyebrow-line"/></div><h2>Where’s my <em>TiraMio?</em></h2><p>Have an order reference? Follow your order from confirmation to the first spoonful.</p><button className="button button-cream" onClick={()=>open('track')}>Track my order <ArrowUpRight size={16}/></button></div><div className="track-visual"><div className="track-route"><span className="route-dot active"/><span className="route-line"/><span className="route-dot"/><span className="route-line"/><span className="route-dot"/><span className="route-line"/><span className="route-dot"/></div><div className="track-stages"><span>Placed</span><span>Preparing</span><span>On the way</span><span>Delivered</span></div><div className="track-box">TiraMio<br/><small>on its way to you ♡</small></div></div></Reveal></section>
        <section className="scan-section section-wrap"><Reveal className="scan-card"><div className="scan-copy"><div className="eyebrow left">QUICK AS A SCAN <span className="eyebrow-line"/></div><h2>Craving? <em>Scan.</em><br/>Order. Smile.</h2><p>Scan to open a WhatsApp chat with TiraMio. No long forms, no fuss — just your next favourite dessert.</p><a className="underlined-link" href={`https://wa.me/${whatsapp}?text=Hi%20TiraMio!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer">Chat with us <ArrowUpRight size={15}/></a></div><div className="scan-code-wrap"><div className="scan-qr-frame"><img src="/images/order-qr.png" alt="QR code to order TiraMio on WhatsApp"/></div><span>SCAN TO ORDER</span><small>WhatsApp · 8433198122</small></div></Reveal></section>
        <section className="closing-section"><div className="closing-inner section-wrap"><span className="closing-flourish">✳</span><p>One last spoon?</p><h2>Make room for <em>sweet things.</em></h2><a className="button button-cream" href="#menu">Order your TiraMio <ArrowUpRight size={16}/></a><span className="closing-flourish">✳</span></div></section>
      </main>
      <footer className="site-footer"><div className="footer-main section-wrap"><div className="footer-brand"><a className="brand brand-footer" href="#top"><span className="brand-mark"><span className="cake-stack"><i/><i/><i/></span></span><span className="brand-copy"><strong>TiraMio</strong><small>T I R A M I S U</small></span></a><p>Layers of Love, in Every Bite.</p></div><div className="footer-links"><div><b>EXPLORE</b><a href="#menu">Our menu</a><a href="#story">Our story</a><a href="#track">Track order</a></div><div><b>SAY HELLO</b><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a><button onClick={()=>open('qr')}>Scan & order</button><span>Instagram: @TiraMioTiramisu*</span></div><div><b>GOOD TO KNOW</b><span>Dessert made with care</span><span>Pickup / delivery confirmation</span><span>*Handle availability to be checked</span></div></div></div><div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} TiraMio Tiramisu</span><span>Made with a little extra love <b>♥</b></span><a href="#top">Back to top ↑</a></div></footer>

      <div className="floating-order"><button className="floating-whatsapp" onClick={()=>open('qr')}><QrCode size={15}/> Scan & order</button><button className="floating-cart" onClick={()=>open('cart')}>Box <b>{count}</b><strong>{money(total)}</strong></button></div>

      {modal === 'cart' && <Modal title="A good choice." eyebrow="YOUR LITTLE BOX" onClose={close}><div className="cart-lines">{chosen.length ? chosen.map(item=><div className="cart-line" key={item.id}><div><strong>{item.name}</strong><small>{item.weight} · {money(item.price)} each</small></div><div className="cart-line-actions"><button onClick={()=>updateQty(item.id,-1)}><Minus size={11}/></button><b>{qty[item.id]}</b><button onClick={()=>updateQty(item.id,1)}><Plus size={11}/></button></div><strong>{money(item.price*qty[item.id])}</strong></div>) : <p className="empty-cart">Your box is waiting for something delicious.</p>}</div><div className="cart-footer"><div className="panel-total"><span>Subtotal</span><strong>{money(total)}</strong></div><button className="button button-dark button-full" onClick={showCheckout}>Continue to details <ArrowUpRight size={16}/></button></div></Modal>}

      {modal === 'checkout' && <Modal title={<>Let’s get you <em>your TiraMio.</em></>} eyebrow="JUST A FEW DETAILS" onClose={close} wide><form onSubmit={submitOrder}><div className="form-grid"><label>Your name<input required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="How should we call you?"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10-digit mobile number"/></label><label className="full-span">How would you like it?<select value={form.fulfilment} onChange={e=>setForm({...form,fulfilment:e.target.value})}><option>Pickup</option><option>Delivery</option></select></label>{form.fulfilment==='Delivery' && <label className="full-span">Delivery address<textarea required rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="House / street / area / landmark"/></label>}<label className="full-span">Anything we should know?<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Preferred timing, special instructions…"/></label><label className="full-span">Payment preference<select value={form.payment} onChange={e=>setForm({...form,payment:e.target.value})}><option>Pay on pickup / delivery</option><option>Online payment</option></select></label></div><div className="checkout-summary"><span>Your box · {count} item{count===1?'':'s'}</span><strong>{money(total)}</strong></div><p className="form-disclaimer">WhatsApp ordering is available now. Online payment requires your Razorpay merchant account and configured server keys.</p><button className="button button-dark button-full" type="submit" disabled={busy}>{busy?'Preparing your order…':form.payment==='Online payment'?'Continue to secure payment':'Send order on WhatsApp'} <ArrowUpRight size={16}/></button></form></Modal>}

      {modal === 'track' && <Modal title={<>Track your <em>box.</em></>} eyebrow="ORDER UPDATES" onClose={close}><form className="track-form" onSubmit={trackOrder}><label>Order reference<input required value={trackingForm.orderId} onChange={e=>setTrackingForm({...trackingForm,orderId:e.target.value})} placeholder="e.g. TIRA-2048"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={trackingForm.phone} onChange={e=>setTrackingForm({...trackingForm,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="Phone used for order"/></label><button className="button button-dark button-full" type="submit">Find my order <ArrowUpRight size={16}/></button></form>{trackingError && <div className="track-result"><p>{trackingError}</p></div>}{tracking && <div className="track-result"><h3>{tracking.orderRef} · {String(tracking.status).replaceAll('_',' ')}</h3><p>{tracking.customerName} · {tracking.fulfilment} · {money(tracking.total)}</p>{stageLabels.map((label,i)=><div className="status-line" key={label}><span className={`status-dot ${i<=currentStage?'complete':''}`}/><div className="status-copy"><b>{label}</b><small>{stageDescriptions[i]}</small></div></div>)}{tracking.events?.length>0 && <div className="tracking-events"><b>Latest updates</b>{tracking.events.map((event,i)=><p key={i}>{String(event.status).replaceAll('_',' ')} · {new Date(event.created_at).toLocaleString()}</p>)}</div>}</div>}<p className="form-disclaimer">Live order status appears after the Express API and PostgreSQL database are connected.</p></Modal>}

      {modal === 'qr' && <Modal title={<>Scan. Order. <em>Smile.</em></>} eyebrow="THE FASTEST WAY TO TIRAMIO" onClose={close}><div className="qr-large"><img src="/images/order-qr.png" alt="Scan to start a TiraMio WhatsApp order"/></div><p className="qr-caption">Point your camera here to start a WhatsApp order.</p><a className="button button-dark button-full" href={`https://wa.me/${whatsapp}?text=Hi%20TiraMio!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer">Open WhatsApp <ArrowUpRight size={16}/></a><small className="qr-number">8433198122</small></Modal>}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </>
  );
}

function LayersIcon() { return <Package/>; }
function Modal({ children, title, eyebrow, onClose, wide = false }) {
  return <div className="modal-backdrop open" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?'modal-checkout':''}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={22}/></button><div className="eyebrow left">{eyebrow} <span className="eyebrow-line"/></div><h2>{title}</h2>{children}</div></div>;
}
