const PRODUCTS = {
  mini: { id: 'mini', name: 'TiraMio Mini', weight: '100 g', price: 69 },
  classic: { id: 'classic', name: 'TiraMio Classic', weight: '200 g', price: 129 },
  share: { id: 'share', name: 'TiraMio Share Box', weight: '300 g', price: 189 }
};
const PHONE = '918433198122';
const cart = { mini: 0, classic: 0, share: 0 };
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const money = n => `₹${n.toLocaleString('en-IN')}`;
const itemCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
const subtotal = () => Object.entries(cart).reduce((total, [id, qty]) => total + PRODUCTS[id].price * qty, 0);
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function refreshCart() {
  const count = itemCount(), total = subtotal();
  $('#cart-count').textContent = count; $('#floating-count').textContent = count;
  $('#floating-total').textContent = money(total); $('#builder-total').textContent = money(total);
  $('#cart-subtotal').textContent = money(total);
  Object.keys(cart).forEach(id => $(`#qty-${id}`).textContent = cart[id]);
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  $('#cart-lines').innerHTML = lines.length ? lines.map(([id, qty]) => {
    const p = PRODUCTS[id]; return `<div class="cart-line"><div><strong>${p.name}</strong><small>${p.weight} · ${money(p.price)} each</small></div><div class="cart-line-actions"><button data-qty="${id}" data-dir="-1" aria-label="Decrease ${p.name}">−</button><b>${qty}</b><button data-qty="${id}" data-dir="1" aria-label="Increase ${p.name}">+</button></div><strong>${money(qty * p.price)}</strong></div>`;
  }).join('') : '<p class="empty-cart">Your box is waiting for something delicious.</p>';
  $('#checkout-summary-text').textContent = `Your box · ${count} item${count === 1 ? '' : 's'}`;
  $('#checkout-total').textContent = money(total);
}
function add(id, delta = 1) {
  cart[id] = Math.max(0, cart[id] + delta); refreshCart();
  if (delta > 0) toast(`${PRODUCTS[id].name} added to your box.`);
}
function openModal(id) { const modal = document.getElementById(id); modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeModal(id) { const modal = document.getElementById(id); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
function openCheckout() {
  if (!itemCount()) { toast('Choose at least one TiraMio box first.'); return; }
  closeModal('cart-modal'); refreshCart(); openModal('checkout-modal');
}
function buildWhatsAppMessage(data) {
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => `• ${PRODUCTS[id].name} (${PRODUCTS[id].weight}) × ${qty} = ${money(PRODUCTS[id].price * qty)}`).join('\n');
  return `Hi TiraMio! I'd like to place an order.\n\n${items}\n\nSubtotal: ${money(subtotal())}\n\nName: ${data.name}\nMobile: ${data.phone}\nFulfilment: ${data.fulfilment}${data.address ? `\nAddress: ${data.address}` : ''}\nPayment preference: ${data.payment}${data.notes ? `\nNotes: ${data.notes}` : ''}\n\nPlease confirm availability and the final total. Thank you!`;
}
function makeOrderRef() { return `TIRA-${Math.floor(1000 + Math.random() * 9000)}`; }
function saveDemoOrder(order) { const existing = JSON.parse(localStorage.getItem('tiramio-demo-orders') || '[]'); existing.unshift(order); localStorage.setItem('tiramio-demo-orders', JSON.stringify(existing.slice(0, 20))); }
function renderTimeline(order) {
  const steps = [
    ['Order placed', 'We have received your request.'],
    ['Confirmed', 'TiraMio has confirmed your order.'],
    ['Preparing', 'Your dessert is being prepared.'],
    ['Out for delivery', 'Your box is on its way.'],
    ['Delivered', 'Time for your first spoonful!']
  ];
  const current = Math.max(0, steps.findIndex(s => s[0] === order.status));
  return `<h3>${order.ref} · ${order.status}</h3><p>${order.name ? `For ${order.name} · ` : ''}${order.fulfilment || 'Order'} · ${money(order.total || 0)}</p>${steps.map((s,i)=>`<div class="status-line"><span class="status-dot ${i<=current?'complete':''}"></span><div class="status-copy"><b>${s[0]}</b><small>${s[1]}</small></div></div>`).join('')}`;
}
// Click delegation keeps the same controls working after the cart re-renders.
document.addEventListener('click', e => {
  const addButton = e.target.closest('[data-add]'); if (addButton) add(addButton.dataset.add);
  const qtyButton = e.target.closest('[data-qty]'); if (qtyButton) add(qtyButton.dataset.qty, Number(qtyButton.dataset.dir));
  const closer = e.target.closest('[data-close]'); if (closer) closeModal(closer.dataset.close);
  const opener = e.target.closest('[data-open-cart]'); if (opener) openModal('cart-modal');
  if (e.target.closest('[data-open-track]')) { $('#track-result').innerHTML = '<p>Enter your order reference and mobile number to see the latest update.</p>'; openModal('track-modal'); }
  if (e.target.closest('[data-open-qr]')) openModal('qr-modal');
});
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(backdrop.id); }));
$('#cart-checkout').addEventListener('click', openCheckout);
$('#continue-order').addEventListener('click', openCheckout);
$('#checkout-form').elements.fulfilment.addEventListener('change', e => {
  const address = $('#address-field'); address.hidden = e.target.value !== 'Delivery';
  address.querySelector('textarea').required = e.target.value === 'Delivery';
});
$('#checkout-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!itemCount()) { toast('Your box is empty.'); return; }
  const form = new FormData(e.currentTarget); const data = Object.fromEntries(form.entries());
  if (!/^[6-9]\d{9}$/.test(data.phone)) { toast('Please enter a valid 10-digit Indian mobile number.'); return; }
  const ref = makeOrderRef();
  const order = { ref, phone: data.phone, name: data.name, fulfilment: data.fulfilment, total: subtotal(), status: 'Order placed', createdAt: new Date().toISOString() };
  saveDemoOrder(order);
  const message = buildWhatsAppMessage(data);
  const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
  closeModal('checkout-modal'); toast(`Order request ${ref} is ready. Opening WhatsApp…`);
  window.open(url, '_blank', 'noopener,noreferrer');
  $('#track-result').innerHTML = renderTimeline(order) + `<p><b>Demo tracking reference:</b> ${ref}<br/>Use your mobile number in the tracking form. Live order confirmation must be connected to the production API.</p>`;
  Object.keys(cart).forEach(k => cart[k] = 0); refreshCart();
});
$('#track-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.currentTarget); const ref = String(form.get('orderId')).trim().toUpperCase(); const phone = String(form.get('phone')).trim();
  if (!/^[6-9]\d{9}$/.test(phone)) { toast('Enter the 10-digit mobile number used for the order.'); return; }
  const orders = JSON.parse(localStorage.getItem('tiramio-demo-orders') || '[]');
  const found = orders.find(o => o.ref.toUpperCase() === ref && o.phone === phone);
  if (found) $('#track-result').innerHTML = renderTimeline(found) + '<p>This is locally saved demo tracking. In production, order status comes from the secure order API.</p>';
  else $('#track-result').innerHTML = '<p><b>We couldn’t find that demo order.</b><br/>Please check the reference and mobile number, or message us on WhatsApp at 8433198122.</p>';
});
$('#menu-toggle').addEventListener('click', () => $('#mobile-nav').classList.toggle('open'));
$$('#mobile-nav a').forEach(a => a.addEventListener('click', () => $('#mobile-nav').classList.remove('open')));
$('#year').textContent = new Date().getFullYear();
const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
$$('.reveal').forEach(el => observer.observe(el));
refreshCart();

// The silent TiraMio product film loops in the opening hero background.
(() => {
  const heroVideo = document.querySelector('.hero-background-video');
  if (!heroVideo) return;
  heroVideo.muted = true;
  heroVideo.defaultMuted = true;
  heroVideo.volume = 0;
  heroVideo.loop = true;
  heroVideo.playsInline = true;
  const startPlayback = () => {
    const playAttempt = heroVideo.play();
    if (playAttempt && typeof playAttempt.catch === 'function') playAttempt.catch(() => {});
  };
  if (heroVideo.readyState >= 2) startPlayback();
  else heroVideo.addEventListener('canplay', startPlayback, { once: true });
})();
