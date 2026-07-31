const API = `${window.location.origin}/api`;
const token = localStorage.getItem("token");
const customerName = localStorage.getItem("name") || "Customer";
if (!token) window.location.href = "login.html";

const welcome = document.getElementById("welcome");
const servicesContainer = document.getElementById("services");
const messageBox = document.getElementById("serviceMessage");
const searchInput = document.getElementById("serviceSearch");
const heroSearch = document.getElementById("heroSearch");
const filterContainer = document.getElementById("categoryFilters");
let allServices = [];
let activeCategory = "All";
let favorites = JSON.parse(localStorage.getItem("favoriteServices") || "[]");
let recent = JSON.parse(localStorage.getItem("recentServices") || "[]");

welcome.textContent = `Welcome, ${customerName} 👋`;
document.getElementById("sidebarUserName").textContent = customerName;
document.getElementById("userAvatar").textContent = customerName.charAt(0).toUpperCase();
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.clear(); window.location.href = "login.html"; });

const serviceIcons = { appliance:"🧰", woodwork:"🪚", electrical:"⚡", outdoor:"🌿", cleaning:"✨", painting:"🎨", plumbing:"🔧" };
function safeText(v){ return String(v ?? ""); }
function serviceId(s){ return s._id || s.id; }
function getIcon(s){ const c=safeText(s.category).toLowerCase(), n=safeText(s.name).toLowerCase(); if(n.includes("ac"))return"❄️"; if(n.includes("water tank"))return"💧"; return serviceIcons[c]||"🏠"; }
function getGradient(index){ return ["service-blue","service-cyan","service-emerald","service-amber"][index%4]; }

function renderQuickCategories(){
  const categories=[...new Map(allServices.map(s=>[safeText(s.category),s])).values()].slice(0,8);
  document.getElementById("quickCategories").innerHTML=categories.map((s,i)=>`<button class="quick-category ${getGradient(i)}" data-category="${safeText(s.category)}"><i>${getIcon(s)}</i><span>${safeText(s.category)}</span><small>Explore →</small></button>`).join("");
  document.querySelectorAll(".quick-category").forEach(btn=>btn.addEventListener("click",()=>{ activeCategory=btn.dataset.category; renderFilters(); renderServices(); document.getElementById("servicesSection").scrollIntoView({behavior:"smooth"}); }));
}

function renderFilters(){
  const categories=["All",...new Set(allServices.map(s=>safeText(s.category)).filter(Boolean))];
  filterContainer.innerHTML="";
  categories.forEach(category=>{ const b=document.createElement("button"); b.type="button"; b.className=`category-filter${category===activeCategory?" active":""}`; b.textContent=category; b.addEventListener("click",()=>{activeCategory=category;renderFilters();renderServices();}); filterContainer.appendChild(b); });
}

function toggleFavorite(id){ favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id]; localStorage.setItem("favoriteServices",JSON.stringify(favorites)); renderServices(); }
function rememberService(id){ recent=[id,...recent.filter(x=>x!==id)].slice(0,4); localStorage.setItem("recentServices",JSON.stringify(recent)); renderRecent(); }
function bookService(id){ if(!id)return; rememberService(id); localStorage.setItem("serviceId",id); window.location.href="booking.html"; }

function createServiceCard(service,index,compact=false){
  const id=serviceId(service), card=document.createElement("article"); card.className=compact?"recent-service-card":"dashboard-service-card reveal-on-scroll"; card.style.setProperty("--delay",`${Math.min(index*70,420)}ms`);
  card.innerHTML=`<div class="service-visual ${getGradient(index)}"><span>${getIcon(service)}</span><small>${index<2?"POPULAR":"TRUSTED"}</small><button class="favorite-btn ${favorites.includes(id)?"active":""}" aria-label="Save service">${favorites.includes(id)?"♥":"♡"}</button></div><div class="service-card-content"><div class="service-card-label">${safeText(service.category||"Home Service")}</div><h3>${safeText(service.name||"Home Service")}</h3><p>${safeText(service.description||"Professional doorstep service from a trusted expert.")}</p><div class="service-card-meta"><span>★ 4.8 <small>(120+)</small></span><span>✓ Verified</span><span>⏱ 45–60 min</span></div><div class="service-card-bottom"><div class="service-price"><small>Starts from</small><strong>₹${Number(service.price||0).toLocaleString("en-IN")}</strong></div><button class="service-btn premium-book-btn" ${!id?"disabled":""}>Book now →</button></div></div>`;
  card.querySelector(".favorite-btn").addEventListener("click",e=>{e.stopPropagation();toggleFavorite(id);});
  card.querySelector(".premium-book-btn").addEventListener("click",()=>bookService(id));
  card.addEventListener("click",e=>{if(!e.target.closest("button")) rememberService(id);});
  return card;
}

function renderServices(){
  const query=searchInput.value.trim().toLowerCase();
  const filtered=allServices.filter(s=>(activeCategory==="All"||s.category===activeCategory)&&`${s.name||""} ${s.description||""} ${s.category||""}`.toLowerCase().includes(query));
  servicesContainer.innerHTML="";
  if(!filtered.length){messageBox.className="page-message service-status empty-state";messageBox.innerHTML="<strong>No matching services found.</strong><span>Try another search or category.</span>";return;}
  messageBox.textContent=`${filtered.length} service${filtered.length===1?"":"s"} available`; messageBox.className="page-message service-status success-state";
  filtered.forEach((s,i)=>servicesContainer.appendChild(createServiceCard(s,i)));
  requestAnimationFrame(()=>document.querySelectorAll(".dashboard-service-card").forEach(c=>c.classList.add("revealed")));
}

function renderRecent(){
  const items=recent.map(id=>allServices.find(s=>serviceId(s)===id)).filter(Boolean);
  const section=document.getElementById("recentSection"), container=document.getElementById("recentServices");
  section.hidden=!items.length; container.innerHTML=""; items.forEach((s,i)=>container.appendChild(createServiceCard(s,i,true)));
}

async function loadServices(){
  messageBox.className="page-message service-status loading-state"; messageBox.textContent="Loading available services..."; servicesContainer.innerHTML=Array.from({length:6},()=>'<div class="service-skeleton"><i></i><b></b><span></span><span></span></div>').join("");
  try{ const r=await fetch(`${API}/services`,{headers:{Accept:"application/json"},cache:"no-store"}); if(!r.ok)throw new Error(`Service request failed (${r.status})`); const p=await r.json(); allServices=Array.isArray(p)?p:(Array.isArray(p.services)?p.services:[]); if(!allServices.length){servicesContainer.innerHTML="";messageBox.className="page-message service-status empty-state";messageBox.innerHTML="<strong>No services available.</strong><span>Add services from admin management.</span>";return;} renderQuickCategories();renderFilters();renderServices();renderRecent(); }
  catch(error){console.error(error);servicesContainer.innerHTML="";messageBox.className="page-message service-status error-state";messageBox.innerHTML=`<strong>We could not load services.</strong><span>${safeText(error.message)}. Check backend port 5000.</span><button type="button" id="retryServices">Try again</button>`;document.getElementById("retryServices")?.addEventListener("click",loadServices);}
}

searchInput.addEventListener("input",renderServices);
document.getElementById("heroSearchBtn").addEventListener("click",()=>{searchInput.value=heroSearch.value;renderServices();document.getElementById("servicesSection").scrollIntoView({behavior:"smooth"});});
heroSearch.addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("heroSearchBtn").click();});

const notificationBtn=document.getElementById("notificationBtn"), notificationPanel=document.getElementById("notificationPanel");
notificationBtn.addEventListener("click",e=>{e.stopPropagation();notificationPanel.classList.toggle("open");}); document.addEventListener("click",()=>notificationPanel.classList.remove("open")); notificationPanel.addEventListener("click",e=>e.stopPropagation());
const themeToggle=document.getElementById("themeToggle");
function applyTheme(theme){document.documentElement.dataset.theme=theme;themeToggle.textContent=theme==="dark"?"☀":"☾";localStorage.setItem("homeserveTheme",theme);} applyTheme(localStorage.getItem("homeserveTheme")||"light"); themeToggle.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));

const counterObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;const el=entry.target,target=Number(el.dataset.count),rating=target===49;let start=0;const tick=()=>{start+=Math.max(1,Math.ceil(target/55));if(start>target)start=target;el.textContent=rating?`${(start/10).toFixed(1)}★`:`${start.toLocaleString("en-IN")}${target>=1000?"+":"+"}`;if(start<target)requestAnimationFrame(tick);};tick();counterObserver.unobserve(el);}),{threshold:.5});document.querySelectorAll("[data-count]").forEach(el=>counterObserver.observe(el));

function formatCurrency(value){ return `₹${Number(value || 0).toLocaleString("en-IN")}`; }
function formatBookingDate(value){
  if(!value) return "Date not available";
  return new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
}
function statusClass(status){ return safeText(status).toLowerCase().replace(/\s+/g,"-"); }
function renderBookingOverview(bookings){
  const items=Array.isArray(bookings)?bookings:[];
  const active=items.filter(b=>!["Completed","Cancelled"].includes(b.status));
  const completed=items.filter(b=>b.status==="Completed");
  const totalSpent=completed.reduce((sum,b)=>sum+Number(b.pricing?.total||0),0);
  document.getElementById("metricTotalBookings").textContent=items.length;
  document.getElementById("metricActiveBookings").textContent=active.length;
  document.getElementById("metricCompletedBookings").textContent=completed.length;
  document.getElementById("metricTotalSpent").textContent=formatCurrency(totalSpent);
  const next=active.filter(b=>new Date(b.bookingDate)>=new Date()).sort((a,b)=>new Date(a.bookingDate)-new Date(b.bookingDate))[0];
  const box=document.getElementById("upcomingBookingContent");
  if(!next){
    box.innerHTML=`<div class="no-upcoming-booking"><i>⌂</i><h4>No upcoming booking</h4><p>Your next home-service request will appear here.</p><a class="btn btn-primary" href="#servicesSection">Book now</a></div>`;
    return;
  }
  const name=safeText(next.service?.name||"Home Service");
  const provider=safeText(next.provider?.name||"Provider will be assigned soon");
  box.innerHTML=`<div class="upcoming-service-row"><div class="upcoming-service-icon">${getIcon(next.service||{})}</div><div><span>${safeText(next.bookingCode||"HomeServe booking")}</span><h4>${name}</h4><p>${formatBookingDate(next.bookingDate)} · ${safeText(next.timeSlot||"")}</p></div><b class="booking-status-pill ${statusClass(next.status)}">${safeText(next.status||"Pending")}</b></div><div class="upcoming-details"><div><small>Professional</small><strong>${provider}</strong></div><div><small>Service total</small><strong>${formatCurrency(next.pricing?.total)}</strong></div></div><div class="booking-progress-line"><span class="active"></span><span class="${["Accepted","On the Way","Completed"].includes(next.status)?"active":""}"></span><span class="${["On the Way","Completed"].includes(next.status)?"active":""}"></span><span class="${next.status==="Completed"?"active":""}"></span></div><div class="booking-progress-labels"><span>Created</span><span>Accepted</span><span>On the way</span><span>Completed</span></div>`;
}
async function loadBookingOverview(){
  const message=document.getElementById("dashboardBookingMessage");
  try{
    const response=await fetch(`${API}/bookings`,{headers:{Authorization:token,Accept:"application/json"},cache:"no-store"});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.message||"Unable to load booking overview");
    renderBookingOverview(payload);
    message.textContent="";
  }catch(error){
    console.error(error);
    renderBookingOverview([]);
    message.textContent="Booking overview could not be loaded. Your services are still available below.";
  }
}

document.getElementById("showFavoritesAction")?.addEventListener("click",()=>{
  const favoriteSet=new Set(favorites);
  activeCategory="All";
  renderFilters();
  searchInput.value="";
  servicesContainer.innerHTML="";
  const saved=allServices.filter(s=>favoriteSet.has(serviceId(s)));
  if(!saved.length){
    messageBox.className="page-message service-status empty-state";
    messageBox.innerHTML="<strong>No saved services yet.</strong><span>Tap the heart icon on a service card to save it.</span>";
  }else{
    messageBox.className="page-message service-status success-state";
    messageBox.textContent=`${saved.length} saved service${saved.length===1?"":"s"}`;
    saved.forEach((service,index)=>servicesContainer.appendChild(createServiceCard(service,index)));
  }
  document.getElementById("servicesSection").scrollIntoView({behavior:"smooth"});
});

loadServices();
loadBookingOverview();
