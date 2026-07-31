const API=`${window.location.origin}/api/bookings`;
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
  article.innerHTML=`<div class="booking-card-top"><div class="booking-service-identity"><i>⌂</i><div><span>${safe(b.bookingCode||'HomeServe booking')}</span><h3>${service}</h3></div></div><b class="booking-status-pill ${statusClass(status)}">${status}</b></div><div class="booking-information-grid"><div><small>Date</small><strong>${dateText(b.bookingDate)}</strong></div><div><small>Time slot</small><strong>${safe(b.timeSlot||'Not specified')}</strong></div><div><small>Professional</small><strong>${provider}</strong></div><div><small>Total</small><strong>${money(b.pricing?.total)}</strong></div></div><div class="booking-address"><small>Service address</small><p>${safe(b.address||'Not specified')}</p></div><div class="booking-progress-line"><span class="active"></span><span class="${['Accepted','On the Way','Completed'].includes(status)?'active':''}"></span><span class="${['On the Way','Completed'].includes(status)?'active':''}"></span><span class="${status==='Completed'?'active':''}"></span></div><div class="booking-progress-labels"><span>Created</span><span>Accepted</span><span>On the way</span><span>Completed</span></div><div class="booking-card-actions"><a href="contact.html" class="btn btn-secondary">Get support</a>${canTrack?`<button class="btn btn-primary track-worker-btn" data-id="${b._id||b.id}">Track worker</button>`:''}${canCancel?`<button class="cancel-booking-btn" data-id="${b._id||b.id}">Cancel booking</button>`:''}</div>`;
  article.querySelector('.cancel-booking-btn')?.addEventListener('click',()=>cancelBooking(b._id||b.id));
  article.querySelector('.track-worker-btn')?.addEventListener('click',()=>openWorkerTracking(b));
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
