'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import { motion, useReducedMotion } from 'motion/react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AlertCircle, ArrowLeft, ArrowUpRight, CakeSlice, Check, CheckCircle2, CirclePlay, Coffee, Copy, Heart, Info, Instagram, Leaf, Menu, MessageCircle, Minus, Package, Phone, Plus, QrCode, ShoppingBag, Sparkles, Truck, X, Youtube } from 'lucide-react';

const productVisual = '/images/cocoa-dusted-tiramisu.webp';
const productImages = {
  mini: '/images/dearmisu-mini-card.webp',
  classic: '/images/dearmisu-classic-card.webp',
  share: '/images/dearmisu-share-card.webp'
};
const products = [
  { id: 'mini', name: 'Dear Misu Mini', weight: '100 g', price: 69, referencePrice: 79, saving: 10, description: 'Your personal pause. Just enough to make the day sweeter.', image: productImages.mini, tag: 'PERSONAL TREAT · SAVE ₹10', unitValue: '₹69 / 100 g', valueNote: 'Save ₹10 on your personal box' },
  { id: 'classic', name: 'Dear Misu Classic', weight: '200 g', price: 129, referencePrice: 140, saving: 11, description: 'The just-right box for your favourite dessert moment.', image: productImages.classic, tag: 'MOST LOVED · SAVE ₹11', unitValue: '₹129 / 200 g', valueNote: 'Save ₹9 compared with two Mini boxes' },
  { id: 'share', name: 'Dear Misu Share Box', weight: '300 g', price: 189, referencePrice: 210, saving: 21, description: 'More layers, more spoons, more reasons to gather.', image: productImages.share, tag: 'BEST VALUE · SAVE ₹21', unitValue: '₹189 / 300 g', valueNote: 'Save ₹18 compared with three Mini boxes' }
];
const api = process.env.NEXT_PUBLIC_API_URL || '';
const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918433198122';
const merchantUpi = process.env.NEXT_PUBLIC_MERCHANT_UPI_ID || '8433198122@ptsbi';
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Reveal({ children, className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.16 }} transition={{ duration: reduce ? 0 : .7, delay, ease: [.2, .7, .25, 1] }}>{children}</motion.div>;
}

function TiramisuHeroModel() {
  const group = useRef(null);

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
  const [cartNotice, setCartNotice] = useState('');
  const [cartShake, setCartShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [checkoutStep, setCheckoutStep] = useState('details');
  const [currentOrderRef, setCurrentOrderRef] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', fulfilment: 'Pickup', address: '', notes: '' });
  const [trackingForm, setTrackingForm] = useState({ orderId: '', phone: '' });
  const headerRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const lenis = new Lenis({
      duration: 0.7,
      smoothWheel: true,
      lerp: 0.12,
      wheelMultiplier: 1.1,
      touchMultiplier: 1.3
    });
    window.__lenis = lenis;
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
      .then(data => {
        if (!active || !Array.isArray(data.products) || !data.products.length) return; setCatalogue(data.products.map(item => ({
          id: item.id, name: item.name, weight: `${item.weightGrams} g`, price: Number(item.price),
          referencePrice: item.id === 'mini' ? 79 : item.id === 'classic' ? 140 : 210,
          saving: item.id === 'mini' ? 10 : item.id === 'classic' ? 11 : 21,
          description: item.shortDescription || 'A little dessert moment, made for you.',
          image: productImages[item.id] || productVisual,
          tag: item.id === 'share' ? 'BEST VALUE · SAVE ₹21' : item.id === 'classic' ? 'MOST LOVED · SAVE ₹11' : 'PERSONAL TREAT · SAVE ₹10',
          unitValue: `₹${Number(item.price)} / ${item.weightGrams || 100} g`,
          valueNote: item.id === 'share' ? 'Save ₹18 compared with three Mini boxes' : item.id === 'classic' ? 'Save ₹9 compared with two Mini boxes' : 'Save ₹10 on your personal box'
        })));
      })
      .catch(() => { /* Keep the bundled menu as a resilient fallback. */ });
    return () => { active = false; };
  }, []);

  const count = useMemo(() => Object.values(qty).reduce((sum, value) => sum + value, 0), [qty]);
  const total = useMemo(() => catalogue.reduce((sum, item) => sum + item.price * (qty[item.id] || 0), 0), [catalogue, qty]);
  const chosen = useMemo(() => catalogue.filter(item => (qty[item.id] || 0) > 0), [catalogue, qty]);
  const message = text => { setToast(text); window.clearTimeout(message.timer); message.timer = window.setTimeout(() => setToast(''), 2600); };
  const updateQty = (id, delta) => {
    setQty(old => ({ ...old, [id]: Math.max(0, (old[id] || 0) + delta) }));
    if (delta > 0) {
      setCartNotice('');
      message(`${catalogue.find(p => p.id === id)?.name || 'Dessert'} added to your box.`);
    }
  };
  const open = id => setModal(id);
  const close = () => {
    setModal('');
    setCartNotice('');
    if (checkoutStep === 'confirmed') {
      setCheckoutStep('details');
      setPaymentId('');
    }
  };
  const openChat = text => { window.location.assign(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`); };

  const routeToSelector = {
    '/': '#top',
    '/menu': '#menu',
    '/story': '#story',
    '/track': '#track',
    '/order-smile': '#scan',
    '/scan': '#scan',
  };

  const selectorToRoute = {
    '#top': '/',
    '#menu': '/menu',
    '#story': '/story',
    '#track': '/track',
    '#scan': '/order-smile',
    '#order-smile': '/order-smile',
  };

  const getTargetElement = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;

    if (selector === '#menu') {
      // Pinpoint the menu content/heading to completely clear the hero section and wave divider
      return el.querySelector('.menu-content') || el.querySelector('.section-heading') || el;
    }
    if (selector === '#story') {
      // Pinpoint story inner content to completely clear top divider flourishes
      return el.querySelector('.story-inner') || el;
    }
    if (selector === '#track') {
      // Pinpoint tracking card container
      return document.querySelector('#track') || el.querySelector('.experience-tracking') || el;
    }
    if (selector === '#scan') {
      // Pinpoint scan & order card
      return el.querySelector('.scan-card') || el.querySelector('.section-wrap') || el;
    }
    return el;
  };

  const scrollToRoute = (route, immediate = false) => {
    if (typeof window === 'undefined') return;

    if (route === '/' || route === '#top') {
      if (window.__lenis && !immediate) {
        window.__lenis.scrollTo(0, { duration: 0.55 });
      } else {
        window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
      }
      return;
    }

    const selector = routeToSelector[route] || (route.startsWith('#') ? route : `#${route}`);
    const targetEl = getTargetElement(selector);
    if (!targetEl) return;

    const header = headerRef.current || document.querySelector('.site-header');
    const isMobile = window.innerWidth <= 760;
    const headerH = header ? header.offsetHeight : (isMobile ? 68 : 78);
    // 20px clean clearance below header (14px on mobile)
    const breathingRoom = selector === '#track' ? (isMobile ? 16 : 24) : (isMobile ? 14 : 20);
    const dynamicOffset = -(headerH + breathingRoom);

    if (window.__lenis && !immediate) {
      window.__lenis.scrollTo(targetEl, {
        offset: dynamicOffset,
        duration: 0.55,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
      });
    } else {
      const top = targetEl.getBoundingClientRect().top + window.scrollY + dynamicOffset;
      window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
    }
  };

  const navigateToRoute = (e, route) => {
    if (e && e.preventDefault) e.preventDefault();
    setMobileNav(false);

    const cleanRoute = route.startsWith('/') ? route : (selectorToRoute[route] || '/');

    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      if (window.location.pathname !== cleanRoute || window.location.hash) {
        window.history.pushState(null, '', cleanRoute);
      }
    }

    scrollToRoute(cleanRoute);
  };

  const scrollToSection = (e, target) => navigateToRoute(e, selectorToRoute[target] || target);

  // Sync scroll position on initial load and when navigating via browser back / forward
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.location.hash) {
      const mapped = selectorToRoute[window.location.hash];
      if (mapped) {
        window.history.replaceState(null, '', mapped);
        const timer = setTimeout(() => scrollToRoute(mapped, false), 140);
        return () => clearTimeout(timer);
      }
    }

    const path = window.location.pathname;
    if (path && path !== '/' && routeToSelector[path]) {
      const timer = setTimeout(() => {
        scrollToRoute(path, false);
      }, 140);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const path = window.location.pathname;
      scrollToRoute(path || '/', false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const getNextOrderRef = async () => {
    if (api) {
      try {
        const response = await fetch(`${api}/api/orders/next-ref`);
        if (response.ok) {
          const data = await response.json();
          if (data.orderRef) return data.orderRef;
        }
      } catch {
        // Fallback to client sequence
      }
    }
    try {
      const stored = parseInt(localStorage.getItem('dearmisu_order_seq') || '1000', 10);
      const next = stored + 1;
      localStorage.setItem('dearmisu_order_seq', String(next));
      return `DEAR-${String(next).padStart(4, '0')}`;
    } catch {
      return `DEAR-${Math.floor(1001 + Math.random() * 8999)}`;
    }
  };

  const showCheckout = () => {
    if (!count) {
      setCartNotice('You need to add to cart first');
      setCartShake(false);
      requestAnimationFrame(() => {
        setCartShake(true);
      });
      setTimeout(() => setCartShake(false), 500);
      return message('You need to add to cart first');
    }
    setCartNotice('');
    setCheckoutStep('details');
    setPaymentId('');
    setPaymentError('');
    setCopiedUpi(false);
    open('checkout');
  };

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (!count || busy) return;
    if (!form.name.trim()) return message('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(form.phone)) return message('Please enter a valid 10-digit Indian mobile number.');
    if (form.fulfilment === 'Delivery' && !form.address.trim()) return message('Please add your delivery address.');

    setBusy(true);
    try {
      const ref = await getNextOrderRef();
      setCurrentOrderRef(ref);
      setCheckoutStep('payment');
    } catch {
      message('Unable to initialize order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyUpiId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(merchantUpi);
    }
    setCopiedUpi(true);
    message('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleVerifyAndSendOrder = async (e) => {
    e.preventDefault();
    if (busy) return;
    const cleanPaymentId = paymentId.trim();
    if (!cleanPaymentId) {
      setPaymentError('Please enter your 12-digit UPI / UTR Transaction ID from the receipt.');
      return;
    }
    if (cleanPaymentId.length < 6) {
      setPaymentError('Please enter a valid UPI / UTR Transaction ID (at least 6 characters).');
      return;
    }
    setPaymentError('');
    setBusy(true);

    const payload = {
      orderRef: currentOrderRef,
      customerName: form.name.trim(),
      phone: form.phone,
      fulfilment: form.fulfilment,
      address: form.fulfilment === 'Delivery' ? form.address.trim() : null,
      notes: form.notes.trim() || null,
      payment: 'UPI payment',
      paymentId: cleanPaymentId,
      items: chosen.map(item => ({ productId: item.id, quantity: qty[item.id] }))
    };

    try {
      if (api) {
        const response = await fetch(`${api}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not register order with server.');
      }

      const lines = chosen.map(item => `• ${item.name} (${item.weight}) × ${qty[item.id]} = ${money(item.price * qty[item.id])}`).join('\n');
      const text = `Hi Dear Misu! I have completed the UPI payment for my order.\n\n` +
        `✅ *PAYMENT CONFIRMED VIA UPI*\n` +
        `💳 *Payment ID / UTR:* ${cleanPaymentId}\n` +
        `🧾 *Order ID:* ${currentOrderRef}\n` +
        `💰 *Amount Paid:* ${money(total)}\n\n` +
        `👤 *Customer Details:*\n` +
        `• Name: ${form.name.trim()}\n` +
        `• Mobile: ${form.phone}\n` +
        `• Fulfilment: ${form.fulfilment}` +
        (form.fulfilment === 'Delivery' && form.address ? `\n• Address: ${form.address.trim()}` : '') +
        (form.notes ? `\n• Notes: ${form.notes.trim()}` : '') +
        `\n\n📦 *Items:*\n${lines}\n\n` +
        `Please confirm receipt and dispatch schedule. Thank you!`;

      openChat(text);
      setQty(Object.fromEntries(catalogue.map(item => [item.id, 0])));
      setCheckoutStep('confirmed');
      message(`Payment verified! Order ${currentOrderRef} confirmed on WhatsApp.`);
    } catch (error) {
      message(error.message || 'Could not submit order. Please retry.');
    } finally {
      setBusy(false);
    }
  };

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
  const stageDescriptions = ['Your request has reached Dear Misu.', 'Your order is confirmed.', 'Your dessert is being prepared.', 'Your box is on its way.', 'Time for your first spoonful!'];
  const currentStage = tracking ? Math.max(0, timeline.indexOf(tracking.status)) : 0;

  return (
    <>
      <div className="scroll-progress"><span className="progress-bar" /></div>
      <div className="announcement"><span className="sparkle">✦</span> A little box of happiness, made with care <span className="sparkle">✦</span></div>
      <header ref={headerRef} className="site-header" id="top">
        <a className="brand" href="/" onClick={e => navigateToRoute(e, '/')} aria-label="Dear Misu home"><span className="brand-mark brand-image-mark"><img src="/images/dear-misu-badge.webp" alt="" width={48} height={48} /></span><span className="brand-copy"><strong>Dear Misu</strong><small>T I R A M I S U</small></span></a>
        <nav className="desktop-nav">
          <a href="/menu" onClick={e => navigateToRoute(e, '/menu')}>Our Menu</a>
          <a href="/story" onClick={e => navigateToRoute(e, '/story')}>Our Story</a>
          <a href="/track" onClick={e => navigateToRoute(e, '/track')}>Track Order</a>
          <a href="/order-smile" onClick={e => navigateToRoute(e, '/order-smile')}>Order Smile</a>
        </nav>
        <div className="header-actions"><button className="cart-trigger" onClick={() => open('cart')}><ShoppingBag size={16} /><span>Your Box</span><b>{count}</b></button><button className="menu-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button></div>
      </header>
      {mobileNav && (
        <nav className="mobile-nav open">
          <a onClick={e => navigateToRoute(e, '/menu')} href="/menu">Our Menu</a>
          <a onClick={e => navigateToRoute(e, '/story')} href="/story">Our Story</a>
          <a onClick={e => navigateToRoute(e, '/track')} href="/track">Track Order</a>
          <a onClick={e => navigateToRoute(e, '/order-smile')} href="/order-smile">Order Smile</a>
        </nav>
      )}
      <main>
        <section ref={heroRef} className="hero section-wrap" aria-label="Welcome to Dear Misu">
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
              <div className="eyebrow reveal-block"><span className="eyebrow-line" /> A LITTLE MOMENT OF INDULGENCE <span className="eyebrow-line" /></div>
              <h1 className="hero-title reveal-block">
                <span className="hero-word-line"><span className="hero-word">Some</span> <span className="hero-word">moments</span></span>
                <span className="hero-word-line"><span className="hero-word">deserve</span> <span className="hero-word">an</span> <span className="hero-word hero-word-accent">extra</span></span>
                <span className="hero-word-line"><span className="hero-word hero-word-accent">spoonful.</span></span>
              </h1>
              <p className="hero-tagline reveal-block">Layers of Love, in Every Bite.</p>
              <p className="hero-desc reveal-block"><span className="hero-desc-desktop">Meet your new little indulgence: soft coffee-kissed layers, dreamy cream and a generous snowfall of cocoa.</span><span className="hero-desc-mobile">Meet your new little indulgence — soft coffee-kissed layers, dreamy cream and a generous snowfall of cocoa.</span></p>
              <div className="hero-actions reveal-block">
                <a className="button button-dark" href="/menu" onClick={e => navigateToRoute(e, '/menu')}>Explore Our Desserts <ArrowUpRight size={16} /></a>
                <button className="button button-light" onClick={() => open('qr')}><CirclePlay size={18} /> Discover Our Story</button>
              </div>
              <div className="hero-proof reveal-block"><span className="proof-stars">♥</span><span>MADE WITH LOVE · CREATED FOR YOU</span></div>
            </div>
          </div>
          <div className="hero-art hero-visual-wrap">
            
            <div className="hero-note" aria-hidden="true">Made with<br /><em>love ♡</em></div>
            <div className="hero-badge"><span>THE</span><strong>Little<br />Luxury</strong><em>You Deserve</em></div>
          </div>
          <div className="hero-scroll"><span>Scroll to explore</span><span className="scroll-arrow">⌄</span></div>
          <WaveDivider variant="hero" fill="var(--paper)" underFill="rgba(198, 163, 106, 0.16)" stroke="rgba(198, 163, 106, 0.55)" />
        </section>
        <div className="mobile-benefits" aria-label="Premium ingredients, freshly handcrafted, made with love">
          <div className="mobile-benefit"><Leaf aria-hidden="true" /><span>Premium<br />Ingredients</span></div>
          <div className="mobile-benefit"><CakeSlice aria-hidden="true" /><span>Freshly<br />Handcrafted</span></div>
          <div className="mobile-benefit"><Heart aria-hidden="true" /><span>Made<br />with Love</span></div>
        </div>
        <section className="menu-section section-wrap" id="menu">
          <div className="menu-content">
            <Reveal className="section-heading">
              <div>
                <div className="eyebrow left"><span className="desktop-menu-eyebrow">THE MENU</span><span className="mobile-menu-eyebrow">OUR TIRAMISU</span> <span className="eyebrow-line" /></div>
                <h2><span className="desktop-menu-title">Pick your <em>happy.</em></span><span className="mobile-menu-title">Explore Our Desserts</span></h2>
                <p>Three sizes. One very good decision. Made for a little treat or a lot of sharing.</p>
              </div>
            </Reveal>
            <div className="product-grid">{catalogue.map((item, index) => (
              <Reveal key={item.id} delay={index * .1} className={`product-card ${item.id === 'classic' ? 'featured' : ''} ${item.id === 'share' ? 'best-value' : ''}`}>
                <div className={`product-photo photo-${item.id}`}>
                  <img className="product-open-gif" src={item.image} alt={`${item.name}, ${item.weight} tiramisu served on a plate`} width={712} height={515} loading="lazy" decoding="async" />
                  <span className={`photo-tag ${item.saving > 0 ? 'featured-tag' : ''}`}>
                    {item.id === 'mini' ? <Sparkles size={15} fill="currentColor" /> : item.id === 'classic' ? <Heart size={16} fill="currentColor" /> : <Package size={15} />}
                    {item.tag}
                  </span>
                </div>
                <div className="product-info">
                  <div className="product-meta"><span>0{index + 1} / {item.id.toUpperCase()}</span><span>{item.weight}</span></div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="product-buy">
                    <div className="listing-price">
                      <div className="listing-price-line">
                        <strong>{item.unitValue}</strong>
                        {item.saving > 0 && <del>{money(item.referencePrice)}</del>}
                      </div>
                      <small>Box total {money(item.price)}</small>
                    </div>
                    {(qty[item.id] || 0) > 0 ? (
                      <div className="add-button listing-add quantity-control" role="group" aria-label={`${item.name} quantity`}>
                        <button type="button" className="quantity-step" onClick={() => updateQty(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}><Minus size={13} /></button>
                        <span className="quantity-value" aria-live="polite" aria-atomic="true">{qty[item.id]}</span>
                        <button type="button" className="quantity-step" onClick={() => updateQty(item.id, 1)} aria-label={`Increase ${item.name} quantity`}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <button className="add-button listing-add" onClick={() => updateQty(item.id, 1)}>Add to box <span>＋</span></button>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}</div>
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
            
          </div>

          <div className="story-inner section-wrap">
            <Reveal className="story-visual">
              <div className="story-visual-wrap">
                <div className="story-card-backdrop" aria-hidden="true" />
                <div className="story-card-cushion" aria-hidden="true" />

                <div className="story-photo-card">
                  <img src="/images/cocoa-dusted-tiramisu.webp" alt="Cocoa-dusted tiramisu layered with cream in a serving box" width="1200" height="800" loading="lazy" decoding="async" />
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

              <p className="story-lead">Dear Misu is our love letter to the little moments that deserve something special.</p>

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
                <a className="story-cta-btn" href="/menu" onClick={e => navigateToRoute(e, '/menu')}>
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
        <ExperienceSection onTrackOrder={() => open('track')} tracking={tracking} />
        <CurveDivider />
        <section className="scan-section" id="scan"><div className="section-wrap"><Reveal className="scan-card"><div className="scan-copy"><div className="eyebrow left">QUICK AS A SCAN <span className="eyebrow-line" /></div><h2>Craving? <em>Scan.</em><br />Order. Smile.</h2><p>Scan to open a WhatsApp chat with Dear Misu. No long forms, no fuss — just your next favourite dessert.</p><a className="underlined-link" href={`https://wa.me/${whatsapp}?text=Hi%20Dear%20Misu!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer">Chat with us <ArrowUpRight size={15} /></a></div><div className="scan-code-wrap"><div className="scan-qr-frame"><img src="/images/order-qr.png" alt="QR code to order Dear Misu on WhatsApp" width={470} height={470} loading="lazy" /></div><span>SCAN TO ORDER</span><small>WhatsApp · 8433198122</small></div></Reveal></div></section>
        <WaveDivider variant="to-dark" bg="var(--paper)" fill="var(--espresso)" underFill="rgba(198, 163, 106, 0.22)" stroke="rgba(214, 173, 112, 0.55)" />
        <section className="closing-section"><div className="closing-inner section-wrap"><div className="closing-emblem" aria-hidden="true"><span /><span className="closing-cake"><i /><i /><i /></span><span /></div><p>One last spoon?</p><h2>Make room for <em>sweet things.</em></h2><a className="button button-cream" href="/menu" onClick={e => navigateToRoute(e, '/menu')}>Order your Dear Misu <ArrowUpRight size={16} /></a></div></section>
      </main>
      <CurveDivider />
      <footer className="site-footer">
        <div className="footer-divider section-wrap" aria-hidden="true"><span>✦</span></div>
        <div className="footer-main section-wrap">
          <div className="footer-brand">
            <a className="brand brand-footer" href="/" onClick={e => navigateToRoute(e, '/')}><span className="brand-mark brand-image-mark"><img src="/images/dear-misu-badge.webp" alt="" width={48} height={48} /></span><span className="brand-copy"><strong>Dear Misu</strong><small>T I R A M I S U</small></span></a>
            <p>Layers of Love, in Every Bite.</p>
            <div className="footer-socials" aria-label="Social media">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>
              <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={20} /></a>
            </div>
          </div>
          <div className="footer-links">
            <div><b>EXPLORE</b><a href="/menu" onClick={e => navigateToRoute(e, '/menu')}>Our Menu</a><a href="/story" onClick={e => navigateToRoute(e, '/story')}>Our Story</a><a href="/track" onClick={e => navigateToRoute(e, '/track')}>Track Order</a><a href="/order-smile" onClick={e => navigateToRoute(e, '/order-smile')}>Order Smile</a></div>
            <div><b>GOOD TO KNOW</b><span><Package size={20} />Dessert made with care</span><span><Truck size={20} />Pickup / Delivery Confirmation</span></div>
          </div>
        </div>
        <div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} Dear Misu Tiramisu. All rights reserved.</span><span>Made with a little extra love <b><Heart size={20} /></b></span><a href="/" onClick={e => navigateToRoute(e, '/')}>Back to top <ArrowUpRight size={17} /></a></div>
      </footer>

      <div className="floating-order"><button className="floating-whatsapp" onClick={() => open('qr')}><QrCode size={13} /> Scan & order</button><button className="floating-cart" onClick={() => open('cart')}>Box <b>{count}</b><strong>{money(total)}</strong></button></div>

      {modal === 'cart' && (
        <Modal onClose={close} className="cart-modal" showHeader={false}>
          <div className="cart-modal-art">
            <img src={productVisual} alt="Cocoa-dusted tiramisu in a glass dessert cup" width={1200} height={800} loading="lazy" decoding="async" />
          </div>
          <div className="cart-modal-copy">
            <div className="eyebrow left">YOUR LITTLE BOX <span className="eyebrow-line" /></div>
            <h2>A Good Choice.</h2>
            {chosen.length ? (
              <div className="cart-lines">
                {chosen.map(item => (
                  <div className="cart-line" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.weight} · {money(item.price)} each</small>
                    </div>
                    <div className="cart-line-actions">
                      <button onClick={() => updateQty(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus size={11} /></button>
                      <b>{qty[item.id]}</b>
                      <button onClick={() => updateQty(item.id, 1)} aria-label={`Add one ${item.name}`}><Plus size={11} /></button>
                    </div>
                    <strong>{money(item.price * qty[item.id])}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-cart-wrap">
                <p className="empty-cart">Your box is waiting for something delicious.</p>
                <button
                  type="button"
                  className="button button-dark empty-cart-browse"
                  onClick={() => { close(); window.location.hash = '#menu'; }}
                >
                  <Sparkles size={13} /> Browse Our Desserts
                </button>
              </div>
            )}
            <div className="cart-footer">
              {cartNotice && !count && (
                <div className="cart-pop-notice" role="alert">
                  <AlertCircle size={15} />
                  <span>{cartNotice}</span>
                </div>
              )}
              <div className="cart-summary">
                <span><ShoppingBag size={15} />Subtotal</span>
                <strong>{money(total)}</strong>
              </div>
              <button
                className={`button button-dark button-full ${cartShake ? 'cart-button-shake' : ''}`}
                onClick={showCheckout}
              >
                <ShoppingBag size={16} />Continue to Details <ArrowUpRight size={17} />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'checkout' && (
        <Modal
          title={
            checkoutStep === 'confirmed' ? (
              <>Order <em>Confirmed!</em></>
            ) : checkoutStep === 'payment' ? (
              <>Pay via <em>UPI.</em></>
            ) : (
              <>Let’s get you <em>your Dear Misu.</em></>
            )
          }
          eyebrow={
            checkoutStep === 'confirmed'
              ? 'ORDER PLACED'
              : checkoutStep === 'payment'
                ? `STEP 2 OF 2 · ORDER ${currentOrderRef}`
                : 'STEP 1 OF 2 · YOUR DETAILS'
          }
          onClose={close}
          wide
        >
          {checkoutStep === 'details' && (
            <form onSubmit={handleProceedToPayment}>
              <div className="form-grid">
                <label>
                  Your name
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="How should we call you?"
                  />
                </label>
                <label>
                  Mobile number (WhatsApp)
                  <input
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit mobile number"
                  />
                </label>
                <div className="full-span">
                  <span className="field-title">How would you like it?</span>
                  <div className="fulfilment-pills">
                    <button
                      type="button"
                      className={`pill-btn ${form.fulfilment === 'Pickup' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, fulfilment: 'Pickup' })}
                    >
                      <Package size={15} /> Pickup
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${form.fulfilment === 'Delivery' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, fulfilment: 'Delivery' })}
                    >
                      <Truck size={15} /> Delivery
                    </button>
                  </div>
                </div>
                {form.fulfilment === 'Delivery' && (
                  <label className="full-span">
                    Delivery address
                    <textarea
                      required
                      rows={2}
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="House / flat no., street, area, landmark, city"
                    />
                  </label>
                )}
                <label className="full-span">
                  Anything we should know? <small className="opt-label">(Optional)</small>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Preferred timing, delivery instructions…"
                  />
                </label>
              </div>

              <div className="checkout-summary">
                <div className="checkout-summary-copy">
                  <span>Your box · {count} item{count === 1 ? '' : 's'}</span>
                  <small className="upi-ready-tag">🔒 Payment via Instant UPI (GPay / PhonePe / Paytm / QR)</small>
                </div>
                <strong>{money(total)}</strong>
              </div>

              <button className="button button-dark button-full" type="submit" disabled={busy}>
                {busy ? 'Preparing order…' : `Proceed to Pay ${money(total)} via UPI`} <ArrowUpRight size={16} />
              </button>
            </form>
          )}

          {checkoutStep === 'payment' && (
            <div className="upi-payment-view">
              <div className="upi-order-meta">
                <span className="meta-badge order-badge">Order: <b>{currentOrderRef}</b></span>
                <span className="meta-badge amount-badge">Payable: <b>{money(total)}</b></span>
              </div>

              <div className="upi-payment-card">
                <div className="upi-vpa-row">
                  <div>
                    <span className="upi-vpa-label">OFFICIAL STORE UPI ID</span>
                    <strong className="upi-vpa-value">{merchantUpi}</strong>
                  </div>
                  <button type="button" className="copy-btn" onClick={copyUpiId}>
                    {copiedUpi ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>

                <div className="upi-qr-box">
                  <div className="qr-image-wrapper">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                        `upi://pay?pa=${merchantUpi}&pn=Dear Misu%20Tiramisu&am=${total}&cu=INR&tn=Order%20${currentOrderRef}`
                      )}`}
                      alt="UPI QR Code"
                      width={180}
                      height={180}
                    />
                  </div>
                  <p className="qr-guide-text">Scan with Google Pay, PhonePe, Paytm, or any UPI app</p>
                </div>

                <div className="upi-intent-action">
                  {/* Primary: Generic UPI intent - opens app chooser on Android / passes to iOS UPI apps */}
                  <a
                    className="button button-dark button-full upi-app-launch upi-primary-btn"
                    href={`upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}&tr=${encodeURIComponent(currentOrderRef)}`}
                    onClick={e => {
                      // On desktop/unsupported: fallback to copying UPI ID
                      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                      if (!isMobile) {
                        e.preventDefault();
                        copyUpiId();
                        message('UPI ID copied! Open your UPI app and pay manually.');
                      }
                    }}
                  >
                    📱 Open UPI App to Pay {money(total)}
                  </a>

                  {/* Per-app deep links with official brand logos */}
                  <div className="upi-apps-grid">

                    {/* Google Pay */}
                    <a className="upi-app-pill" href={`gpay://upi/pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}`} title="Pay with Google Pay">
                      <img src="/images/upi/gpay.webp" alt="Google Pay" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>GPay</span>
                    </a>

                    {/* PhonePe */}
                    <a className="upi-app-pill" href={`phonepe://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}`} title="Pay with PhonePe">
                      <img src="/images/upi/phonepe.webp" alt="PhonePe" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>PhonePe</span>
                    </a>

                    {/* Paytm */}
                    <a className="upi-app-pill" href={`paytmmp://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}`} title="Pay with Paytm">
                      <img src="/images/upi/paytm.webp" alt="Paytm" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>Paytm</span>
                    </a>

                    {/* CRED */}
                    <a className="upi-app-pill" href={`credpay://upi/pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}`} title="Pay with CRED">
                      <img src="/images/upi/cred.webp" alt="CRED" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>CRED</span>
                    </a>

                    {/* Amazon Pay */}
                    <a className="upi-app-pill" href={`upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}&app=amazon`} title="Pay with Amazon Pay">
                      <img src="/images/upi/amazonpay.webp" alt="Amazon Pay" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>Amazon</span>
                    </a>

                    {/* BHIM UPI */}
                    <a className="upi-app-pill" href={`upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent('Dear Misu Tiramisu')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + currentOrderRef)}`} title="Pay with BHIM or any UPI bank app">
                      <img src="/images/upi/bhim.webp" alt="BHIM UPI" className="upi-app-logo-img" width={40} height={40} loading="eager" />
                      <span>BHIM / Other</span>
                    </a>

                  </div>

                  <p className="upi-apps-hint">↑ Tap to open your preferred UPI app directly</p>
                </div>
              </div>

              <form onSubmit={handleVerifyAndSendOrder} className="utr-confirmation-form">
                <div className="utr-field">
                  <label htmlFor="utr-input-field">
                    <strong>Enter 12-digit UPI / UTR Transaction ID *</strong>
                    <span>Complete payment above, then copy the 12-digit UTR/Ref ID from your UPI app receipt</span>
                  </label>
                  <input
                    id="utr-input-field"
                    required
                    value={paymentId}
                    onChange={e => {
                      setPaymentId(e.target.value.trim());
                      if (paymentError) setPaymentError('');
                    }}
                    placeholder="e.g. 431289567123"
                    className={paymentError ? 'input-error' : ''}
                  />
                  {paymentError && <span className="field-error-text">{paymentError}</span>}
                </div>

                <p className="order-whatsapp-notice">
                  ⚠️ Your order and official receipt will be sent to WhatsApp only after you enter the Payment ID above.
                </p>

                <div className="modal-dual-actions">
                  <button
                    type="button"
                    className="button button-light btn-back-step"
                    onClick={() => setCheckoutStep('details')}
                    disabled={busy}
                  >
                    <ArrowLeft size={16} /> Edit Details
                  </button>
                  <button
                    type="submit"
                    className="button button-dark btn-confirm-pay"
                    disabled={busy || !paymentId.trim()}
                  >
                    {busy ? 'Registering Order…' : 'Verify & Send to WhatsApp'} <ArrowUpRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {checkoutStep === 'confirmed' && (
            <div className="confirmed-view">
              <div className="confirmed-celebration">
                <div className="check-ring">
                  <CheckCircle2 size={44} />
                </div>
                <h3>Payment & Order Received!</h3>
                <p>
                  Order <strong>{currentOrderRef}</strong> with Payment ID <code>{paymentId}</code> is confirmed and sent to WhatsApp.
                </p>
              </div>

              <div className="confirmed-summary-card">
                <div className="summary-item"><span>Order ID</span><strong>{currentOrderRef}</strong></div>
                <div className="summary-item"><span>Payment UTR</span><strong>{paymentId}</strong></div>
                <div className="summary-item"><span>Customer</span><strong>{form.name} ({form.phone})</strong></div>
                <div className="summary-item"><span>Fulfilment</span><strong>{form.fulfilment}</strong></div>
                <div className="summary-item"><span>Total Paid</span><strong>{money(total)}</strong></div>
              </div>

              <div className="confirmed-footer-actions">
                <button
                  type="button"
                  className="button button-dark button-full"
                  onClick={() => {
                    close();
                    setCheckoutStep('details');
                  }}
                >
                  Done, Enjoy Your Dear Misu!
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === 'track' && <Modal title={<>Track your <em>box.</em></>} eyebrow="ORDER UPDATES" onClose={close}><form className="track-form" onSubmit={trackOrder}><label>Order reference<input required value={trackingForm.orderId} onChange={e => setTrackingForm({ ...trackingForm, orderId: e.target.value })} placeholder="e.g. DEAR-2048" /></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={trackingForm.phone} onChange={e => setTrackingForm({ ...trackingForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Phone used for order" /></label><button className="button button-dark button-full" type="submit">Find my order <ArrowUpRight size={16} /></button></form>{trackingError && <div className="track-result"><p>{trackingError}</p></div>}{tracking && <div className="track-result"><h3>{tracking.orderRef} · {String(tracking.status).replaceAll('_', ' ')}</h3><p>{tracking.customerName} · {tracking.fulfilment} · {money(tracking.total)}</p>{stageLabels.map((label, i) => <div className="status-line" key={label}><span className={`status-dot ${i <= currentStage ? 'complete' : ''}`} /><div className="status-copy"><b>{label}</b><small>{stageDescriptions[i]}</small></div></div>)}{tracking.events?.length > 0 && <div className="tracking-events"><b>Latest updates</b>{tracking.events.map((event, i) => <p key={i}>{String(event.status).replaceAll('_', ' ')} · {new Date(event.created_at).toLocaleString()}</p>)}</div>}</div>}<p className="form-disclaimer">Live order status appears after the Express API and PostgreSQL database are connected.</p></Modal>}

      {modal === 'qr' && <Modal onClose={close} className="qr-order-modal" showHeader={false}>
        <div className="qr-order-layout">
          <div className="qr-order-panel">
            <div className="eyebrow left">THE FASTEST WAY TO DEAR MISU <span className="eyebrow-line" /></div>
            <h2>Scan. Order. <em>Smile.</em></h2>
            <div className="qr-code-decoration">
              <span className="qr-ray qr-ray-left" aria-hidden="true" />
              <div className="qr-code-frame"><img src="/images/order-qr.png" alt="Scan to start a Dear Misu WhatsApp order" width={470} height={470} loading="lazy" /></div>
              <span className="qr-ray qr-ray-right" aria-hidden="true" />
            </div>
            <p className="qr-caption">Point your camera here to start a WhatsApp order.</p>
            <a className="qr-whatsapp-cta" href={`https://wa.me/${whatsapp}?text=Hi%20Dear%20Misu!%20I%27d%20like%20to%20order%20tiramisu.`} target="_blank" rel="noreferrer"><span className="whatsapp-mark"><MessageCircle /><Phone /></span> Open WhatsApp <ArrowUpRight size={17} /></a>
            <div className="qr-phone"><span /><Phone size={15} /><a href={`tel:${whatsapp}`}>8433198122</a><span /></div>
          </div>
        </div>
      </Modal>}

      {toast && (
        <div
          className={`toast show ${toast.toLowerCase().includes('first') || toast.toLowerCase().includes('please') || toast.toLowerCase().includes('unable') || toast.toLowerCase().includes('valid') ? 'toast-alert' : 'toast-success'}`}
          role="status"
        >
          {toast.toLowerCase().includes('first') || toast.toLowerCase().includes('please') || toast.toLowerCase().includes('unable') || toast.toLowerCase().includes('valid') ? (
            <AlertCircle size={15} className="toast-icon-svg" />
          ) : (
            <Sparkles size={14} className="toast-icon-svg" />
          )}
          <span>{toast}</span>
        </div>
      )}
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
const trackingStageByStatus = {
  placed: 0,
  confirmed: 0,
  preparing: 1,
  out_for_delivery: 2,
  delivered: 3
};

function ExperienceSection({ onTrackOrder, tracking }) {
  const activeStage = tracking ? trackingStageByStatus[tracking.status] ?? -1 : -1;
  const timelineLabel = tracking
    ? `Current order status: ${String(tracking.status).replaceAll('_', ' ')}. Stages: ${trackingStages.join(', ')}.`
    : `Order stages: ${trackingStages.join(', ')}. Track an order to see its current status.`;

  return (
    <section className="experience-section" id="moments">
      <div className="experience-layout">
        <figure className="experience-photo">
          <span className="experience-photo-shadow" aria-hidden="true" />
          <img
            src="/images/cocoa-dusted-tiramisu.webp"
            alt="Cocoa-dusted tiramisu layered with cream in a serving box"
            width="1200"
            height="800"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <div className="experience-content">
          <Reveal className="experience-intro">
            <div className="eyebrow left">THE DEAR MISU FEELING <span className="eyebrow-line" /></div>
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

          <Reveal className="experience-tracking-wrap" delay={0.1}>
            <div className="experience-tracking" id="track" aria-labelledby="experience-tracking-title">
              <div className="experience-tracking-copy">
                <h3 id="experience-tracking-title">Where’s my <em>Dear Misu?</em></h3>
                <p>Have an order reference? Follow your order from confirmation to the first spoonful.</p>
                <button className="experience-tracking-button" onClick={onTrackOrder}>
                  Track my order <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="experience-timeline" role="img" aria-label={timelineLabel}>
                <div className="experience-timeline-line" aria-hidden="true" />
                {trackingStages.map((stage, index) => (
                  <div className="experience-timeline-stage" key={stage}>
                    <span
                      className={`experience-timeline-dot${index === activeStage ? ' is-active' : index < activeStage ? ' is-complete' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{stage}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
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

function Modal({ children, title = '', eyebrow = '', onClose = () => { }, wide = false, className = '', showHeader = true }) {
  useEffect(() => {
    document.documentElement.classList.add('has-modal');
    document.body.classList.add('has-modal');
    const lenisInstance = window.__lenis;
    if (lenisInstance) lenisInstance.stop();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.documentElement.classList.remove('has-modal');
      document.body.classList.remove('has-modal');
      if (lenisInstance) lenisInstance.start();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={`modal-backdrop open${className ? ` ${className}-backdrop` : ''}`}
      role="presentation"
      data-lenis-prevent="true"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
    >
      <div
        className={`modal ${wide ? 'modal-checkout' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        data-lenis-prevent="true"
        onClick={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
        {showHeader && (
          <>
            <div className="eyebrow left">{eyebrow} <span className="eyebrow-line" /></div>
            <h2>{title}</h2>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
