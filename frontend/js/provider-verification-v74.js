(async()=>{
  const origin=window.location.origin;
  const token=localStorage.getItem('token');
  const status=document.getElementById('workerVerificationStatus');
  const text=document.getElementById('workerVerificationText');
  const background=document.getElementById('workerBackgroundStatus');
  if(!status||!token)return;
  try{
    const r=await fetch(`${origin}/api/provider/profile`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const p=await r.json(); if(!r.ok)throw new Error(p.message||'Unable to load verification.');
    const v=p.workerVerification||{}; const current=v.status||'Not Submitted';
    status.textContent=current; status.className=`verification-pill ${current.toLowerCase().replace(/\s+/g,'-')}`;
    background.textContent=`Background: ${v.backgroundCheck||'Not Started'}`;
    const id=v.governmentIdType?`${v.governmentIdType}${v.governmentIdLast4?` ending ${v.governmentIdLast4}`:''}`:'Identity details not added';
    const cert=(v.certifications||[]).length?`${v.certifications.length} certification(s) recorded`:'No certifications recorded';
    text.textContent=`${id}. ${cert}. Contact the administrator if any detail is incorrect.`;
  }catch(e){text.textContent=e.message;status.textContent='Unavailable';}
})();
