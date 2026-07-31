(() => {
  const API_ORIGIN = window.location.origin;
  const token = localStorage.getItem("token");
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const headers = json => ({ Authorization:`Bearer ${token}`, Accept:"application/json", ...(json?{"Content-Type":"application/json"}:{}) });
  let workers=[];
  async function request(path, options={}) {
    const response=await fetch(`${API_ORIGIN}/api/admin${path}`, {cache:"no-store",...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||"Request failed.");
    return data;
  }
  function badge(value){ return `<span class="verification-pill ${String(value).toLowerCase().replace(/\s+/g,'-')}">${esc(value)}</span>`; }
  function render(){
    const body=$("verificationBody"); if(!body) return;
    $("verificationPending").textContent=workers.filter(w=>w.workerVerification?.status==="Pending").length;
    $("verificationVerified").textContent=workers.filter(w=>w.workerVerification?.status==="Verified").length;
    $("verificationCleared").textContent=workers.filter(w=>w.workerVerification?.backgroundCheck==="Cleared").length;
    $("verificationBadge").textContent=workers.filter(w=>["Pending","Not Submitted"].includes(w.workerVerification?.status||"Not Submitted")).length;
    body.innerHTML=workers.length?workers.map(w=>{const v=w.workerVerification||{};return `<tr>
      <td><strong>${esc(w.name)}</strong><small>${esc(w.email)} · ${esc(w.phone)}</small></td>
      <td><select data-field="governmentIdType" data-id="${w._id}">${["","Aadhaar","PAN","Driving Licence","Voter ID","Passport"].map(x=>`<option ${x===(v.governmentIdType||"")?"selected":""}>${x||"Select ID"}</option>`).join("")}</select><input data-field="governmentIdLast4" data-id="${w._id}" maxlength="4" inputmode="numeric" placeholder="Last 4 digits" value="${esc(v.governmentIdLast4||"")}"></td>
      <td><input data-field="certifications" data-id="${w._id}" placeholder="Electrician, AC certified" value="${esc((v.certifications||[]).join(', '))}"></td>
      <td><select data-field="backgroundCheck" data-id="${w._id}">${["Not Started","Pending","Cleared","Failed"].map(x=>`<option ${x===(v.backgroundCheck||"Not Started")?"selected":""}>${x}</option>`).join("")}</select></td>
      <td>${badge(v.status||"Not Submitted")}<select data-field="status" data-id="${w._id}">${["Not Submitted","Pending","Verified","Rejected"].map(x=>`<option ${x===(v.status||"Not Submitted")?"selected":""}>${x}</option>`).join("")}</select><textarea data-field="adminNote" data-id="${w._id}" maxlength="500" placeholder="Internal note">${esc(v.adminNote||"")}</textarea></td>
      <td><button class="btn btn-primary verification-save" data-save-id="${w._id}">Save review</button></td>
    </tr>`}).join(""):`<tr><td colspan="6" class="empty-cell">No worker accounts found.</td></tr>`;
  }
  async function load(){ try{workers=await request('/providers/verification',{headers:headers()});render();}catch(e){if($("verificationBody"))$("verificationBody").innerHTML=`<tr><td colspan="6" class="empty-cell">${esc(e.message)}</td></tr>`;} }
  document.addEventListener('click',async e=>{const btn=e.target.closest('[data-save-id]');if(!btn)return;const id=btn.dataset.saveId;const get=f=>document.querySelector(`[data-field="${f}"][data-id="${id}"]`);btn.disabled=true;btn.textContent='Saving…';try{await request(`/providers/${id}/verification`,{method:'PATCH',headers:headers(true),body:JSON.stringify({governmentIdType:get('governmentIdType').value,governmentIdLast4:get('governmentIdLast4').value,certifications:get('certifications').value.split(',').map(x=>x.trim()).filter(Boolean),backgroundCheck:get('backgroundCheck').value,status:get('status').value,adminNote:get('adminNote').value})});await load();}catch(err){notify(err.message,'error');}finally{btn.disabled=false;btn.textContent='Save review';}});
  $("refreshVerification")?.addEventListener('click',load);
  load();
})();
