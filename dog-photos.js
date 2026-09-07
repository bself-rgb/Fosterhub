/* Second Leash Hub — Dog identification photos
   Requires the existing global Supabase `client` and `currentDog`. */
(function(){
  const BUCKET = 'dog-photos';
  const $ = id => document.getElementById(id);
  const esc = v => typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  function toast(text, ok=false){
    if(typeof window.msg === 'function'){ window.msg(text, ok); return; }
    let n=$('dogPhotoToast');
    if(!n){ n=document.createElement('div'); n.id='dogPhotoToast'; Object.assign(n.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:10000,padding:'12px 16px',borderRadius:'10px',color:'#fff',fontWeight:'600'}); document.body.appendChild(n); }
    n.textContent=text; n.style.background=ok?'#2e8b62':'#c94b4b'; n.style.display='block'; clearTimeout(n._t); n._t=setTimeout(()=>n.style.display='none',3500);
  }
  function injectStyles(){
    if($('dogPhotoStyles')) return;
    const s=document.createElement('style'); s.id='dogPhotoStyles'; s.textContent=`
      .dog-photo-wrap{margin-top:16px}.dog-photo-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
      .dog-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.dog-photo-card{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
      .dog-photo-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#eef1f4}.dog-photo-meta{padding:9px;font-size:12px}
      .dog-photo-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.dog-photo-primary{font-size:10px;font-weight:800;text-transform:uppercase;color:#23714e;background:#e8f6ef;border-radius:999px;padding:4px 7px;display:inline-block}
      .dog-photo-empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}
    `; document.head.appendChild(s);
  }
  function addPanel(){
    const profile=document.getElementById('dogProfile');
    if(!profile || $('dogPhotosPanel')) return;
    const panel=document.createElement('div'); panel.id='dogPhotosPanel'; panel.className='panel dog-photo-wrap';
    panel.innerHTML=`<h2>📷 Identification Photos</h2>
      <div class="dog-photo-toolbar"><input id="dogPhotoInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple style="max-width:320px"><button class="btn primary" id="dogPhotoUploadBtn">Upload Photos</button></div>
      <div class="muted" style="margin-bottom:12px">Use a clear photo that makes the dog easy to identify. The first primary photo will also be used as the profile thumbnail.</div>
      <div id="dogPhotoGrid"><div class="dog-photo-empty">Open a dog to view identification photos.</div></div>`;
    const firstPanel=profile.querySelector('.panel');
    if(firstPanel) firstPanel.after(panel); else profile.appendChild(panel);
    $('dogPhotoUploadBtn').onclick=uploadSelected;
  }
  async function listPhotos(){
    if(!window.currentDog?.id) return [];
    const {data,error}=await client.from('dog_photos').select('*').eq('dog_id',currentDog.id).order('is_primary',{ascending:false}).order('created_at',{ascending:true});
    if(error) throw error;
    const photos=data||[];
    for(const p of photos){ const {data:urlData,error:urlError}=await client.storage.from(BUCKET).createSignedUrl(p.storage_path,3600); p.signed_url=urlError?'':(urlData?.signedUrl||''); }
    return photos;
  }
  async function renderPhotos(){
    const grid=$('dogPhotoGrid'); if(!grid) return;
    try{
      const photos=await listPhotos();
      if(!photos.length){ grid.innerHTML='<div class="dog-photo-empty">No identification photos yet.</div>'; return; }
      grid.innerHTML=photos.map(p=>`<div class="dog-photo-card">${p.signed_url?`<img src="${esc(p.signed_url)}" alt="${esc(currentDog.name||'Dog')} identification photo" loading="lazy">`:'<div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;color:var(--muted)">Preview unavailable</div>'}<div class="dog-photo-meta">${p.is_primary?'<span class="dog-photo-primary">Primary</span>':''}<div style="margin-top:5px">${esc(p.file_name||'Dog photo')}</div><div class="dog-photo-actions">${!p.is_primary?`<button class="btn secondary small-btn" onclick="window.fhSetPrimaryPhoto('${esc(p.id)}')">Set primary</button>`:''}<button class="btn secondary small-btn danger" onclick="window.fhDeletePhoto('${esc(p.id)}','${esc(p.storage_path)}')">Delete</button></div></div></div>`).join('');
    }catch(e){ console.error('Dog photos:',e); grid.innerHTML=`<div class="dog-photo-empty">Unable to load photos: ${esc(e.message)}</div>`; }
  }
  async function uploadSelected(){
    if(!window.currentDog?.id){ toast('Open a dog record before uploading photos.'); return; }
    const input=$('dogPhotoInput'); const files=[...(input?.files||[])]; if(!files.length){ toast('Choose at least one photo first.'); return; }
    const btn=$('dogPhotoUploadBtn'); btn.disabled=true;
    try{
      for(const file of files){
        if(!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
        if(file.size>10*1024*1024) throw new Error(`${file.name} is larger than 10 MB.`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`${currentDog.id}/${crypto.randomUUID()}-${safeName}`;
        const {error:upError}=await client.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'}); if(upError) throw upError;
        const {data:userData}=await client.auth.getUser(); const {data:existing}=await client.from('dog_photos').select('id').eq('dog_id',currentDog.id).limit(1);
        const {error:dbError}=await client.from('dog_photos').insert({dog_id:currentDog.id,storage_path:path,file_name:file.name,is_primary:!(existing&&existing.length),created_by:userData?.user?.id||null});
        if(dbError){ await client.storage.from(BUCKET).remove([path]); throw dbError; }
      }
      input.value=''; await renderPhotos(); toast('Dog photo(s) uploaded.',true);
    }catch(e){ console.error(e); toast('Unable to upload photo(s): '+e.message); } finally{ btn.disabled=false; }
  }
  window.fhSetPrimaryPhoto=async function(id){
    if(!window.currentDog?.id) return;
    try{
      let r=await client.from('dog_photos').update({is_primary:false}).eq('dog_id',currentDog.id); if(r.error) throw r.error;
      r=await client.from('dog_photos').update({is_primary:true}).eq('id',id).eq('dog_id',currentDog.id); if(r.error) throw r.error;
      await renderPhotos(); toast('Primary identification photo updated.',true);
    }catch(e){ toast('Unable to set primary photo: '+e.message); }
  };
  window.fhDeletePhoto=async function(id,path){
    if(!confirm('Delete this dog photo?')) return;
    try{
      const {error}=await client.from('dog_photos').delete().eq('id',id).eq('dog_id',currentDog.id); if(error) throw error;
      const storageResult=await client.storage.from(BUCKET).remove([path]); if(storageResult.error) console.warn(storageResult.error);
      await renderPhotos(); toast('Photo deleted.',true);
    }catch(e){ toast('Unable to delete photo: '+e.message); }
  };
  function hookViewDog(){
    if(typeof window.viewDog !== 'function' || window.viewDog.__photoHooked) return;
    const original=window.viewDog; const wrapped=async function(id){ const result=await original.apply(this,arguments); setTimeout(()=>renderPhotos(),100); return result; }; wrapped.__photoHooked=true; window.viewDog=wrapped;
  }
  function init(){ injectStyles(); addPanel(); hookViewDog(); const observer=new MutationObserver(()=>{addPanel();hookViewDog();}); observer.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
