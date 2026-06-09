// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Replace the values below with your own Firebase project's config details.
// Get these from Firebase Console > Project settings > Your apps > Firebase SDK snippet.
const firebaseConfig = {
  apiKey: "AIzaSyDhMCJT3J1YHhAHGS08Z1QfhvM55gDHpJ0",
  authDomain: "event-register-1c4f1.firebaseapp.com",
  projectId: "event-register-1c4f1",
  storageBucket: "event-register-1c4f1.firebasestorage.app",
  messagingSenderId: "667353710482",
  appId: "1:667353710482:web:74b7dbe66621ea449c0b4b",
  measurementId: "G-XPY8BGD5DL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.signInAnonymously()
  .then(() => {
    console.log('Firebase anonymous auth successful');
    // Try an initial sync after auth so writes aren't attempted before auth completes
    try { syncLocalToFirebase(); } catch (e) { console.error('Initial Firebase sync failed:', e); }
  })
  .catch(err => console.error('Firebase anonymous auth failed:', err));

auth.onAuthStateChanged(user => {
  console.log('Firebase auth state changed', { uid: user?.uid, isAnonymous: user?.isAnonymous });
});

console.log('Firebase initialized', { projectId: firebaseConfig.projectId, firestoreReady: typeof db !== 'undefined' });


// ===== STATE =====
let state = {
  adminAccounts: [{ username: 'admin', password: 'admin123' }],
  adminLoggedIn: false,
  currentAdmin: null,
  events: [],
  registrations: [],
  currentEvent: null,
  currentCaptcha: null,
  regFormData: {},
  selectedPayment: null,
  currentAdminTab: 'dashboard'
};

// ===== SPLASH =====
function enterApp() {
  document.getElementById('splash').classList.add('hide');
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').classList.add('show');
    renderHomeStats();
    renderHomeEvents();
  }, 800);
}

// ===== NAV =====
function showPage(page) {
  autoCompletePastEvents();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const nb = document.getElementById('nav-' + page);
  if (nb) nb.classList.add('active');
  if (page === 'events') renderAllEvents();
  if (page === 'home') { renderHomeStats(); renderHomeEvents(); }
  if (page === 'admin') {
    if (state.adminLoggedIn) {
      renderAdminDashboard();
    } else {
      showLoginForm();
    }
  }
  window.scrollTo(0, 0);
}

function showEventDetail(eventId) {
  autoCompletePastEvents();
  console.log('showEventDetail called for', eventId);
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return;
  state.currentEvent = ev;
  // poster
  const ph = document.getElementById('detail-poster-ph');
  ph.innerHTML = '🖼️';
  if (ev.poster) {
    const img = document.createElement('img');
    img.src = ev.poster; img.className = 'detail-hero-ph'; img.style.objectFit = 'cover';
    img.onerror = () => { ph.innerHTML = '🖼️'; };
    document.getElementById('detail-hero').replaceChild(img, ph);
  }
  document.getElementById('detail-title').textContent = ev.name;
  // chips
  const chips = document.getElementById('detail-chips');
  chips.innerHTML = `
    <span class="chip ${ev.paid ? 'orange' : 'green'}">${ev.paid ? 'Paid ₹' + ev.fee : 'Free'}</span>
    <span class="chip blue">${ev.category}</span>
    <span class="chip">${ev.status}</span>
    `;
  // meta
  const meta = document.getElementById('detail-meta-grid');
  meta.innerHTML = `
    <div class="detail-meta-item"><div class="icon">📅</div><div class="info"><div class="label">Date</div><div class="value">${formatDate(ev.date)}</div></div></div>
    <div class="detail-meta-item"><div class="icon">⏰</div><div class="info"><div class="label">Time</div><div class="value">${formatTime(ev.time)}</div></div></div>
    <div class="detail-meta-item"><div class="icon">📍</div><div class="info"><div class="label">Venue</div><div class="value">${ev.venue}</div></div></div>
    <div class="detail-meta-item"><div class="icon">👥</div><div class="info"><div class="label">Registered</div><div class="value">${getEventRegCount(ev.id)} / ${ev.capacity}</div></div></div>
    `;
  document.getElementById('detail-desc').textContent = ev.description || 'Join us for an amazing event!';
  const regSub = document.getElementById('reg-section-sub');
  if (ev.paid) regSub.textContent = `Registration fee: ₹${ev.fee}. Pay via PhonePe, GPay or Paytm.`;
  else regSub.textContent = 'Free registration! Secure your spot now.';
  document.getElementById('reg-step-3').style.display = 'none';
  const registerBtn = document.getElementById('register-btn');
  if (ev.status === 'completed') {
    if (registerBtn) {
      registerBtn.textContent = 'Event Completed';
      registerBtn.disabled = true;
      registerBtn.classList.remove('btn-primary');
      registerBtn.classList.add('btn-outline');
    }
    regSub.textContent = 'This event has been completed and registration is now closed.';
  } else {
    if (registerBtn) {
      registerBtn.textContent = 'Register Now →';
      registerBtn.disabled = false;
      registerBtn.classList.remove('btn-outline');
      registerBtn.classList.add('btn-primary');
    }
    if (ev.paid) regSub.textContent = `Registration fee: ₹${ev.fee}. Pay via PhonePe, GPay or Paytm.`;
    else regSub.textContent = 'Free registration! Secure your spot now.';
  }
  showPage('event-detail');
}

// ===== RENDER =====
function renderHomeStats() {
  const publicEvents = state.events.filter(e => e.visibility !== 'private');
  const upcoming = publicEvents.filter(e => !isEventCompleted(e)).length;
  const completed = publicEvents.filter(e => isEventCompleted(e)).length;
  document.getElementById('stat-events').textContent = upcoming;
  document.getElementById('stat-registrations').textContent = state.registrations.length;
  document.getElementById('stat-past').textContent = completed;
}

function renderHomeEvents() {
  const grid = document.getElementById('home-events-grid');
  console.log('renderHomeEvents - total events in state:', state.events.length, state.events);
  const publicEvents = state.events.filter(e => e.visibility !== 'private');
  const upcoming = publicEvents.filter(e => !isEventCompleted(e)).slice(0, 6);
  if (!upcoming.length) { grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:60px;grid-column:1/-1">No upcoming events. Check back soon!</div>'; return; }
  grid.innerHTML = upcoming.map(ev => eventCardHTML(ev)).join('');
  renderPastEvents();
}

function renderPastEvents() {
  const grid = document.getElementById('past-events-grid');
  const publicEvents = state.events.filter(e => e.visibility !== 'private');
  const past = publicEvents.filter(e => isEventCompleted(e));
  if (!past.length) { grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px;grid-column:1/-1">Completed events will appear here.</div>'; return; }
  grid.innerHTML = past.map(ev => {
    const count = getEventRegCount(ev.id);
    return `<div class="past-card">
        <div class="past-poster-ph">🖼️</div>
        <span class="completed-badge">✓ Completed</span>
        <div class="past-info">
            <h4>${ev.name}</h4>
            <div style="color:var(--muted);font-size:0.8rem;margin-bottom:10px">${formatDate(ev.date)} · ${ev.venue}</div>
            <div class="past-stats">
                <div class="past-stat"><div class="v">${count}</div><div class="k">Registered</div></div>
                <div class="past-stat"><div class="v">${ev.category}</div><div class="k">Type</div></div>
            </div>
            <div class="progress-bar" style="margin-top:10px"><div class="progress-fill" style="width:${Math.min(100, count / ev.capacity * 100)}%"></div></div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${Math.round(count / ev.capacity * 100) || 0}% capacity filled</div>
        </div>
    </div>`;
  }).join('');
}

function renderAllEvents() {
  const grid = document.getElementById('all-events-grid');
  if (!grid) {
    console.error('renderAllEvents: all-events-grid element not found');
    return;
  }
  console.log('renderAllEvents - total events in state:', state.events.length, state.events);
  const publicEvents = state.events.filter(e => e.visibility !== 'private');
  if (!publicEvents.length) { grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:60px;grid-column:1/-1">No events available yet.</div>'; return; }
  grid.innerHTML = publicEvents.map(ev => eventCardHTML(ev)).join('');
}

function eventCardHTML(ev) {
  const count = getEventRegCount(ev.id);
  return `<div class="event-card" onclick="showEventDetail('${ev.id}')">
        <div class="event-card-poster-wrap">
            ${ev.poster ? `<img src="${ev.poster}" class="poster" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="display:block"/><div class="poster-placeholder" style="display:none">🖼️</div>`
      : `<div class="poster-placeholder">🖼️</div>`}
        </div>
        <div class="card-body">
            <span class="card-tag ${ev.paid ? 'paid' : ''}">${ev.category}</span>
            <h3>${ev.name}</h3>
            <div class="card-meta">
                <div class="meta-row">📅 ${formatDate(ev.date)}</div>
                <div class="meta-row">⏰ ${formatTime(ev.time)}</div>
                <div class="meta-row">📍 ${ev.venue}</div>
            </div>
            <div class="card-footer">
                <span class="${ev.paid ? 'badge-paid' : 'badge-free'}">${ev.paid ? '₹' + ev.fee : 'FREE'}</span>
                <span class="reg-count">👥 ${count} registered</span>
            </div>
            ${!isEventCompleted(ev) ? `<button class="btn-primary" style="width:100%; margin-top:16px; padding: 10px; border-radius: 8px; font-size: 0.95rem" onclick="event.stopPropagation(); showEventDetail('${ev.id}'); openRegistrationModal();">Register Now →</button>` : `<button class="btn-outline" style="width:100%; margin-top:16px; padding: 10px; border-radius: 8px; font-size: 0.95rem; cursor: not-allowed; opacity: 0.6">Event Completed</button>`}
        </div>
    </div>`;
}

function getEventRegCount(evId) {
  return state.registrations.filter(r => r.eventId === evId).length;
}

function getEventDateTime(event) {
  if (!event || !event.date) return null;
  const dateTimeString = event.time ? `${event.date}T${event.time}` : `${event.date}T23:59:59`;
  const parsed = new Date(dateTimeString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeEventStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isEventCompleted(event) {
  return normalizeEventStatus(event.status) === 'completed';
}

function autoCompletePastEvents() {
  let changed = false;
  const now = Date.now();

  state.events.forEach(ev => {
    // Auto-complete only events still marked as upcoming after their date-time has passed.
    if (ev.status !== 'upcoming') return;
    const eventDateTime = getEventDateTime(ev);
    if (!eventDateTime) return;
    if (eventDateTime.getTime() <= now) {
      ev.status = 'completed';
      changed = true;
      if (typeof db !== 'undefined') {
        db.collection("events").doc(ev.id).update({ status: 'completed' })
          .catch(err => console.error("Error auto-updating event status in Firebase:", err));
      }
    }
  });

  if (changed) saveData();
}

// ===== REGISTRATION =====
function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let captcha = '';
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  state.currentCaptcha = captcha;
  const display = document.getElementById('captcha-display');
  if (display) display.textContent = captcha;
}

function openRegistrationModal() {
  if (!state.currentEvent) return;
  console.log('openRegistrationModal currentEvent:', state.currentEvent && state.currentEvent.id);
  resetRegForm();
  document.getElementById('reg-event-name-display').textContent = state.currentEvent.name;
  generateCaptcha();
  
  const isPaid = state.currentEvent.paid;
  const step2Wrap = document.getElementById('step2-wrap');
  const stepLine1 = document.getElementById('step-line-1');
  const stepLine2 = document.getElementById('step-line-2');
  const step3Wrap = document.getElementById('step3-wrap');
  const closedMessage = document.getElementById('reg-closed-message');

  if (state.currentEvent.status === 'completed') {
    if (closedMessage) {
      closedMessage.textContent = 'Registration is closed because this event has already been completed.';
      closedMessage.style.display = '';
    }
    document.querySelectorAll('#reg-step-1 .form-group, #continue-btn').forEach(el => el.style.display = 'none');
    if (step2Wrap) step2Wrap.style.display = 'none';
    if (stepLine1) stepLine1.style.display = 'none';
    if (stepLine2) stepLine2.style.display = 'none';
    if (step3Wrap) step3Wrap.style.display = 'none';
    goToStep(1);
    openModal('reg-modal');
    return;
  }

  if (closedMessage) {
    closedMessage.style.display = 'none';
  }
  document.querySelectorAll('#reg-step-1 .form-group, #continue-btn').forEach(el => el.style.display = '');

  if (isPaid) { 
    if (step2Wrap) step2Wrap.style.display = ''; 
    if (stepLine1) stepLine1.style.display = ''; 
    if (stepLine2) stepLine2.style.display = ''; 
    if (step3Wrap) step3Wrap.style.display = ''; 
  } else { 
    if (step2Wrap) step2Wrap.style.display = 'none'; 
    if (stepLine1) stepLine1.style.display = 'none'; 
    if (stepLine2) stepLine2.style.display = 'none'; 
    if (step3Wrap) step3Wrap.style.display = ''; 
  }
  goToStep(1);
  openModal('reg-modal');
}

function resetRegForm() {
  ['reg-name', 'reg-roll', 'reg-email', 'reg-phone', 'reg-captcha', 'pay-txn'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('reg-branch').value = '';
  document.getElementById('reg-alert').innerHTML = '';
  document.getElementById('pay-alert').innerHTML = '';
  state.currentCaptcha = null; state.selectedPayment = null;
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
}

function regStep1() {
  if (state.currentEvent && state.currentEvent.status === 'completed') {
    showAlert('reg-alert', 'Registration closed: this event has already been completed.', 'error');
    return;
  }
  const name = v('reg-name'), branch = v('reg-branch'), roll = v('reg-roll'), email = v('reg-email'), phone = v('reg-phone'), captcha = v('reg-captcha');
  if (!name || !branch || !roll || !email || !phone || !captcha) { showAlert('reg-alert', 'Please fill all required fields', 'error'); return; }
  if (!/^\d{10}$/.test(phone)) { showAlert('reg-alert', 'Please enter a valid 10-digit phone number', 'error'); return; }
  if (captcha !== state.currentCaptcha) { showAlert('reg-alert', 'Incorrect CAPTCHA. Please try again.', 'error'); generateCaptcha(); return; }

  // check duplicate
  const dup = state.registrations.find(r => r.eventId === state.currentEvent.id && r.roll === roll);
  if (dup) { showAlert('reg-alert', 'This Roll Number is already registered for this event', 'error'); return; }
  state.regFormData = { name, branch, roll, email, phone, year: document.getElementById('reg-year').value };
  
  const btn = document.getElementById('continue-btn');
  if (btn) btn.textContent = 'Processing...';

  // User is verified
  if (state.currentEvent.paid) {
    document.getElementById('pay-amount').textContent = '₹' + state.currentEvent.fee;
    document.getElementById('pay-upi-id').textContent = state.currentEvent.upiId || 'college@paytm';
    if (btn) btn.textContent = 'Continue';
    goToStep(2);
  } else {
    completeRegistration(null);
    if (btn) btn.textContent = 'Continue';
  }
}

function selectPayment(method) {
  state.selectedPayment = method;
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
  const map = { PhonePe: 'pay-phone', GPay: 'pay-gpay', Paytm: 'pay-paytm' };
  document.getElementById(map[method]).classList.add('selected');

  if (state.currentEvent && state.currentEvent.fee > 0) {
    const upiId = state.currentEvent.upiId || 'college@paytm';
    const amount = state.currentEvent.fee;
    const note = encodeURIComponent(`Registration for ${state.currentEvent.name}`);
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(state.currentEvent.name)}&tn=${note}&am=${amount}&cu=INR`;
    window.location.href = upiLink; // Opens the app directly on mobile devices
  }
}

function confirmPayment() {
  if (!state.selectedPayment) { showAlert('pay-alert', 'Please select a payment method', 'error'); return; }
  const txn = v('pay-txn');
  if (!txn) { showAlert('pay-alert', 'Please enter the Transaction ID', 'error'); return; }
  completeRegistration({ method: state.selectedPayment, txnId: txn, amount: state.currentEvent.fee });
}

function completeRegistration(payment) {
  const ticketId = 'EVT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  const reg = {
    id: ticketId,
    eventId: state.currentEvent.id,
    eventName: state.currentEvent.name,
    ...state.regFormData,
    payment: payment,
    registeredAt: new Date().toISOString(),
    ticketId
  };
  state.registrations.push(reg);
  saveDataAndSync();

  // render ticket
  renderTicket(reg, state.currentEvent);
  sendRegistrationEmail(reg, state.currentEvent);
  goToStep(3);
  // update step dots
  [1, 2, 3].forEach(i => {
    const dot = document.getElementById('step' + i + '-dot');
    if (dot) dot.className = 'step-dot done';
  });
}

function renderTicket(reg, ev) {
  const verificationUrl = getTicketVerificationUrl(reg.ticketId);
  const container = document.getElementById('ticket-output');
  container.innerHTML = `
    <div class="ticket-container" id="ticket-card">
        <div class="ticket-header">
            <div style="font-size:0.75rem;letter-spacing:3px;text-transform:uppercase;opacity:0.8;margin-bottom:4px">EventVault • Official Ticket</div>
            <h2>${ev.name}</h2>
            <p>${ev.category} · ${formatDate(ev.date)}</p>
        </div>
        <div class="ticket-body">
            <div class="ticket-qr"><div id="qrcode"></div></div>
            <div style="text-align:center;margin-top:8px">
                <span class="valid-badge">✓ Valid Ticket</span>
                <div class="ticket-id">${reg.ticketId}</div>
            </div>
            <div class="ticket-divider"><div class="notch"></div></div>
            <div class="ticket-info">
                <div class="ticket-field"><div class="tf-label">Full Name</div><div class="tf-val">${reg.name}</div></div>
                <div class="ticket-field"><div class="tf-label">Roll No</div><div class="tf-val">${reg.roll}</div></div>
                <div class="ticket-field"><div class="tf-label">Branch</div><div class="tf-val">${reg.branch} · ${reg.year}</div></div>
                <div class="ticket-field"><div class="tf-label">Date & Time</div><div class="tf-val">${formatDate(ev.date)} ${formatTime(ev.time)}</div></div>
                <div class="ticket-field"><div class="tf-label">Venue</div><div class="tf-val">${ev.venue}</div></div>
                <div class="ticket-field"><div class="tf-label">Entry</div><div class="tf-val">${ev.paid ? 'Paid ₹' + ev.fee : 'Free'}</div></div>
            </div>
        </div>
    </div>
    `;
  // generate QR
  setTimeout(() => {
    try {
      new QRCode(document.getElementById("qrcode"), {
        text: verificationUrl,
        width: 120, height: 120, colorDark: "#000", colorLight: "#fff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      document.getElementById('qrcode').innerHTML = '<div style="width:120px;height:120px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#000;text-align:center;padding:4px">' + reg.ticketId + '</div>';
    }
  }, 100);
}

function getTicketVerificationUrl(ticketId) {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}?ticket=${encodeURIComponent(ticketId)}`;
}

async function sendRegistrationEmail(reg, ev) {
  if (!reg || !reg.email || !ev) return;

  const verificationUrl = getTicketVerificationUrl(reg.ticketId);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(verificationUrl)}`;
  const payload = {
    toEmail: reg.email,
    subject: `Registration Successful - ${ev.name}`,
    registration: {
      ticketId: reg.ticketId,
      name: reg.name,
      roll: reg.roll,
      branch: reg.branch,
      year: reg.year,
      phone: reg.phone,
      email: reg.email
    },
    event: {
      id: ev.id,
      name: ev.name,
      category: ev.category,
      date: ev.date,
      time: ev.time,
      venue: ev.venue,
      paid: ev.paid,
      fee: ev.fee || 0
    },
    verificationUrl,
    qrImageUrl
  };

  try {
    // Requires backend endpoint that actually sends email (Nodemailer/SMTP/SendGrid/etc).
    const res = await fetch('/api/send-registration-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Email API request failed');
  } catch (err) {
    console.warn('Registration email not sent (email service unavailable):', err);
  }
}

function validateTicketById(ticketId) {
  const localReg = state.registrations.find(r => r.ticketId === ticketId);
  if (localReg) return Promise.resolve(localReg);
  if (typeof db !== 'undefined') {
    return db.collection("registrations").doc(ticketId).get()
      .then(doc => (doc.exists ? doc.data() : null))
      .catch(() => null);
  }
  return Promise.resolve(null);
}

function showTicketVerification(reg) {
  const successEl = document.getElementById('verify-success');
  const failedEl = document.getElementById('verify-failed');
  const alertEl = document.getElementById('verify-alert');

  if (alertEl) alertEl.innerHTML = '';

  if (!reg) {
    if (successEl) successEl.style.display = 'none';
    if (failedEl) failedEl.style.display = 'block';
    openModal('verify-modal');
    return;
  }

  const ev = state.events.find(e => e.id === reg.eventId);
  document.getElementById('verify-ticket-id').textContent = reg.ticketId || '-';
  document.getElementById('verify-name').textContent = reg.name || '-';
  document.getElementById('verify-roll').textContent = reg.roll || '-';
  document.getElementById('verify-branch').textContent = reg.branch || '-';
  document.getElementById('verify-phone').textContent = reg.phone || '-';
  document.getElementById('verify-email').textContent = reg.email || '-';
  document.getElementById('verify-event').textContent = reg.eventName || ev?.name || '-';
  document.getElementById('verify-date-time').textContent = ev ? `${formatDate(ev.date)} ${formatTime(ev.time)}` : '-';
  document.getElementById('verify-venue').textContent = ev?.venue || '-';

  if (failedEl) failedEl.style.display = 'none';
  if (successEl) successEl.style.display = 'block';
  openModal('verify-modal');
}

function handleTicketVerificationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('ticket');
  if (!ticketId) return;
  validateTicketById(ticketId).then(reg => showTicketVerification(reg));
}

function downloadTicket() {
  const ticket = document.getElementById('ticket-card');
  if (!ticket) return;
  // Simple print fallback
  const printWin = window.open('', '_blank');
  printWin.document.write('<html><head><title>Ticket</title><style>body{background:#1a1040;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#fff}</style></head><body>');
  printWin.document.write(ticket.outerHTML);
  printWin.document.write('</body></html>');
  printWin.document.close();
  printWin.print();
}

function goToStep(step) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('reg-step-' + i);
    if(el) el.style.display = 'none';
  });
  const currentStep = document.getElementById('reg-step-' + step);
  if(currentStep) currentStep.style.display = 'block';
  
  // update dots
  [1, 2, 3].forEach(i => {
    const dot = document.getElementById('step' + i + '-dot');
    if (!dot) return;
    if (i < step) dot.className = 'step-dot done';
    else if (i === step) dot.className = 'step-dot active';
    else dot.className = 'step-dot';
  });
  if (step > 1) {
    const line = document.getElementById('step-line-1');
    if (line) line.className = 'step-line done';
  }
  if (step > 2) {
    const line = document.getElementById('step-line-2');
    if (line) line.className = 'step-line done';
  }
}

// ===== ADMIN =====
function adminLogin() {
  const user = v('login-user'), pass = v('login-pass');
  if (!user || !pass) { showAlert('login-alert', 'Please enter username and password', 'error'); return; }

  const acc = state.adminAccounts.find(a => a.username === user);
  if (!acc) { showAlert('login-alert', 'Account not found. Please create an account first.', 'error'); return; }
  if (acc.password !== pass) { showAlert('login-alert', 'Invalid password', 'error'); return; }

  state.adminLoggedIn = true; state.currentAdmin = user;
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  renderAdminDashboard();
}

function adminGoogleLogin() {
  const emailInput = document.getElementById('google-email');
  const passInput = document.getElementById('google-password');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';

  const err1 = document.getElementById('google-email-err');
  const err2 = document.getElementById('google-pass-err');
  if (err1) err1.style.display = 'none';
  if (err2) err2.style.display = 'none';
  resetGoogleForgotUI();

  googleBackStep(); // reset to step 1
  openModal('google-modal');
}

function googleNextStep() {
  const email = v('google-email');
  if (!email) {
    document.getElementById('google-email-err').style.display = 'block';
    return;
  }
  document.getElementById('google-email-err').style.display = 'none';
  document.getElementById('google-email-display').textContent = email;
  document.getElementById('google-step-1').style.display = 'none';
  document.getElementById('google-step-2').style.display = 'block';
}

function googleBackStep() {
  const s1 = document.getElementById('google-step-1');
  const s2 = document.getElementById('google-step-2');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  resetGoogleForgotUI();
}

function googleSubmitLogin() {
  const email = v('google-email');
  const pass = v('google-password');
  const passErr = document.getElementById('google-pass-err');
  if (passErr) passErr.style.color = '#d93025';
  if (!pass) {
    if (passErr) {
      passErr.textContent = 'Enter a password';
      passErr.style.display = 'block';
    }
    return;
  }
  const account = state.adminAccounts.find(a => a.username === email);
  if (!account) {
    const err = document.getElementById('google-pass-err');
    if (err) {
      err.textContent = 'Account not found for this email';
      err.style.display = 'block';
    }
    const forgotLink = document.getElementById('google-forgot-link');
    if (forgotLink) forgotLink.style.display = 'none';
    return;
  }
  if (account.password !== pass) {
    const err = document.getElementById('google-pass-err');
    if (err) {
      err.textContent = 'Wrong password. Use Forgot password to reset.';
      err.style.display = 'block';
    }
    const forgotLink = document.getElementById('google-forgot-link');
    if (forgotLink) forgotLink.style.display = 'inline';
    return;
  }

  // Log the admin in
  state.adminLoggedIn = true;
  state.currentAdmin = email;
  closeModal('google-modal');
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  renderAdminDashboard();
}

function resetGoogleForgotUI() {
  const forgotWrap = document.getElementById('google-forgot-wrap');
  const forgotLink = document.getElementById('google-forgot-link');
  const passErr = document.getElementById('google-pass-err');
  const newPassErr = document.getElementById('google-new-pass-err');
  const p1 = document.getElementById('google-new-pass');
  const p2 = document.getElementById('google-new-pass2');
  if (forgotWrap) forgotWrap.style.display = 'none';
  if (forgotLink) forgotLink.style.display = 'none';
  if (passErr) passErr.textContent = 'Enter a password';
  if (passErr) passErr.style.color = '#d93025';
  if (newPassErr) newPassErr.style.display = 'none';
  if (p1) p1.value = '';
  if (p2) p2.value = '';
  updateGoogleForgotButtonState();
}

function showGoogleForgotPassword() {
  const forgotWrap = document.getElementById('google-forgot-wrap');
  if (forgotWrap) forgotWrap.style.display = 'block';
  updateGoogleForgotButtonState();
}

function updateGoogleForgotButtonState() {
  const pass = v('google-new-pass');
  const pass2 = v('google-new-pass2');
  const btn = document.getElementById('google-reset-btn');
  const passErr = document.getElementById('google-new-pass-err');
  if (!btn) return;
  const hasPasswords = !!pass && !!pass2;
  const matches = hasPasswords && pass === pass2;
  const strong = isStrongAdminPassword(pass);
  if (passErr) passErr.style.display = hasPasswords && !matches ? 'block' : 'none';
  btn.disabled = !(matches && strong);
}

function googleResetPassword() {
  const email = v('google-email');
  const pass = v('google-new-pass');
  const pass2 = v('google-new-pass2');
  const account = state.adminAccounts.find(a => a.username === email);
  if (!account) {
    const err = document.getElementById('google-pass-err');
    if (err) {
      err.textContent = 'Account not found for this email';
      err.style.display = 'block';
    }
    return;
  }
  if (!pass || !pass2) return;
  if (pass !== pass2) return;
  if (!isStrongAdminPassword(pass)) {
    const err = document.getElementById('google-pass-err');
    if (err) {
      err.textContent = 'New password must be at least 8 characters with 1 number.';
      err.style.display = 'block';
    }
    return;
  }
  if (isAdminPasswordTaken(pass) && account.password !== pass) {
    const err = document.getElementById('google-pass-err');
    if (err) {
      err.textContent = 'Password already used. Choose a unique password.';
      err.style.display = 'block';
    }
    return;
  }
  account.password = pass;
  saveData();
  const err = document.getElementById('google-pass-err');
  if (err) {
    err.textContent = 'Password reset successful. Please sign in now.';
    err.style.color = '#188038';
    err.style.display = 'block';
  }
  const passInput = document.getElementById('google-password');
  if (passInput) passInput.value = '';
  resetGoogleForgotUI();
}

function adminSignup() {
  const user = v('signup-user'), pass = v('signup-pass'), pass2 = v('signup-pass2');
  if (!user || !pass) { showAlert('login-alert', 'Fill all fields', 'error'); return; }
  if (pass !== pass2) { showAlert('login-alert', 'Passwords do not match', 'error'); return; }
  if (!isStrongAdminPassword(pass)) {
    showAlert('login-alert', 'Password must be at least 8 characters and include at least 1 number.', 'error');
    return;
  }
  if (state.adminAccounts.find(a => a.username === user)) { showAlert('login-alert', 'Username already exists', 'error'); return; }
  if (isAdminPasswordTaken(pass)) { showAlert('login-alert', 'Password already used. Please choose a unique password.', 'error'); return; }
  state.adminAccounts.push({ username: user, password: pass });
  saveData();
  showLoginForm();
  showAlert('login-alert', 'Account created! Please sign in.', 'success');
}

function adminResetPassword() {
  const user = v('forgot-user');
  const pass = v('forgot-pass');
  const pass2 = v('forgot-pass2');
  if (!user || !pass || !pass2) { showAlert('login-alert', 'Fill all fields', 'error'); return; }
  if (pass !== pass2) { showAlert('login-alert', 'Passwords do not match', 'error'); return; }
  if (!isStrongAdminPassword(pass)) {
    showAlert('login-alert', 'Password must be at least 8 characters and include at least 1 number.', 'error');
    return;
  }
  const account = state.adminAccounts.find(a => a.username === user);
  if (!account) { showAlert('login-alert', 'Account not found for this username', 'error'); return; }
  if (isAdminPasswordTaken(pass) && account.password !== pass) {
    showAlert('login-alert', 'Password already used. Please choose a unique password.', 'error');
    return;
  }

  account.password = pass;
  saveData();
  showLoginForm();
  showAlert('login-alert', 'Password updated successfully. Please sign in.', 'success');
}

function isAdminPasswordTaken(password) {
  return state.adminAccounts.some(a => a.password === password);
}

function isStrongAdminPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /\d/.test(password);
}

function updateSignupButtonState() {
  const pass = v('signup-pass');
  const pass2 = v('signup-pass2');
  const email = v('signup-user');
  const btn = document.getElementById('signup-create-btn');
  const passErr = document.getElementById('signup-pass-err');
  if (!btn) return;

  const hasEmail = !!email;
  const hasPasswords = !!pass && !!pass2;
  const matches = hasPasswords && pass === pass2;
  const isStrong = isStrongAdminPassword(pass);

  if (passErr) passErr.style.display = hasPasswords && !matches ? 'block' : 'none';
  btn.disabled = !(hasEmail && matches && isStrong);
}

function updateForgotButtonState() {
  const user = v('forgot-user');
  const pass = v('forgot-pass');
  const pass2 = v('forgot-pass2');
  const btn = document.getElementById('forgot-reset-btn');
  const passErr = document.getElementById('forgot-pass-err');
  if (!btn) return;

  const hasEmail = !!user;
  const hasPasswords = !!pass && !!pass2;
  const matches = hasPasswords && pass === pass2;
  const isStrong = isStrongAdminPassword(pass);

  if (passErr) passErr.style.display = hasPasswords && !matches ? 'block' : 'none';
  btn.disabled = !(hasEmail && matches && isStrong);
}

function adminLogout() {
  state.adminLoggedIn = false;
  state.currentAdmin = null;
  showPage('events');
}

function showLoginForm() {
  document.getElementById('login-form-wrap').style.display = 'block';
  document.getElementById('signup-form-wrap').style.display = 'none';
  const forgotWrap = document.getElementById('forgot-form-wrap');
  if (forgotWrap) forgotWrap.style.display = 'none';
}
function showSignupForm() {
  document.getElementById('signup-form-wrap').style.display = 'block';
  document.getElementById('login-form-wrap').style.display = 'none';
  const forgotWrap = document.getElementById('forgot-form-wrap');
  if (forgotWrap) forgotWrap.style.display = 'none';
  updateSignupButtonState();
}
function showForgotPasswordForm() {
  document.getElementById('login-form-wrap').style.display = 'none';
  document.getElementById('signup-form-wrap').style.display = 'none';
  const forgotWrap = document.getElementById('forgot-form-wrap');
  if (forgotWrap) forgotWrap.style.display = 'block';
  updateForgotButtonState();
}

function adminNav(tab) {
  state.currentAdminTab = tab;
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  event.target.closest('.sidebar-item').classList.add('active');
  document.getElementById('admin-' + tab + '-section').classList.add('active');
  if (tab === 'dashboard') renderAdminDashboard();
  if (tab === 'manage-events') renderManageEvents();
  if (tab === 'registrations') renderAdminRegistrations();
}

function updateAdminProfileUI() {
  if (!state.currentAdmin) return;
  const usernameDisplay = document.getElementById('admin-username-display');
  const dpDisplay = document.getElementById('admin-dp');

  if (usernameDisplay) usernameDisplay.textContent = state.currentAdmin;

  if (dpDisplay) {
    const name = encodeURIComponent(state.currentAdmin.substring(0, 2).toUpperCase());
    dpDisplay.src = `https://ui-avatars.com/api/?name=${name}&background=1a73e8&color=fff&rounded=true&bold=true`;
  }
}

function renderAdminDashboard() {
  updateAdminProfileUI();
  const myEvents = state.events.filter(e => e.createdBy === state.currentAdmin || !e.createdBy);
  const myEventIds = myEvents.map(e => e.id);
  const myRegs = state.registrations.filter(r => myEventIds.includes(r.eventId));

  const totalRegs = myRegs.length;
  const paidEvs = myEvents.filter(e => e.paid).length;
  const completed = myEvents.filter(e => e.status === 'completed').length;
  document.getElementById('admin-dash-cards').innerHTML = `
    <div class="dash-card"><div class="dc-icon">🎟</div><div class="dc-val">${myEvents.length}</div><div class="dc-lbl">Total Events</div></div>
    <div class="dash-card"><div class="dc-icon">👥</div><div class="dc-val">${totalRegs}</div><div class="dc-lbl">Total Registrations</div></div>
    <div class="dash-card"><div class="dc-icon">💳</div><div class="dc-val">${paidEvs}</div><div class="dc-lbl">Paid Events</div></div>
    <div class="dash-card"><div class="dc-icon">✅</div><div class="dc-val">${completed}</div><div class="dc-lbl">Completed Events</div></div>
    `;
  const tbody = document.getElementById('recent-regs-body');
  const recent = [...myRegs].reverse().slice(0, 10);
  if (!recent.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No registrations yet</td></tr>'; return; }
  tbody.innerHTML = recent.map(r => `
    <tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.eventName}</td>
        <td class="mono" style="font-size:0.85rem">${r.roll}</td>
        <td>${r.branch}</td>
        <td>${r.phone}</td>
        <td><span class="chip green">✓ Registered</span></td>
    </tr>
    `).join('');
}

function renderManageEvents() {
  const tbody = document.getElementById('manage-events-body');
  const myEvents = state.events.filter(e => e.createdBy === state.currentAdmin || !e.createdBy);
  if (!myEvents.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No events yet</td></tr>'; return; }
  tbody.innerHTML = myEvents.map(ev => `
    <tr>
        <td><strong>${ev.name}</strong><br><span style="color:var(--muted);font-size:0.8rem">${ev.category} · ${ev.paid ? '₹' + ev.fee : 'Free'}</span></td>
        <td>${formatDate(ev.date)}</td>
        <td>${ev.venue}</td>
        <td><span class="chip ${getEventRegCount(ev.id) > 0 ? 'green' : ''}">${getEventRegCount(ev.id)} / ${ev.capacity}</span></td>
        <td><span class="chip ${ev.status === 'upcoming' ? 'blue' : ev.status === 'live' ? 'orange' : 'green'}">${ev.status}</span></td>
        <td>
            ${ev.status !== 'completed'
      ? `<button onclick="markCompleted('${ev.id}')" style="background:none;border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-right:4px">Mark Done</button>
               <button style="background:none;border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:6px;cursor:not-allowed;font-size:0.8rem;opacity:0.6" disabled>Delete</button>`
      : `<button onclick="deleteEvent('${ev.id}')" style="background:none;border:1px solid var(--danger);color:var(--danger);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem">Delete</button>`}
        </td>
    </tr>
    `).join('');
}

function renderAdminRegistrations() {
  const container = document.getElementById('reg-event-list');
  const myEvents = state.events.filter(e => e.createdBy === state.currentAdmin || !e.createdBy);
  if (!myEvents.length) { container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px">No events yet</div>'; return; }
  container.innerHTML = myEvents.map(ev => {
    const regs = state.registrations.filter(r => r.eventId === ev.id);
    return `
    <div class="reg-event-header">
        <div class="rev-info"><h3>${ev.name}</h3><p>${formatDate(ev.date)} · ${ev.venue}</p></div>
        <div class="rev-stat"><div class="count">${regs.length}</div><div class="count-label">Registered / ${ev.capacity}</div>
            <div class="progress-bar" style="width:120px; margin-bottom:8px;"><div class="progress-fill" style="width:${Math.min(100, regs.length / ev.capacity * 100)}%"></div></div>
            <button onclick="downloadEventPDF('${ev.id}')" style="padding:6px 12px; font-size:0.8rem; border-radius:6px" class="btn-primary">Download PDF 📥</button>
        </div>
    </div>
    ${regs.length ? `<div class="table-wrap" style="margin-bottom:24px"><table class="data-table">
        <thead><tr><th>Name</th><th>Roll No</th><th>Branch</th><th>Email</th><th>Phone</th><th>Ticket ID</th>${ev.paid ? '<th>Payment</th>' : ''}</tr></thead>
        <tbody>${regs.map(r => `<tr>
          <td>${r.name}</td><td class="mono" style="font-size:0.8rem">${r.roll}</td><td>${r.branch}</td>
          <td>${r.email}</td><td>${r.phone}</td><td class="mono" style="font-size:0.75rem">${r.ticketId}</td>
          ${ev.paid ? `<td><span class="chip orange">${r.payment?.method || 'N/A'}</span></td>` : ''}
        </tr>`).join('')}</tbody>
      </table></div>`:
        `<div style="color:var(--muted);text-align:center;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:24px">No registrations for this event yet</div>`}
    `;
  }).join('');
}

function addEvent() {
  const name = v('ev-name'), date = v('ev-date'), time = v('ev-time'), venue = v('ev-venue');
  if (!name || !date || !time || !venue) { showAlert('add-event-alert', 'Please fill required fields: Name, Date, Time, Venue', 'error'); return; }

  const isPaidCheckbox = document.getElementById('ev-paid');
  const isPaid = isPaidCheckbox ? isPaidCheckbox.checked : false;

  const finalizeAdd = (posterUrl) => {
    const ev = {
      id: 'ev-' + Date.now(),
      name, date, time, venue,
      category: v('ev-category') || 'Technical',
      capacity: parseInt(v('ev-capacity')) || 200,
      description: v('ev-desc'),
      poster: posterUrl,
      paid: isPaid,
      fee: isPaid ? (parseInt(v('ev-fee')) || 0) : 0,
      upiId: isPaid ? v('ev-upi') : '',
      visibility: v('ev-visibility') || 'public',
      status: v('ev-status') || 'upcoming',
      createdAt: new Date().toISOString(),
      createdBy: state.currentAdmin
    };
    state.events.unshift(ev);
    saveData();
    renderManageEvents();
    renderHomeStats();
    renderHomeEvents();
    renderAllEvents();
    showAlert('add-event-alert', 'Event published successfully! 🎉', 'success');
    alert('Event is registered successfully!');

    // Persist to Firebase and refresh from Firestore when write completes.
    if (typeof db !== 'undefined') {
      saveEventToFirebase(ev).then(() => {
        db.collection('events').doc(ev.id).get().then(doc => {
          if (doc.exists) {
            const fetched = doc.data();
            const idx = state.events.findIndex(x => x.id === fetched.id);
            if (idx === -1) state.events.unshift(fetched);
            else state.events[idx] = fetched;
          }
          renderHomeStats(); renderHomeEvents(); renderAllEvents();
        }).catch(err => {
          console.warn('Could not refresh saved event from Firestore:', err);
          renderHomeStats(); renderHomeEvents(); renderAllEvents();
        });
      }).catch(err => {
        console.warn('Could not save event to Firebase:', err);
        renderHomeStats(); renderHomeEvents(); renderAllEvents();
      });
    }

    // reset
    ['ev-name', 'ev-poster', 'ev-desc', 'ev-venue', 'ev-date', 'ev-time', 'ev-fee', 'ev-upi'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('ev-visibility')) document.getElementById('ev-visibility').value = 'private';
    if (document.getElementById('ev-status')) document.getElementById('ev-status').value = 'upcoming';
    if (document.getElementById('ev-paid')) document.getElementById('ev-paid').checked = false;
    if (document.getElementById('paid-fields')) document.getElementById('paid-fields').style.display = 'none';
    renderHomeStats(); renderHomeEvents(); renderAllEvents();
  };

  const fileInput = document.getElementById('ev-poster');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => finalizeAdd(e.target.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    finalizeAdd('');
  }
}

function togglePaidFields() {
  document.getElementById('paid-fields').style.display = document.getElementById('ev-paid').checked ? 'block' : 'none';
}

function markCompleted(evId) {
  const ev = state.events.find(e => e.id === evId);
  if (ev) { 
    ev.status = 'completed'; 
    saveData(); 
    if (typeof db !== 'undefined') {
      db.collection("events").doc(ev.id).update({ status: 'completed' })
        .catch(err => console.error("Error updating event in Firebase:", err));
    }
  }
  renderManageEvents(); renderHomeEvents(); renderHomeStats();
}

function deleteEvent(evId) {
  if (!confirm('Delete this event? All registrations will also be removed.')) return;
  state.events = state.events.filter(e => e.id !== evId);
  state.registrations = state.registrations.filter(r => r.eventId !== evId);
  saveData();
  if (typeof db !== 'undefined') {
    db.collection("events").doc(evId).delete()
      .catch(err => console.error("Error deleting event in Firebase:", err));
    db.collection("registrations").where("eventId", "==", evId).get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          db.collection("registrations").doc(doc.id).delete()
            .catch(err => console.error("Error deleting registration in Firebase:", err));
        });
      })
      .catch(err => console.error("Error fetching registrations for delete:", err));
  }
  renderManageEvents(); renderHomeStats(); renderHomeEvents();
}

// ===== UTILS =====
function saveEventToFirebase(ev) {
  if (typeof db === 'undefined') {
    console.error('Firebase DB is undefined; cannot save event', ev && ev.id);
    return;
  }
  if (!ev || !ev.id) {
    console.error('Invalid event object; cannot save to Firebase', ev);
    return;
  }
  console.log('Saving event to Firebase', ev.id);
  return db.collection('events').doc(ev.id).set(ev)
    .then(() => console.log('Event saved to Firebase', ev.id))
    .catch(err => console.error('Error saving event to Firebase:', err));
}

function saveRegistrationToFirebase(reg) {
  if (typeof db === 'undefined') {
    console.error('Firebase DB is undefined; cannot save registration', reg && reg.ticketId);
    return Promise.reject(new Error('db undefined'));
  }
  if (!reg || !reg.ticketId) {
    console.error('Invalid registration object; cannot save to Firebase', reg);
    return Promise.reject(new Error('invalid registration object'));
  }
  console.log('Saving registration to Firebase', reg.ticketId, 'event', reg.eventId);

  const doSave = () => db.collection('registrations').doc(reg.ticketId).set(reg)
    .then(() => {
      console.log('Registration saved to Firebase', reg.ticketId);
      return true;
    })
    .catch(err => {
      console.error('Error saving registration to Firebase:', err);
      try { showAlert('reg-alert', 'Failed to save registration: ' + (err.message || err), 'error'); } catch (e) { /* ignore */ }
      throw err;
    });

  // If auth is ready, proceed; otherwise wait for auth state change once
  if (auth && auth.currentUser) {
    return doSave();
  }
  return new Promise((resolve, reject) => {
    let called = false;
    const un = auth.onAuthStateChanged(user => {
      un();
      if (user) {
        called = true;
        doSave().then(resolve).catch(reject);
      } else {
        reject(new Error('no auth user'));
      }
    });
    // fallback timeout
    setTimeout(() => {
      if (called) return;
      // try anyway
      doSave().then(resolve).catch(reject);
    }, 8000);
  });
}

function saveData() {
  // Save to local storage for persistence without a server
  localStorage.setItem('eventVaultData', JSON.stringify({
    events: state.events,
    registrations: state.registrations,
    adminAccounts: state.adminAccounts
  }));

  // Send updated data to the local node server
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: state.events, registrations: state.registrations })
  }).catch(err => console.error('Failed to save to server, saved locally instead', err));

  syncLocalToFirebase();
}

function syncLocalToFirebase() {
  if (typeof db === 'undefined') return;
  try {
    state.events.forEach(ev => saveEventToFirebase(ev));
    state.registrations.forEach(reg => saveRegistrationToFirebase(reg));
  } catch (e) {
    console.error('Firebase sync error:', e);
  }
}

function saveDataAndSync() {
  saveData();
  syncLocalToFirebase();
}
function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function downloadEventPDF(eventId) {
  const ev = state.events.find(e => e.id === eventId);
  const regs = state.registrations.filter(r => r.eventId === eventId);
  if (!ev) return;

  if (typeof window.jspdf === 'undefined') {
    alert('PDF library not loaded yet. Please wait a moment and try again.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Registrations: ${ev.name}`, 14, 22);
  doc.setFontSize(11);
  doc.text(`Date: ${formatDate(ev.date)} | Venue: ${ev.venue} | Total: ${regs.length}`, 14, 30);

  if (regs.length === 0) {
    doc.text("No registrations yet.", 14, 40);
  } else {
    const tableColumn = ["Name", "Roll No", "Branch", "Email", "Phone", "Ticket ID", "Payment"];
    const tableRows = [];

    regs.forEach(r => {
      const rowData = [
        r.name || '-',
        r.roll || '-',
        r.branch || '-',
        r.email || '-',
        r.phone || '-',
        r.ticketId || '-',
        ev.paid ? (r.payment?.method || 'N/A') : 'Free'
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12] }
    });
  }

  doc.save(`${ev.name.replace(/ /g, '_')}_Registrations.pdf`);
}
function showAlert(containerId, msg, type) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}
function togglePasswordVisibility(inputId, show) {
  const input = document.getElementById(inputId);
  if (input) input.type = show ? 'text' : 'password';
}
function toggleMultiplePasswordVisibility(ids, show) {
  ids.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.type = show ? 'text' : 'password';
  });
}
function formatDate(d) { if (!d) return 'TBD'; try { return new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
function formatTime(t) { if (!t) return 'TBD'; try { const [h, m] = t.split(':'); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${m} ${ampm}`; } catch (e) { return t; } }

// All components are now loaded directly in index.html
// No dynamic loading needed

// Setup event listeners on start
window.addEventListener('load', async () => {
  // Close modal on overlay click
  document.getElementById('reg-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('reg-modal'); });
  document.getElementById('google-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('google-modal'); });
  document.getElementById('verify-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('verify-modal'); });
  ['signup-user', 'signup-pass', 'signup-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateSignupButtonState);
  });
  ['forgot-user', 'forgot-pass', 'forgot-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateForgotButtonState);
  });
  ['google-new-pass', 'google-new-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateGoogleForgotButtonState);
  });

  const finishLoading = () => {
    autoCompletePastEvents();
    renderHomeStats();
    renderHomeEvents();
    if (document.getElementById('page-events').classList.contains('active')) renderAllEvents();
    if (state.adminLoggedIn) {
      if (state.currentAdminTab === 'dashboard') renderAdminDashboard();
      if (state.currentAdminTab === 'manage-events') renderManageEvents();
      if (state.currentAdminTab === 'registrations') renderAdminRegistrations();
    }
  };

  const loadFromLocal = () => {
    const localData = localStorage.getItem('eventVaultData');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        state.events = parsed.events || [];
        state.registrations = parsed.registrations || [];
        if (parsed.adminAccounts) state.adminAccounts = parsed.adminAccounts;
      } catch (e) { console.error('Failed to parse local storage', e); }
    } else if (typeof Database !== 'undefined') {
      state.events = Database.events || [];
      state.registrations = Database.registrations || [];
    }
    finishLoading();
  };

  if (typeof db !== 'undefined') {
    try {
      const eventsSnap = await db.collection("events").get();
      const regsSnap = await db.collection("registrations").get();
      const fetchedEvents = eventsSnap.docs.map(doc => doc.data());
      const fetchedRegs = regsSnap.docs.map(doc => doc.data());

      // Load local data if present (used as fallback or to seed Firestore)
      const localData = localStorage.getItem('eventVaultData');
      let parsed = null;
      if (localData) {
        try { parsed = JSON.parse(localData); } catch (e) { parsed = null; }
      }

      // Prefer Firestore data when available; otherwise fallback to local data.
      if (fetchedEvents && fetchedEvents.length) {
        state.events = fetchedEvents;
      } else if (parsed && parsed.events && parsed.events.length) {
        state.events = parsed.events;
        // Seed Firestore with local events so they persist remotely
        try { syncLocalToFirebase(); } catch (e) { console.error('Seed Firestore failed', e); }
      } else {
        state.events = [];
      }

      if (fetchedRegs && fetchedRegs.length) {
        state.registrations = fetchedRegs;
      } else if (parsed && parsed.registrations && parsed.registrations.length) {
        state.registrations = parsed.registrations;
        try { syncLocalToFirebase(); } catch (e) { console.error('Seed Firestore failed', e); }
      } else {
        state.registrations = [];
      }

      // Merge admin accounts from local if present
      if (parsed && parsed.adminAccounts) state.adminAccounts = parsed.adminAccounts;

      finishLoading();
    } catch (err) {
      console.error("Firebase load failed, falling back to local storage:", err);
      loadFromLocal();
    }
  } else {
    loadFromLocal();
  }

  // Fallback server sync if needed (optional, keeping it for compatibility)
  fetch('/api/data')
    .then(res => res.json())
    .then(data => {
      if (data && (data.events?.length > 0 || data.registrations?.length > 0)) {
        if (!state.events.length) state.events = data.events || [];
        if (!state.registrations.length) state.registrations = data.registrations || [];
        finishLoading();
      }
    })
    .catch(err => console.log('No local server running', err));

  handleTicketVerificationFromUrl();

  // Keep statuses fresh while the app stays open.
  setInterval(() => {
    autoCompletePastEvents();
    if (document.getElementById('page-home').classList.contains('active')) {
      renderHomeStats();
      renderHomeEvents();
    }
    if (document.getElementById('page-events').classList.contains('active')) {
      renderAllEvents();
    }
    if (document.getElementById('page-event-detail').classList.contains('active') && state.currentEvent) {
      showEventDetail(state.currentEvent.id);
    }
    if (state.adminLoggedIn) {
      if (state.currentAdminTab === 'dashboard') renderAdminDashboard();
      if (state.currentAdminTab === 'manage-events') renderManageEvents();
      if (state.currentAdminTab === 'registrations') renderAdminRegistrations();
    }
  }, 60000);

  // Ensure data is persisted and synced when the user leaves / refreshes the page
  window.addEventListener('beforeunload', () => {
    try { saveData(); syncLocalToFirebase(); } catch (e) { /* best-effort */ }
  });
});
