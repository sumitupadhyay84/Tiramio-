'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import { motion, useReducedMotion } from 'motion/react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, CirclePlay, Coffee, Heart, Info, Instagram, Menu, MessageCircle, Minus, Package, Phone, Plus, QrCode, ShoppingBag, Sparkles, Truck, X, Youtube } from 'lucide-react';

const productVisual = '/images/cocoa-dusted-tiramisu.png';
const productImages = {
  mini: '/images/tiramio-mini-card.webp',
  classic: '/images/tiramio-classic-card.webp',
  share: '/images/tiramio-share-card.webp'
};
const products = [
  { id: 'mini', name: 'TiraMio Mini', weight: '100 g', price: 69, referencePrice: 69, saving: 0, description: 'Your personal pause. Just enough to make the day sweeter.', image: productImages.mini, tag: 'PERSONAL TREAT', unitValue: '₹69 / 100 g', valueNote: 'A lovely little treat' },
  { id: 'classic', name: 'TiraMio Classic', weight: '200 g', price: 129, referencePrice: 138, saving: 9, description: 'The just-right box for your favourite dessert moment.', image: productImages.classic, tag: 'MOST LOVED · SAVE ₹9', unitValue: '₹64.50 / 100 g', valueNote: 'Save ₹9 compared with two Mini boxes' },
  { id: 'share', name: 'TiraMio Share Box', weight: '300 g', price: 189, referencePrice: 207, saving: 18, description: 'More layers, more spoons, more reasons to gather.', image: productImages.share, tag: 'BEST VALUE · SAVE ₹18', unitValue: '₹63 / 100 g', valueNote: 'Save ₹18 compared with three Mini boxes' }
];
const api = process.env.NEXT_PUBLIC_API_URL || '';
const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918433198122';
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Reveal({ children, className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.16 }} transition={{ duration: reduce ? 0 : .7, delay, ease: [.2, .7, .25, 1] }}>{children}</motion.div>;
}

function TiramisuHeroModel() {
  const group = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!group.current) return;
    group.current.rotation.y = t * 0.45;
    group.current.rotation.x = Math.sin(t * 0.7) * 0.22;
    group.current.position.y = Math.sin(t * 1.1) * 0.12;
  });

  return (
    <group ref={group} position={[0, -0.55, 0]}>
      <mesh position={[0, -1.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.85, 2.05, 0.45, 64]} />
        <meshStandardMaterial color="#5f3425" roughness={0.8} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.75, 0]} castShadow>
        <cylinderGeometry args={[1.7, 1.85, 0.3, 64]} />
        <meshStandardMaterial color="#c98d54" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.2, 0]} castShadow>
        <cylinderGeometry args={[1.62, 1.75, 0.36, 64]} />
        <meshStandardMaterial color="#f7f0dc" roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[1.57, 1.7, 0.28, 64]} />
        <meshStandardMaterial color="#c79566" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[1.35, 1.52, 0.26, 64]} />
        <meshStandardMaterial color="#f9f1e0" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.35, 0.22, 64]} />
        <meshStandardMaterial color="#d8b98b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.85, 48, 48]} />
        <meshStandardMaterial color="#f7ecdc" roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.7, 0.08]} rotation={[0, 0, -0.2]} castShadow>
        <sphereGeometry args={[0.58, 32, 32]} />
        <meshStandardMaterial color="#d7a25c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.95, 0.12]} rotation={[0, 0, 0.15]} castShadow>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color="#7b4a2d" roughness={1} />
      </mesh>
    </group>
  );
}

function TiramisuHeroCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 5.8], fov: 35 }} dpr={[1, 2]}>
      <color attach="background" args={['#24130E']} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[3, 4, 5]} intensity={2.1} color="#ffe9c9" />
      <pointLight position={[-3, -2, 4]} intensity={18} color="#d69d56" />
      <Float speed={2.5} rotationIntensity={0.7} floatIntensity={1.2}>
        <TiramisuHeroModel />
      </Float>
      <ContactShadows position={[0, -2.2, 0]} opacity={0.65} scale={7} blur={2.5} far={5} />
    </Canvas>
  );
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
  const headerRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.08 });
    let frameId = null;
    const raf = time => {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    };
    frameId = requestAnimationFrame(raf);

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.utils.toArray('.reveal-block').filter(el => !el.closest('.hero-copy')).forEach(el => {
          gsap.fromTo(el, { y: 38, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%' } });
        });
        gsap.to('.hero-visual-wrap', { yPercent: -9, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.progress-bar', { scaleX: 1, ease: 'none', transformOrigin: 'left center', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } });
      });

      return () => {
        ctx.revert();
        cancelAnimationFrame(frameId);
        lenis.destroy();
      };
    }

    cancelAnimationFrame(frameId);
    lenis.destroy();
    return undefined;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY > 18;
      if (headerRef.current) headerRef.current.classList.toggle('is-scrolled', scrolled);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!api) return;
    let active = true;
    fetch(`${api}/api/products`).then(response => { if (!response.ok) throw new Error('Catalogue unavailable'); return response.json(); })
      .then(data => { if (!active || !Array.isArray(data.products) || !data.products.length) return; setCatalogue(data.products.map(item => ({
        id: item.id, name: item.name, weight: `${item.weightGrams} g`, price: Number(item.price),
        referencePrice: Math.round((Number(item.weightGrams || 100) / 100) * 69),
        saving: Math.max(0, Math.round((Number(item.weightGrams || 100) / 100) * 69) - Number(item.price)),
        description: item.shortDescription || 'A little dessert moment, made for you.',
        image: productImages[item.id] || productVisual,
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
      <div className="scroll-progress"><span className="progress-bar" /></div>
      <div className="announcement"><span className="sparkle">✦</span> A little box of happiness, made with care <span className="sparkle">✦</span></div>
      <header ref={headerRef} className="site-header" id="top">
        <a className="brand" href="#top" aria-label="TiraMio home"><span className="brand-mark"><span className="cake-stack"><i/><i/><i/></span></span><span className="brand-copy"><strong>TiraMio</strong><small>T I R A M I S U</small></span></a>
        <nav className="desktop-nav"><a href="#menu">Our Menu</a><a href="#story">Our Story</a><a href="#moments">The TiraMio Feeling</a><a href="#track">Track Order</a></nav>
        <div className="header-actions"><button className="cart-trigger" onClick={() => open('cart')}><ShoppingBag size={16}/><span>Your Box</span><b>{count}</b></button><button className="menu-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X/> : <Menu/>}</button></div>
      </header>
      {mobileNav && <nav className="mobile-nav open"><a onClick={() => setMobileNav(false)} href="#menu">Our Menu</a><a onClick={() => setMobileNav(false)} href="#story">Our Story</a><a onClick={() => setMobileNav(false)} href="#moments">The TiraMio Feeling</a><a onClick={() => { setMobileNav(false); open('track'); }} href="#track">Track Order</a></nav>}
      <main>
        <section ref={heroRef} className="hero section-wrap" aria-label="Welcome to TiraMio">
          <div className="hero-ambient" aria-hidden="true">
            <span className="orb orb-one" />
            <span className="orb orb-two" />
            <span className="orb orb-three" />
            <span className="hero-gold-dust dust-1" />
            <span className="hero-gold-dust dust-2" />
            <span className="hero-gold-dust dust-3" />
            <span className="hero-gold-dust dust-4" />
            <span className="hero-gold-dust dust-5" />
            <span className="hero-gold-dust dust-6" />
          </div>
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow reveal-block"><span className="eyebrow-line"/> A CLASSIC, WITH A LITTLE LOVE <span className="eyebrow-line"/></div>
              <h1 className="hero-title reveal-block">
                <span className="hero-word-line"><span className="hero-word">Some</span> <span className="hero-word">days</span> <span className="hero-word">call</span></span>
                <span className="hero-word-line"><span className="hero-word">for</span> <span className="hero-word hero-word-accent">another</span></span>
                <span className="hero-word-line"><span className="hero-word hero-word-accent">spoonful.</span></span>
              </h1>
              <p className="hero-tagline reveal-block">Layers of Love, in Every Bite.</p>
              <p className="hero-desc reveal-block">Meet your new little indulgence: soft coffee-kissed layers, dreamy cream and a generous snowfall of cocoa.</p>
              <div className="hero-actions reveal-block">
                <a className="button button-dark" href="#menu">Explore Our Desserts <ArrowUpRight size={16}/></a>
                <button className="button button-light" onClick={() => open('qr')}><CirclePlay size={18}/> Discover Our Story</button>
              </div>
              <div className="hero-proof reveal-block"><span className="proof-stars">★★★★★</span><span>4.9 (2,300+ happy dessert lovers)</span></div>
            </div>
          </div>
          <div className="hero-art hero-visual-wrap">
            <div className="hero-product-portrait">
              <img src={productVisual} alt="A premium cocoa-dusted tiramisu dessert cup" fetchPriority="high" />
            </div>
            <div className="hero-note" aria-hidden="true">Made with<br/><em>love ♡</em></div>
            <div className="hero-badge"><span>THE</span><strong>Little<br/>Luxury</strong><em>You Deserve</em></div>
          </div>
          <div className="hero-scroll"><span>Scroll to explore</span><span className="scroll-arrow">⌄</span></div>
          <WaveDivider variant="hero" fill="var(--paper)" underFill="rgba(198, 163, 106, 0.16)" stroke="rgba(198, 163, 106, 0.55)" />
        </section>
        <section className="menu-section section-wrap" id="menu">
          <div className="menu-content">
            <Reveal className="section-heading">
              <div>
                <div className="eyebrow left">THE MENU <span className="eyebrow-line"/></div>
                <h2>Pick your <em>happy.</em></h2>
                <p>Three sizes. One very good decision. Made for a little treat or a lot of sharing.</p>
              </div>
            </Reveal>
          <div className="product-grid">{catalogue.map((item,index)=>(
            <Reveal key={item.id} delay={index*.1} className={`product-card ${item.id==='classic'?'featured':''} ${item.id==='share'?'best-value':''}`}>
              <div className={`product-photo photo-${item.id}`}>
                <img className="product-open-gif" src={item.image} alt={`${item.name}, ${item.weight} tiramisu served on a plate`} loading="lazy" decoding="async" />
                <span className={`photo-tag ${item.id!=='mini'?'featured-tag':''}`}>
                  {item.id === 'mini' ? <Sparkles size={15} fill="currentColor" /> : item.id === 'classic' ? <Heart size={16} fill="currentColor" /> : <Package size={15} />}
                  {item.tag}
                </span>
                <span className="product-favorite" aria-hidden="true"><Heart size={25} /></span>
              </div>
              <div className="product-info">
                <div className="product-meta"><span>0{index+1} / {item.id.toUpperCase()}</span><span>{item.weight}</span></div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="product-buy">
                  <div className="listing-price">
                    <div className="listing-price-line">
                      <strong>{item.unitValue}</strong>
                      {item.saving > 0 && <del>{money(item.id === 'classic' ? item.referencePrice / 2 : item.referencePrice)}</del>}
                      {item.saving > 0 && <span className="saving-pill">SAVE {money(item.saving)}</span>}
                    </div>
                    <small>Box total {money(item.price)}</small>
                  </div>
                  <button className="add-button listing-add" onClick={() => updateQty(item.id,1)}>Add to box <span>＋</span></button>
                </div>
              </div>
            </Reveal>
          ))}</div>
          </div>
          <div className="menu-foot">
            <div className="menu-foot-inner">
              <span className="menu-foot-mark" aria-hidden="true"><Package size={21}/></span>
              <div className="menu-foot-copy">
                <span className="menu-foot-eyebrow">A LITTLE HELP CHOOSING</span>
                <p>Not sure which size? <strong>Start with the Classic.</strong></p>
              </div>
              <div className="menu-foot-pick">
                <span>THE CROWD FAVORITE</span>
                <strong>Classic <i>200 g · ₹129</i></strong>
              </div>
              <button className="text-button" onClick={() => { updateQty('classic', 1); open('cart'); }}>Start with Classic <ArrowUpRight size={16}/></button>
            </div>
          </div>
        </section>
        <WaveDivider variant="to-dark" bg="var(--paper)" fill="#241108" underFill="rgba(198, 163, 106, 0.22)" stroke="rgba(214, 173, 112, 0.55)" />
        <section className="story-section" id="story">
          <div className="story-corner-flourish story-flourish-tl" aria-hidden="true">
            <svg viewBox="0 0 320 220" preserveAspectRatio="none" fill="none">
              <path d="M0,0 C120,40 190,120 180,220 L0,220 Z" fill="rgba(240, 218, 186, 0.42)" />
            </svg>
          </div>
          <div className="story-corner-flourish story-flourish-tr" aria-hidden="true">
            <svg viewBox="0 0 340 240" preserveAspectRatio="none" fill="none">
              <path d="M340,0 C220,30 140,110 170,240 L340,240 Z" fill="rgba(240, 218, 186, 0.42)" />
            </svg>
          </div>
          <div className="story-cocoa-dust" aria-hidden="true">
            <img src="/images/cocoa-dust-flourish.png" alt="" />
          </div>

          <div className="story-inner section-wrap">
            <Reveal className="story-visual">
              <div className="story-visual-wrap">
                <div className="story-card-backdrop" aria-hidden="true" />
                <div className="story-card-cushion" aria-hidden="true" />

                <div className="story-photo-card">
                  <img src="/images/cocoa-dusted-tiramisu.png" alt="Cocoa-dusted tiramisu layered with cream in a serving box" width="1536" height="1024" loading="lazy" decoding="async" />
                  <div className="story-photo-script" aria-hidden="true">
                    <span>Big<br />happiness.</span>
                    <svg viewBox="0 0 160 12" fill="none">
                      <path d="M4,7 C45,1 115,1 156,6" stroke="#f6dfb7" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="story-badge-wrap">
                  <ScallopedBadge />
                </div>
              </div>
            </Reveal>

            <Reveal className="story-copy" delay={0.12}>
              <div className="story-eyebrow-container">
                <div className="story-eyebrow-emblem" aria-hidden="true">
                  <span className="eyebrow-line" />
                  <span className="eyebrow-cake-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
                      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
                      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
                      <path d="M2 21h20" />
                      <path d="M7 8v2" />
                      <path d="M12 8v2" />
                      <path d="M17 8v2" />
                      <path d="M7 4h.01" />
                      <path d="M12 4h.01" />
                      <path d="M17 4h.01" />
                    </svg>
                  </span>
                  <span className="eyebrow-line" />
                </div>
                <div className="story-eyebrow-label">A SWEET LITTLE STORY</div>
              </div>

              <h2 className="story-heading">
                <span>Not just dessert.</span>
                <span className="story-heading-accent">
                  A feeling.
                  <svg className="story-heading-underline" viewBox="0 0 210 14" fill="none" aria-hidden="true">
                    <path d="M2,4 C60,13 140,13 204,5" stroke="#e5a759" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>

              <p className="story-lead">TiraMio is our love letter to the little moments that deserve something special.</p>

              <p className="story-desc">
                Inspired by the classic Italian favourite, every box brings together coffee-kissed sponge, soft cream and cocoa in a few perfectly indulgent layers. Made to be opened, shared, savoured — and remembered.
              </p>

              <div className="story-features-row">
                <div className="story-feature-pill">
                  <span className="story-feature-icon">
                    <Package size={17} />
                  </span>
                  <div className="story-feature-text">
                    <strong>Layered</strong>
                    <small>with love</small>
                  </div>
                </div>

                <div className="story-feature-pill">
                  <span className="story-feature-icon">
                    <Coffee size={17} />
                  </span>
                  <div className="story-feature-text">
                    <strong>Real</strong>
                    <small>coffee notes</small>
                  </div>
                </div>

                <div className="story-feature-pill">
                  <span className="story-feature-icon">
                    <Sparkles size={17} />
                  </span>
                  <div className="story-feature-text">
                    <strong>Rich &</strong>
                    <small>creamy</small>
                  </div>
                </div>
              </div>

              <div className="story-action-row">
                <a className="story-cta-btn" href="#menu">
                  Find your favourite <ArrowUpRight size={15} />
                </a>
                <span className="story-signoff-copy">
                  Made with love <span className="story-heart">♥</span>
                </span>
              </div>
            </Reveal>
          </div>
        </section>
        <WaveDivider variant="to-light" bg="#241108" fill="var(--paper)" underFill="rgba(198, 163, 106, 0.22)" stroke="rgba(214, 173, 112, 0.55)" />
        <ExperienceSection onTrackOrder={() => open('track')} />
        <CurveDivider />
        <section className="scan-section"><div className="section-wrap"><Reveal className="scan-card"><div className="scan-copy"><div className="eyebrow left">QUICK AS A SCAN <span className="eyebrow-line"/></div><h2>Craving? <em>Scan.</em><br/>Order. Smile.</h2><p>Scan to open a WhatsApp chat with TiraMio. No long forms, no fuss — just your next favourite dessert.</p><a className="underlined-link" href={`https://wa.me/${whatsapp}?text=Hi%20TiraMio!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer">Chat with us <ArrowUpRight size={15}/></a></div><div className="scan-code-wrap"><div className="scan-qr-frame"><img src="/images/order-qr.png" alt="QR code to order TiraMio on WhatsApp"/></div><span>SCAN TO ORDER</span><small>WhatsApp · 8433198122</small></div></Reveal></div></section>
        <WaveDivider variant="to-dark" bg="var(--paper)" fill="var(--espresso)" underFill="rgba(198, 163, 106, 0.22)" stroke="rgba(214, 173, 112, 0.55)" />
        <section className="closing-section"><div className="closing-inner section-wrap"><div className="closing-emblem" aria-hidden="true"><span/><span className="closing-cake"><i/><i/><i/></span><span/></div><p>One last spoon?</p><h2>Make room for <em>sweet things.</em></h2><a className="button button-cream" href="#menu">Order your TiraMio <ArrowUpRight size={16}/></a></div></section>
      </main>
      <CurveDivider />
      <footer className="site-footer">
        <div className="footer-divider section-wrap" aria-hidden="true"><span>✦</span></div>
        <div className="footer-main section-wrap">
          <div className="footer-brand">
            <a className="brand brand-footer" href="#top"><span className="brand-mark"><span className="cake-stack"><i/><i/><i/></span></span><span className="brand-copy"><strong>TiraMio</strong><small>T I R A M I S U</small></span></a>
            <p>Layers of Love, in Every Bite.</p>
            <div className="footer-socials" aria-label="Social media">
              <a href="https://www.instagram.com/TiraMioTiramisu/" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20}/></a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20}/></a>
              <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={20}/></a>
            </div>
          </div>
          <div className="footer-links">
            <div><b>EXPLORE</b><a href="#menu">Our Menu</a><a href="#story">Our Story</a><a href="#track">Track Order</a></div>
            <div><b>SAY HELLO</b><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={20}/>WhatsApp Us</a><button onClick={()=>open('qr')}><QrCode size={20}/>Scan &amp; Order</button><a href="https://www.instagram.com/TiraMioTiramisu/" target="_blank" rel="noreferrer"><Instagram size={20}/>Instagram: @TiraMioTiramisu*</a></div>
            <div><b>GOOD TO KNOW</b><span><Package size={20}/>Dessert made with care</span><span><Truck size={20}/>Pickup / Delivery Confirmation</span><span><Info size={20}/>*Handle availability to be checked</span></div>
          </div>
        </div>
        <div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} TiraMio Tiramisu. All rights reserved.</span><span>Made with a little extra love <b><Heart size={20}/></b></span><a href="#top">Back to top <ArrowUpRight size={17}/></a></div>
      </footer>

      <div className="floating-order"><button className="floating-whatsapp" onClick={()=>open('qr')}><QrCode size={15}/> Scan & order</button><button className="floating-cart" onClick={()=>open('cart')}>Box <b>{count}</b><strong>{money(total)}</strong></button></div>

      {modal === 'cart' && <Modal onClose={close} className="cart-modal" showHeader={false}><div className="cart-modal-art"><img src={productVisual} alt="Cocoa-dusted tiramisu in a glass dessert cup"/></div><div className="cart-modal-copy"><div className="eyebrow left">YOUR LITTLE BOX <span className="eyebrow-line"/></div><h2>A Good Choice.</h2>{chosen.length ? <div className="cart-lines">{chosen.map(item=><div className="cart-line" key={item.id}><div><strong>{item.name}</strong><small>{item.weight} · {money(item.price)} each</small></div><div className="cart-line-actions"><button onClick={()=>updateQty(item.id,-1)} aria-label={`Remove one ${item.name}`}><Minus size={11}/></button><b>{qty[item.id]}</b><button onClick={()=>updateQty(item.id,1)} aria-label={`Add one ${item.name}`}><Plus size={11}/></button></div><strong>{money(item.price*qty[item.id])}</strong></div>)}</div> : <p className="empty-cart">Your box is waiting for something delicious.</p>}<div className="cart-footer"><div className="cart-summary"><span><ShoppingBag size={15}/>Subtotal</span><strong>{money(total)}</strong></div><button className="button button-dark button-full" onClick={showCheckout}><ShoppingBag size={16}/>Continue to Details <ArrowUpRight size={17}/></button></div></div></Modal>}

      {modal === 'checkout' && <Modal title={<>Let’s get you <em>your TiraMio.</em></>} eyebrow="JUST A FEW DETAILS" onClose={close} wide><form onSubmit={submitOrder}><div className="form-grid"><label>Your name<input required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="How should we call you?"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10-digit mobile number"/></label><label className="full-span">How would you like it?<select value={form.fulfilment} onChange={e=>setForm({...form,fulfilment:e.target.value})}><option>Pickup</option><option>Delivery</option></select></label>{form.fulfilment==='Delivery' && <label className="full-span">Delivery address<textarea required rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="House / street / area / landmark"/></label>}<label className="full-span">Anything we should know?<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Preferred timing, special instructions…"/></label><label className="full-span">Payment preference<select value={form.payment} onChange={e=>setForm({...form,payment:e.target.value})}><option>Pay on pickup / delivery</option><option>Online payment</option></select></label></div><div className="checkout-summary"><span>Your box · {count} item{count===1?'':'s'}</span><strong>{money(total)}</strong></div><p className="form-disclaimer">WhatsApp ordering is available now. Online payment requires your Razorpay merchant account and configured server keys.</p><button className="button button-dark button-full" type="submit" disabled={busy}>{busy?'Preparing your order…':form.payment==='Online payment'?'Continue to secure payment':'Send order on WhatsApp'} <ArrowUpRight size={16}/></button></form></Modal>}

      {modal === 'track' && <Modal title={<>Track your <em>box.</em></>} eyebrow="ORDER UPDATES" onClose={close}><form className="track-form" onSubmit={trackOrder}><label>Order reference<input required value={trackingForm.orderId} onChange={e=>setTrackingForm({...trackingForm,orderId:e.target.value})} placeholder="e.g. TIRA-2048"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={trackingForm.phone} onChange={e=>setTrackingForm({...trackingForm,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="Phone used for order"/></label><button className="button button-dark button-full" type="submit">Find my order <ArrowUpRight size={16}/></button></form>{trackingError && <div className="track-result"><p>{trackingError}</p></div>}{tracking && <div className="track-result"><h3>{tracking.orderRef} · {String(tracking.status).replaceAll('_',' ')}</h3><p>{tracking.customerName} · {tracking.fulfilment} · {money(tracking.total)}</p>{stageLabels.map((label,i)=><div className="status-line" key={label}><span className={`status-dot ${i<=currentStage?'complete':''}`}/><div className="status-copy"><b>{label}</b><small>{stageDescriptions[i]}</small></div></div>)}{tracking.events?.length>0 && <div className="tracking-events"><b>Latest updates</b>{tracking.events.map((event,i)=><p key={i}>{String(event.status).replaceAll('_',' ')} · {new Date(event.created_at).toLocaleString()}</p>)}</div>}</div>}<p className="form-disclaimer">Live order status appears after the Express API and PostgreSQL database are connected.</p></Modal>}

      {modal === 'qr' && <Modal onClose={close} className="qr-order-modal" showHeader={false}>
        <div className="qr-order-layout">
          <div className="qr-order-visual" aria-label="Tiramisu made for your next happy moment">
            <p>Order on<br/>WhatsApp <span>♡</span></p>
            <svg className="qr-visual-arrow" viewBox="0 0 70 38" aria-hidden="true"><path d="M2 2C22 6 39 15 62 30M50 27l12 3-5-12"/></svg>
          </div>
          <div className="qr-order-panel">
            <div className="eyebrow left">THE FASTEST WAY TO TIRAMIO <span className="eyebrow-line"/></div>
            <h2>Scan. Order. <em>Smile.</em></h2>
            <div className="qr-code-decoration">
              <span className="qr-ray qr-ray-left" aria-hidden="true"/>
              <div className="qr-code-frame"><img src="/images/order-qr.png" alt="Scan to start a TiraMio WhatsApp order"/></div>
              <span className="qr-ray qr-ray-right" aria-hidden="true"/>
            </div>
            <p className="qr-caption">Point your camera here to start a WhatsApp order.</p>
            <a className="qr-whatsapp-cta" href={`https://wa.me/${whatsapp}?text=Hi%20TiraMio!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer"><span className="whatsapp-mark"><MessageCircle/><Phone/></span> Open WhatsApp <ArrowUpRight size={17}/></a>
            <div className="qr-phone"><span/><Phone size={15}/><a href={`tel:${whatsapp}`}>8433198122</a><span/></div>
          </div>
        </div>
      </Modal>}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </>
  );
}

const experienceHighlights = [
  { icon: Coffee, title: 'Coffee-kissed', description: 'A gentle coffee note in every soft layer.' },
  { icon: Sparkles, title: 'Cloud-soft cream', description: 'Silky, smooth and made for slow spoonfuls.' },
  { icon: Package, title: 'Cocoa finish', description: 'A final dusting of chocolatey goodness.' },
  { icon: Heart, title: 'Made to share', description: 'Little boxes for moments worth keeping.' }
];

const trackingStages = ['Placed', 'Preparing', 'On the way', 'Delivered'];

function ExperienceSection({ onTrackOrder }) {
  return (
    <section className="experience-section" id="moments">
      <div className="experience-layout">
        <figure className="experience-photo">
          <span className="experience-photo-shadow" aria-hidden="true" />
          <img
            src="/images/cocoa-dusted-tiramisu.png"
            alt="Cocoa-dusted tiramisu layered with cream in a serving box"
            width="1536"
            height="1024"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <div className="experience-content">
          <Reveal className="experience-intro">
            <div className="eyebrow left">THE TIRAMIO FEELING <span className="eyebrow-line" /></div>
            <h2>A little joy, <em>layer by layer.</em></h2>
            <p>For the coffee lover. For the sweet tooth. For the “just one more spoon” person.</p>
          </Reveal>

          <div className="experience-highlights">
            {experienceHighlights.map(({ icon: Icon, title, description }) => (
              <Reveal className="experience-highlight" key={title}>
                <span className="experience-highlight-icon"><Icon size={25} strokeWidth={1.8} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </Reveal>
            ))}
          </div>

          <section className="experience-tracking" id="track" aria-labelledby="experience-tracking-title">
            <div className="experience-tracking-copy">
              <h3 id="experience-tracking-title">Where’s my <em>TiraMio?</em></h3>
              <p>Have an order reference? Follow your order from confirmation to the first spoonful.</p>
              <button className="experience-tracking-button" onClick={onTrackOrder}>
                Track my order <ArrowUpRight size={17} />
              </button>
            </div>
            <div
              className="experience-timeline"
              role="img"
              aria-label="Illustrative order timeline: Placed, Preparing, On the way, Delivered. This is not a live order status."
            >
              <div className="experience-timeline-line" aria-hidden="true" />
              {trackingStages.map((stage, index) => (
                <div className="experience-timeline-stage" key={stage}>
                  <span className={`experience-timeline-dot${index === 0 ? ' is-active' : ''}`} aria-hidden="true" />
                  <span>{stage}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function WaveDivider({ variant = 'to-light', bg = 'transparent', fill = 'var(--paper)', underFill = 'rgba(198, 163, 106, 0.16)', stroke = 'rgba(198, 163, 106, 0.55)', className = '' }) {
  const isTypeA = variant === 'hero' || variant === 'to-light';
  return (
    <div className={`section-wave-divider wave-${variant} ${className}`} style={{ backgroundColor: bg }} aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isTypeA ? (
          <>
            <path d="M0,38 C280,60 500,14 760,36 C1020,58 1240,16 1440,32 L1440,66 L0,66 Z" fill={underFill} />
            <path d="M0,32 C260,54 480,8 760,30 C1040,52 1260,10 1440,26 L1440,66 L0,66 Z" fill={fill} />
            <path d="M0,32 C260,54 480,8 760,30 C1040,52 1260,10 1440,26" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M0,22 C220,0 440,42 720,20 C1000,-2 1220,44 1440,24 L1440,66 L0,66 Z" fill={underFill} />
            <path d="M0,28 C220,6 440,48 720,26 C1000,4 1220,50 1440,30 L1440,66 L0,66 Z" fill={fill} />
            <path d="M0,28 C220,6 440,48 720,26 C1000,4 1220,50 1440,30" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}

function CurveDivider({ className = '' }) {
  return (
    <div className={`section-curve-divider ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 40" preserveAspectRatio="none">
        <path className="curve-divider-shadow" d="M0 20 C240 2 480 38 720 20 S1200 2 1440 20" />
        <path className="curve-divider-line" d="M0 15 C240 -3 480 33 720 15 S1200 -3 1440 15" />
      </svg>
    </div>
  );
}

function ScallopedBadge() {
  return (
    <svg className="scallop-badge-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rosette-grad" cx="45%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#fae5c3" />
          <stop offset="65%" stopColor="#f3c98b" />
          <stop offset="100%" stopColor="#dca766" />
        </radialGradient>
        <filter id="rosette-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#35160b" floodOpacity="0.28" />
        </filter>
      </defs>
      <path
        d="M 92.00 50.00 Q 97.08 59.36 88.80 66.07 Q 89.91 76.67 79.70 79.70 Q 76.67 89.91 66.07 88.80 Q 59.36 97.08 50.00 92.00 Q 40.64 97.08 33.93 88.80 Q 23.33 89.91 20.30 79.70 Q 10.09 76.67 11.20 66.07 Q 2.92 59.36 8.00 50.00 Q 2.92 40.64 11.20 33.93 Q 10.09 23.33 20.30 20.30 Q 23.33 10.09 33.93 11.20 Q 40.64 2.92 50.00 8.00 Q 59.36 2.92 66.07 11.20 Q 76.67 10.09 79.70 20.30 Q 89.91 23.33 88.80 33.93 Q 97.08 40.64 92.00 50.00 Z"
        fill="url(#rosette-grad)"
        filter="url(#rosette-shadow)"
        stroke="#c99557"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="50" r="34" stroke="#c08c4e" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.6" />
      <g transform="translate(42.5, 23) scale(0.65)" fill="#4e2413">
        <path d="M2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4zM2 9h20v3H2V9zm3-5h14a1 1 0 0 1 1 1v2H4V5a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="2" r="1.5" />
      </g>
      <text x="50" y="52" textAnchor="middle" fill="#4a2213" fontSize="7" fontWeight="800" letterSpacing="0.16em" fontFamily="'DM Sans', Arial, sans-serif">MADE</text>
      <text x="50" y="61" textAnchor="middle" fill="#4a2213" fontSize="7" fontWeight="800" letterSpacing="0.16em" fontFamily="'DM Sans', Arial, sans-serif">WITH</text>
      <text x="50" y="70" textAnchor="middle" fill="#4a2213" fontSize="7" fontWeight="800" letterSpacing="0.16em" fontFamily="'DM Sans', Arial, sans-serif">CARE</text>
    </svg>
  );
}

function Modal({ children, title, eyebrow, onClose, wide = false, className = '', showHeader = true }) {
  return <div className={`modal-backdrop open${className ? ` ${className}-backdrop` : ''}`} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?'modal-checkout':''} ${className}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={22}/></button>{showHeader && <><div className="eyebrow left">{eyebrow} <span className="eyebrow-line"/></div><h2>{title}</h2></>}{children}</div></div>;
}
