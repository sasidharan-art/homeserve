const SETTINGS_API=`${window.location.origin}/api/bookings/payment-settings`;
let paymentSettings={enabled:false,cashOnDeliveryEnabled:true,qrAmountMode:'booking',fixedQrAmount:1};
let paymentBooking=null;
const API=`${window.location.origin}/api/bookings`;
const REVIEW_API=`${window.location.origin}/api/reviews`;
let myReviews=new Map();
let reviewBooking=null;
let selectedRating=0;
const token=localStorage.getItem('token');
if(!token) window.location.href='login.html';
document.getElementById('logoutBtn')?.addEventListener('click',()=>{localStorage.clear();window.location.href='login.html';});
let allBookings=[];
const list=document.getElementById('bookingList');
const message=document.getElementById('bookingMessage');
const search=document.getElementById('bookingSearch');
const statusFilter=document.getElementById('bookingStatusFilter');
const safe=v=>String(v??'');
const money=v=>`₹${Number(v||0).toLocaleString('en-IN')}`;
const dateText=v=>v?new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v)):'Not specified';
const statusClass=v=>safe(v).toLowerCase().replace(/\s+/g,'-');
function updateSummary(){
  document.getElementById('summaryAll').textContent=allBookings.length;
  document.getElementById('summaryActive').textContent=allBookings.filter(b=>!['Completed','Cancelled'].includes(b.status)).length;
  document.getElementById('summaryCompleted').textContent=allBookings.filter(b=>b.status==='Completed').length;
  document.getElementById('summaryCancelled').textContent=allBookings.filter(b=>b.status==='Cancelled').length;
}
function bookingCard(b){
  const service=safe(b.service?.name||b.serviceName||'Home Service');
  const status=safe(b.status||'Pending');
  const provider=safe(b.provider?.name||'Awaiting assignment');
  const canCancel=!['Completed','Cancelled'].includes(status);
  const canTrack=['Accepted','On the Way'].includes(status) && b.providerLocation?.sharing && Number.isFinite(Number(b.providerLocation?.latitude));
  const article=document.createElement('article');
  article.className='premium-booking-card';
  article.innerHTML=`<div class="booking-card-top"><div class="booking-service-identity"><i>⌂</i><div><span>${safe(b.bookingCode||'HomeServe booking')}</span><h3>${service}</h3></div></div><b class="booking-status-pill ${statusClass(status)}">${status}</b></div><div class="booking-information-grid"><div><small>Date</small><strong>${dateText(b.bookingDate)}</strong></div><div><small>Time slot</small><strong>${safe(b.timeSlot||'Not specified')}</strong></div><div><small>Professional</small><strong>${provider}</strong></div><div><small>Total</small><strong>${money(b.pricing?.total)}</strong></div></div><div class="booking-address"><small>Service address</small><p>${safe(b.address||'Not specified')}</p></div><div class="booking-progress-line"><span class="active"></span><span class="${['Accepted','On the Way','Completed'].includes(status)?'active':''}"></span><span class="${['On the Way','Completed'].includes(status)?'active':''}"></span><span class="${status==='Completed'?'active':''}"></span></div><div class="booking-progress-labels"><span>Created</span><span>Accepted</span><span>On the way</span><span>Completed</span></div><div class="booking-card-actions"><a href="contact.html" class="btn btn-secondary">Get support</a>${canTrack?`<button class="btn btn-primary track-worker-btn" data-id="${b._id||b.id}">Track worker</button>`:''}${status==='Completed'?`<button class="btn btn-secondary review-booking-btn" data-id="${b._id||b.id}">${myReviews.has(String(b._id||b.id))?'Edit review':'Rate service'}</button>`:''}${status==='Completed' && b.payment?.status!=='Paid'?`<button class="btn btn-primary pay-booking-btn" data-id="${b._id||b.id}">Pay now</button>`:''}${canCancel?`<button class="cancel-booking-btn" data-id="${b._id||b.id}">Cancel booking</button>`:''}</div>`;
  article.querySelector('.cancel-booking-btn')?.addEventListener('click',()=>cancelBooking(b._id||b.id));
  article.querySelector('.track-worker-btn')?.addEventListener('click',()=>openWorkerTracking(b));
  article.querySelector('.pay-booking-btn')?.addEventListener('click',()=>openPayment(b));
  article.querySelector('.review-booking-btn')?.addEventListener('click',()=>openReview(b));
  return article;
}
function renderBookings(){
  const q=search.value.trim().toLowerCase();
  const selected=statusFilter.value;
  const filtered=allBookings.filter(b=>{
    const searchable=`${b.service?.name||''} ${b.bookingCode||''} ${b.address||''}`.toLowerCase();
    return (selected==='All'||b.status===selected)&&searchable.includes(q);
  });
  list.innerHTML='';
  if(!filtered.length){message.className='page-message empty-state';message.innerHTML='<strong>No matching bookings.</strong><span>Try another filter or book a new service.</span>';return;}
  message.textContent=`${filtered.length} booking${filtered.length===1?'':'s'} found`;
  message.className='page-message success-state';
  filtered.forEach(b=>list.appendChild(bookingCard(b)));
}
async function cancelBooking(id){
  if(!id||!confirm('Cancel this booking?')) return;
  try{const res=await fetch(`${API}/${id}`,{method:'DELETE',headers:{Authorization:token}});const data=await res.json();if(!res.ok)throw new Error(data.message||'Unable to cancel booking');await loadBookings();}
  catch(err){message.className='page-message error-state';message.textContent=err.message;}
}
async function loadBookings(){
  try{const rr=await fetch(`${REVIEW_API}/mine`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(rr.ok){const rows=await rr.json();myReviews=new Map(rows.map(r=>[String(r.booking),r]));}}catch(_){}
  try{const r=await fetch(SETTINGS_API,{headers:{Authorization:`Bearer ${token}`}}); if(r.ok) paymentSettings=await r.json();}catch(_){}
  list.innerHTML=Array.from({length:3},()=>'<div class="booking-list-skeleton"><i></i><b></b><span></span><span></span></div>').join('');
  try{const res=await fetch(API,{headers:{Authorization:token,Accept:'application/json'},cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.message||'Unable to load bookings');allBookings=Array.isArray(data)?data:(data.bookings||[]);updateSummary();renderBookings();}
  catch(err){console.error(err);list.innerHTML='';message.className='page-message error-state';message.textContent=err.message;}
}
search.addEventListener('input',renderBookings);statusFilter.addEventListener('change',renderBookings);loadBookings();

function openWorkerTracking(b){
  const loc=b.providerLocation; if(!loc?.sharing) return;
  const lat=Number(loc.latitude),lng=Number(loc.longitude);
  document.getElementById('workerTrackingTitle').textContent=`${b.provider?.name||'Worker'} is on the way`;
  document.getElementById('workerMapFrame').src=`https://www.openstreetmap.org/export/embed.html?bbox=${lng-.008}%2C${lat-.006}%2C${lng+.008}%2C${lat+.006}&layer=mapnik&marker=${lat}%2C${lng}`;
  document.getElementById('workerMapsLink').href=`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const updated=loc.updatedAt?new Date(loc.updatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'recently';
  document.getElementById('workerTrackingMeta').textContent=`Last updated ${updated}${loc.accuracy?` · Accuracy about ${Math.round(loc.accuracy)} m`:''}.`;
  document.getElementById('workerTrackingModal').hidden=false;
}
const trackingModal=document.getElementById('workerTrackingModal');
document.getElementById('closeWorkerTracking')?.addEventListener('click',()=>trackingModal.hidden=true);
trackingModal?.addEventListener('click',e=>{if(e.target===trackingModal)trackingModal.hidden=true;});
if(window.socket){window.socket.on('provider-location-updated',()=>loadBookings());window.socket.on('booking-status-updated',()=>loadBookings());window.socket.on('payment-status-updated',()=>loadBookings());}

const payModal=document.getElementById('paymentChoiceModal');
function openPayment(b){ paymentBooking=b; payModal.hidden=false; document.getElementById('customerPaymentTitle').textContent=b.service?.name||'Service payment'; const amount=paymentSettings.qrAmountMode==='fixed'?Number(paymentSettings.fixedQrAmount||1):Number(b.pricing?.total||b.service?.price||0); document.getElementById('customerPaymentAmount').textContent=`Amount: ₹${amount.toLocaleString('en-IN')}`; const method=document.getElementById('customerPaymentMethod'); method.value=b.payment?.method||'UPI QR'; updatePaymentFields(); const qr=document.getElementById('customerQrCode'); qr.innerHTML=''; if(paymentSettings.enabled&&paymentSettings.upiId&&window.QRCode){new QRCode(qr,{text:`upi://pay?pa=${encodeURIComponent(paymentSettings.upiId)}&pn=${encodeURIComponent(paymentSettings.payeeName||'HomeServe')}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent((paymentSettings.paymentNote||'Home service payment')+' '+(b.bookingCode||''))}`,width:180,height:180});}}
function updatePaymentFields(){const cash=document.getElementById('customerPaymentMethod').value==='Cash on Delivery';document.getElementById('utrWrap').hidden=cash;document.getElementById('submitPaymentClaim').hidden=cash;}
document.getElementById('customerPaymentMethod')?.addEventListener('change',updatePaymentFields);
document.getElementById('closeCustomerPayment')?.addEventListener('click',()=>payModal.hidden=true);
document.getElementById('savePaymentMethod')?.addEventListener('click',async()=>{try{const method=document.getElementById('customerPaymentMethod').value;const r=await fetch(`${API}/${paymentBooking._id}/payment-method`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({method})});const d=await r.json();if(!r.ok)throw new Error(d.message);document.getElementById('customerPaymentMessage').textContent=d.message;await loadBookings();}catch(e){document.getElementById('customerPaymentMessage').textContent=e.message;}});
document.getElementById('submitPaymentClaim')?.addEventListener('click',async()=>{try{const transactionRef=document.getElementById('customerUtr').value.trim();const r=await fetch(`${API}/${paymentBooking._id}/payment-claim`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({transactionRef})});const d=await r.json();if(!r.ok)throw new Error(d.message);document.getElementById('customerPaymentMessage').textContent=d.message;await loadBookings();}catch(e){document.getElementById('customerPaymentMessage').textContent=e.message;}});


const reviewModal=document.getElementById('reviewModal');
function openReview(b){
  reviewBooking=b; const existing=myReviews.get(String(b._id||b.id)); selectedRating=Number(existing?.rating||0);
  document.getElementById('reviewTitle').textContent=`Review ${b.service?.name||'service'}`;
  document.getElementById('reviewComment').value=existing?.comment||'';
  document.getElementById('reviewMessage').textContent=''; updateReviewStars(); reviewModal.hidden=false;
}
function updateReviewStars(){document.querySelectorAll('#reviewStars button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.rating)<=selectedRating));}
document.querySelectorAll('#reviewStars button').forEach(btn=>btn.addEventListener('click',()=>{selectedRating=Number(btn.dataset.rating);updateReviewStars();}));
document.getElementById('closeReviewModal')?.addEventListener('click',()=>reviewModal.hidden=true);
reviewModal?.addEventListener('click',e=>{if(e.target===reviewModal)reviewModal.hidden=true;});
document.getElementById('submitReview')?.addEventListener('click',async()=>{
  const out=document.getElementById('reviewMessage');
  if(!selectedRating){out.textContent='Choose a star rating first.';return;}
  try{const r=await fetch(REVIEW_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({bookingId:reviewBooking._id||reviewBooking.id,rating:selectedRating,comment:document.getElementById('reviewComment').value.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.message||'Unable to save review');out.textContent=d.message;setTimeout(()=>{reviewModal.hidden=true;loadBookings();},700);}catch(e){out.textContent=e.message;}
});
