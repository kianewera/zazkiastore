const $=id=>document.getElementById(id);
const money=v=>v==null?'Harga tidak tersedia':`$${v}`;
async function loadCatalog(){
 $('status').hidden=false; $('status').textContent='Memuat katalog produk…'; $('products').innerHTML='';
 try{
  const r=await fetch('/api/catalog'); const j=await r.json(); if(!r.ok)throw new Error(j.error||'Gagal memuat katalog');
  const items=j.items||[];
  if(!items.length){$('status').textContent='Produk belum tersedia. Silakan kembali lagi nanti.';return;}
  $('status').hidden=true;
  $('products').innerHTML=items.map(p=>`<article class="product"><div class="category">${esc(p.category||'Digital')}</div><h3>${esc(p.name||p.product||p.apiCode)}</h3><div class="muted">${esc(p.label||'')}</div><div class="price">${money(p.priceUsd)}</div><div class="stock ${p.inStock?'':'off'}">${p.inStock?'Tersedia':'Stok habis'} · ${Number(p.stock??0)} stok</div></article>`).join('');
 }catch(e){$('status').textContent=e.message}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadPayment(){try{const r=await fetch('/api/payment-info');const j=await r.json();$('paymentNote').textContent=j.paymentNote||'';if(j.qrUrl){$('paymentQr').src=j.qrUrl;$('paymentQr').hidden=false}else $('paymentQr').hidden=true}catch{}}
$('year').textContent=new Date().getFullYear();$('refresh').onclick=loadCatalog;
$('adminOpen').onclick=async()=>{$('adminDialog').showModal();$('adminMsg').textContent='';const r=await fetch('/api/admin/status');const j=await r.json();$('loginView').hidden=j.loggedIn;$('dashboard').hidden=!j.loggedIn;if(j.loggedIn)loadAdminSettings()};
$('closeAdmin').onclick=()=>$('adminDialog').close();
async function loadAdminSettings(){const r=await fetch('/api/admin/settings');if(!r.ok)return;const j=await r.json();$('apiKey').placeholder=j.hasApiKey?'API Key sudah tersimpan — isi hanya jika ingin mengganti':'Masukkan Drip API Key';$('qrUrl').value=j.qrUrl||'';$('paymentText').value=j.paymentNote||''}
$('loginBtn').onclick=async()=>{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value,password:$('password').value})});const j=await r.json();if(!r.ok){$('adminMsg').textContent=j.error;return}$('loginView').hidden=true;$('dashboard').hidden=false;$('adminMsg').textContent='';loadAdminSettings()};
async function save(body){const r=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();$('adminMsg').textContent=r.ok?'Pengaturan berhasil disimpan.':j.error;return r.ok}
$('saveSettings').onclick=async()=>{if(await save({apiKey:$('apiKey').value})){ $('apiKey').value='';loadCatalog();loadAdminSettings()}};
$('savePayment').onclick=async()=>{if(await save({qrUrl:$('qrUrl').value,paymentNote:$('paymentText').value}))loadPayment()};
$('accountBtn').onclick=async()=>{const r=await fetch('/api/admin/account');const j=await r.json();$('accountInfo').textContent=r.ok?JSON.stringify({account:j.me,balance:j.balance},null,2):j.error};
$('logoutBtn').onclick=async()=>{await fetch('/api/admin/logout',{method:'POST'});$('dashboard').hidden=true;$('loginView').hidden=false;$('password').value=''};
loadCatalog();loadPayment();