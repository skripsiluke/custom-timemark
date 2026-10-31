const $=id=>document.getElementById(id);
const canvas=$("preview"),ctx=canvas.getContext("2d");
let photo=null,photoFile=null,coords=null,map=null,marker=null,compassText="",altitudeValue=null,exifDate=null,logoImage=null,mapSnapshot=null,mapCaptureBusy=false;
const dateInput=$("dateTime");
function localInputDate(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16)}
dateInput.value=localInputDate();

function setStatus(s){$("status").textContent=s}
function direction(deg){const dirs=["N","NE","E","SE","S","SW","W","NW"];return dirs[Math.round(((deg%360)+360)%360/45)%8]}
function updateCompass(deg){if(Number.isFinite(deg)){compassText=`${Math.round(deg)}° ${direction(deg)}`;$("compass").value=compassText;render()}}
if("DeviceOrientationEvent" in window){
  const listen=()=>window.addEventListener("deviceorientation",e=>{
    let h=Number.isFinite(e.webkitCompassHeading)?e.webkitCompassHeading:(Number.isFinite(e.alpha)?(360-e.alpha):null);
    if(h!==null)updateCompass(h);
  },true);
  if(typeof DeviceOrientationEvent.requestPermission==="function"){
    $("locateBtn").addEventListener("click",async()=>{try{const p=await DeviceOrientationEvent.requestPermission();if(p==="granted")listen()}catch(e){}});
  }else listen();
}

function initMap(){map=L.map("map",{zoomControl:true,scrollWheelZoom:false}).setView([-6.2,106.8],9);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap",crossOrigin:true}).addTo(map)}
initMap();
function setCoords(lat,lon,zoom=17){coords={lat:Number(lat),lon:Number(lon)};$("lat").value=coords.lat.toFixed(6);$("lon").value=coords.lon.toFixed(6);$("coordLabel").textContent=`${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;map.setView([coords.lat,coords.lon],zoom);if(marker)marker.setLatLng([coords.lat,coords.lon]);else marker=L.marker([coords.lat,coords.lon]).addTo(map);render();scheduleMapCapture()}
async function reverseAddress(lat,lon){
  try{
    const u=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const r=await fetch(u,{headers:{"Accept-Language":"id"}});if(!r.ok)throw Error("Reverse geocoding gagal");
    const j=await r.json(),a=j.address||{};
    const desa=a.village||a.suburb||a.neighbourhood||a.hamlet||a.quarter||a.town||a.city_district||"Desa tidak teridentifikasi";
    const kec=a.city_district||a.district||a.county||a.municipality||"";
    const kab=a.city||a.regency||a.county||a.state_district||"";
    const prov=a.state||a.province||"";
    const postcode=a.postcode||"";
    const unique=[desa,kec,kab,prov,postcode].filter((v,i,x)=>v&&x.indexOf(v)===i);
    $("address").value=unique.join(", ");render();
    return true;
  }catch(e){setStatus("Koordinat tersedia, tetapi alamat otomatis gagal dimuat. Periksa koneksi internet atau isi alamat secara manual.");return false}
}
async function getElevation(lat,lon){
  try{const r=await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`);const j=await r.json();const el=j.results?.[0]?.elevation;if(Number.isFinite(el)){altitudeValue=el;$("altitude").value=el.toFixed(1);render()}}catch(e){/* altitude sensor may be unavailable */}
}
async function useLocation(){
  if(!navigator.geolocation){setStatus("Browser ini tidak mendukung GPS.");return}
  setStatus("Meminta lokasi perangkat…");
  navigator.geolocation.getCurrentPosition(async p=>{
    const {latitude,longitude,altitude,heading}=p.coords;setCoords(latitude,longitude);
    if(Number.isFinite(altitude)){altitudeValue=altitude;$("altitude").value=altitude.toFixed(1)}else await getElevation(latitude,longitude);
    if(Number.isFinite(heading))updateCompass(heading);
    setStatus("Lokasi ditemukan. Mengambil alamat berdasarkan koordinat…");
    await reverseAddress(latitude,longitude);setStatus("Lokasi dan alamat berhasil diperbarui.");render();
  },e=>setStatus("Lokasi tidak dapat diakses: "+({1:"izin lokasi ditolak",2:"posisi tidak tersedia",3:"permintaan lokasi melewati batas waktu"}[e.code]||e.message)),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
}
$("locateBtn").addEventListener("click",useLocation);
$("refreshBtn").addEventListener("click",()=>{if(coords){reverseAddress(coords.lat,coords.lon);getElevation(coords.lat,coords.lon)}else useLocation()});
$("applyBtn").addEventListener("click",async()=>{const lat=parseFloat($("lat").value),lon=parseFloat($("lon").value);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){setStatus("Masukkan latitude dan longitude yang valid.");return}setCoords(lat,lon);setStatus("Memperbarui alamat dan ketinggian…");await Promise.all([reverseAddress(lat,lon),getElevation(lat,lon)]);setStatus("Data koordinat diperbarui.");});
["caption","dateTime","compass","altitude","address"].forEach(id=>$(id).addEventListener("input",render));
$("lat").addEventListener("change",()=>{});$("lon").addEventListener("change",()=>{});

$("logoInput").addEventListener("change",e=>{
 const f=e.target.files[0];if(!f)return;if(!f.type.startsWith("image/")){setStatus("Logo harus berupa file gambar.");return}
 const u=URL.createObjectURL(f);const im=new Image();im.onload=()=>{logoImage=im;$("logoThumb").src=u;$("logoThumb").hidden=false;render()};im.onerror=()=>setStatus("Logo tidak dapat dibaca.");im.src=u;
});
$("photoInput").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")){setStatus("File harus berupa gambar.");return}
  photoFile=file;setStatus("Memuat foto dan membaca metadata…");
  try{
    const url=URL.createObjectURL(file);photo=await createImageBitmap(file,{imageOrientation:"from-image"});
    $("emptyState").style.display="none";canvas.style.display="block";
    $("orientationTag").textContent=photo.width>=photo.height?"Landscape":"Portrait";
    let exif={};try{exif=await exifr.parse(file,{gps:true,exif:true})||{}}catch(e){}
    const dt=exif.DateTimeOriginal||exif.CreateDate||exif.ModifyDate;
    if(dt instanceof Date){exifDate=dt;dateInput.value=localInputDate(dt)}
    if(Number.isFinite(exif.latitude)&&Number.isFinite(exif.longitude)){
      setCoords(exif.latitude,exif.longitude);setStatus("Koordinat GPS ditemukan dari metadata foto.");await reverseAddress(exif.latitude,exif.longitude);await getElevation(exif.latitude,exif.longitude);
    }else{render();setStatus("Foto siap. Gunakan tombol Ambil lokasi saya untuk menambahkan GPS, alamat, dan peta.");}
    render();URL.revokeObjectURL(url);
  }catch(err){setStatus("Foto gagal dibaca: "+err.message)}
});
function roundedRect(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);if(fill)c.fill()}
function drawMapImage(){/* Map preview is captured separately from the live Leaflet panel during export. */}
function render(){
 if(!photo)return;
 const w=photo.width,h=photo.height;canvas.width=w;canvas.height=h;
 ctx.drawImage(photo,0,0,w,h);
 const scale=w/900,short=Math.min(w,h),pad=Math.max(14,short*.025),font=Math.max(14,short*.034);
 const date=dateInput.value?new Date(dateInput.value):new Date();
 const dateText=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(date).replace(" pukul", "");
 const lat=coords?`${Math.abs(coords.lat).toFixed(6)}°${coords.lat<0?"S":"N"}`:"Koordinat belum tersedia";
 const lon=coords?`${Math.abs(coords.lon).toFixed(6)}°${coords.lon<0?"W":"E"}`:"";
 const compass=$("compass").value||"—",alt=$("altitude").value?`${$("altitude").value} m`:"—";
 const addr=$("address").value||"Alamat belum tersedia";
 const caption=$("caption").value||"LA Photo Timemark";
 const panelH=Math.max(h*.23,190*scale),bottom=pad;
 const grad=ctx.createLinearGradient(0,h-panelH-pad,0,h);grad.addColorStop(0,"rgba(0,0,0,0)");grad.addColorStop(.25,"rgba(0,0,0,.55)");grad.addColorStop(1,"rgba(0,0,0,.78)");ctx.fillStyle=grad;ctx.fillRect(0,h-panelH-pad,w,panelH+pad);
 // Top-left compass and elevation chips
 ctx.font=`600 ${font*.9}px Arial`;const chipY=pad+font*.3,chipH=font*1.65;
 const chip=(x,y,t,accent=false)=>{const tw=ctx.measureText(t).width;ctx.fillStyle=accent?"rgba(236,76,17,.94)":"rgba(25,27,30,.72)";roundedRect(ctx,x,y,tw+font*1.2,chipH,font*.18,true);ctx.fillStyle="#fff";ctx.fillText(t,x+font*.55,y+chipH*.69);return tw+font*1.2};
 let x=pad;x+=chip(x,chipY,`◉ ${compass}`,true)+font*.35;chip(x,chipY,`▲ ${alt}`);
 if(coords){ctx.font=`500 ${font*.92}px Arial`;ctx.fillStyle="rgba(20,22,25,.7)";const t=`⌖ ${lat}, ${lon}`,tw=ctx.measureText(t).width;roundedRect(ctx,pad,chipY+chipH+font*.22,tw+font*1.2,chipH,font*.15,true);ctx.fillStyle="#fff";ctx.fillText(t,pad+font*.55,chipY+chipH+font*.22+chipH*.69)}
 // Lower logo medallion and copy
 const titleY=h-panelH+font*.5;const logoR=font*1.05;
 let logoBottom=titleY;
 if(logoImage){
   const maxLogo=font*2.25,ratio=Math.min(maxLogo/logoImage.width,maxLogo/logoImage.height);
   const lw=logoImage.width*ratio,lh=logoImage.height*ratio;
   ctx.save();ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=font*.18;ctx.drawImage(logoImage,pad,titleY,lw,lh);ctx.restore();logoBottom=titleY+lh;
 }
 ctx.fillStyle="#fff";ctx.font=`700 ${font*1.35}px Arial`;ctx.fillText(caption,pad,logoBottom+font*1.05);
 ctx.font=`500 ${font*1.02}px Arial`;ctx.fillStyle="#fff";const dateY=logoBottom+font*2.4;
 ctx.fillStyle="#ff5a25";ctx.fillRect(pad,dateY-font*.8,font*.11,font*3.6);
 ctx.fillStyle="#fff";ctx.fillText(dateText,pad+font*.65,dateY);
 const maxWidth=w-pad*2-font*.8;ctx.font=`500 ${font*.98}px Arial`;
 const lines=wrapText(ctx,addr,maxWidth);lines.slice(0,2).forEach((line,i)=>ctx.fillText(line,pad+font*.65,dateY+font*1.5+i*font*1.3));
 // Mini map at the upper-right, refreshed from the current coordinate/map viewport.
 if(mapSnapshot){
   const mw=Math.min(w*.215,h*.19),mh=mw*.78,mx=w-pad-mw,my=pad;
   ctx.save();ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=font*.25;
   ctx.fillStyle="#fff";roundedRect(ctx,mx-4,my-4,mw+8,mh+8,font*.2,true);
   ctx.drawImage(mapSnapshot,mx,my,mw,mh);
   ctx.restore();
 }
 // right-side vertical watermark
 ctx.save();ctx.translate(w-pad*.55,h*.58);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.font=`500 ${font*.7}px Arial`;ctx.fillStyle="rgba(255,255,255,.85)";ctx.fillText("LA Photo Timemark",0,0);ctx.restore();
 ctx.textAlign="right";ctx.font=`700 ${font*.9}px Arial`;ctx.fillStyle="#ffbf37";ctx.fillText("LA Photo Timemark",w-pad,h-pad-font*.7);ctx.font=`500 ${font*.66}px Arial`;ctx.fillStyle="#eee";ctx.fillText("Foto dengan informasi lokasi",w-pad,h-pad);ctx.textAlign="left";
}
function wrapText(c,text,max){const words=String(text).split(/\s+/),lines=[];let line="";for(const word of words){const test=line?line+" "+word:word;if(c.measureText(test).width>max&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);return lines}
function scheduleMapCapture(){
 if(mapCaptureBusy)return;
 mapCaptureBusy=true;
 setTimeout(async()=>{
   try{
     if(window.html2canvas){
       const shot=await html2canvas($("map"),{
         useCORS:true,allowTaint:false,scale:1,backgroundColor:"#252a31",
         logging:false,ignoreElements:el=>el.classList?.contains("leaflet-control")
       });
       // Do not put a tainted canvas onto the final photo canvas; that blocks JPG export.
       try{shot.getContext("2d").getImageData(0,0,1,1);mapSnapshot=shot;}
       catch(err){mapSnapshot=null;console.warn("Peta tidak mengizinkan ekspor lintas-domain; mini map hanya tampil di layar.",err)}
       render();
     }
   }catch(e){mapSnapshot=null;console.warn("Mini map capture gagal:",e)}
   finally{mapCaptureBusy=false}
 },650);
}
async function download(){
 if(!photo){setStatus("Pilih foto terlebih dahulu.");return}
 setStatus("Menyiapkan foto JPG…");
 try{
   // Refresh mini map only when it can be safely copied into the photo canvas.
   if(coords&&window.html2canvas){
     try{
       const shot=await html2canvas($("map"),{
         useCORS:true,allowTaint:false,scale:1,backgroundColor:"#252a31",
         logging:false,ignoreElements:el=>el.classList?.contains("leaflet-control")
       });
       shot.getContext("2d").getImageData(0,0,1,1);
       mapSnapshot=shot;
     }catch(mapErr){
       mapSnapshot=null;
       console.warn("Mini map dilewati saat ekspor karena batasan CORS:",mapErr);
     }
   }
   render();
   const mime="image/jpeg";
   // Use toBlob instead of toDataURL: it is more memory-efficient for large phone photos.
   canvas.toBlob(blob=>{
     if(!blob){setStatus("Browser gagal membuat JPG. Coba foto berukuran lebih kecil atau gunakan Chrome terbaru.");return}
     const url=URL.createObjectURL(blob);
     const a=document.createElement("a");
     a.href=url;
     a.download=`LA-Photo-Timemark-${Date.now()}.jpg`;
     document.body.appendChild(a);
     a.click();
     a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),30000);
     setStatus("JPG berhasil dibuat. Jika unduhan tidak muncul, izinkan unduhan otomatis pada browser.");
   },mime,.94);
 }catch(err){
   console.error(err);
   setStatus("Gagal membuat foto: "+(err?.message||"kesalahan tidak diketahui")+". Coba muat ulang halaman dan unggah foto kembali.");
 }
}
function enableDownload(){ $("downloadBtn").disabled=!photo }
const originalRender=render;render=function(){originalRender();enableDownload()};
