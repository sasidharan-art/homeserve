const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('sidebarOverlay');
const openBtn=document.getElementById('openSidebar');
const closeBtn=document.getElementById('closeSidebar');
function openSidebar(){if(!sidebar||!overlay)return;sidebar.classList.add('open');overlay.classList.add('active');document.body.classList.add('sidebar-open');openBtn?.setAttribute('aria-expanded','true');}
function closeSidebar(){if(!sidebar||!overlay)return;sidebar.classList.remove('open');overlay.classList.remove('active');document.body.classList.remove('sidebar-open');openBtn?.setAttribute('aria-expanded','false');}
openBtn?.addEventListener('click',openSidebar);closeBtn?.addEventListener('click',closeSidebar);overlay?.addEventListener('click',closeSidebar);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});document.querySelectorAll('.sidebar-link').forEach(link=>link.addEventListener('click',closeSidebar));
