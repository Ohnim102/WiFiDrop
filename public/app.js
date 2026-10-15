const $ = id => document.getElementById(id);
const roomInput = $('room'), connectBtn = $('connectBtn'), fileInput = $('fileInput');
const textInput = $('textInput'), sendTextBtn = $('sendTextBtn');
let ws, pc, channel, connected = false, cancelled = false, toastTimer, pendingCandidates = [];
const CHUNK = 48 * 1024, HIGH_WATER = 768 * 1024;
const fmt = n => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n/1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n/1024**2).toFixed(1)} MB` : `${(n/1024**3).toFixed(2)} GB`;
function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3000); }
function status(text, state='') { $('connectionText').textContent=text; $('connection').className=`connection ${state}`; }
function peerBadge(text) { $('peerBadge').textContent=text; }
function setReady(ready) {
  connected=ready; fileInput.disabled=!ready; textInput.disabled=!ready; sendTextBtn.disabled=!ready; $('dropzone').classList.toggle('disabled',!ready);
  $('dropTitle').textContent=ready?'Thả file vào đây để gửi':'Đang chờ kết nối';
  $('dropCaption').textContent=ready?'Hoặc chọn nhiều file từ thiết bị này':'Kết nối với thiết bị còn lại để bắt đầu gửi file';
  if(ready){status('Hai thiết bị đã kết nối','connected');peerBadge('Đã kết nối');}
}
function connect() {
  const room=roomInput.value.trim(); if(!room){roomInput.focus();toast('Nhập mã phòng để kết nối.');return;}
  if(ws)ws.close(); const protocol=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(`${protocol}//${location.host}/signal`); status('Đang kết nối tới phòng…'); peerBadge('Đang kết nối'); connectBtn.disabled=true;
  ws.onopen=()=>ws.send(JSON.stringify({type:'join',room}));
  ws.onmessage=async event=>{const msg=JSON.parse(event.data);try{
    if(msg.type==='joined'){status(msg.count===1?'Đang chờ thiết bị còn lại…':'Đang ghép nối…');peerBadge(msg.count===1?'Chờ thiết bị':'Đang ghép nối');}
    if(msg.type==='peer-joined'){status('Đang thiết lập kết nối trực tiếp…');await createPeer(true);}
    if(msg.type==='offer'){await createPeer(false);await pc.setRemoteDescription(msg.sdp);for(const c of pendingCandidates)await pc.addIceCandidate(c);pendingCandidates=[];const answer=await pc.createAnswer();await pc.setLocalDescription(answer);sendSignal({type:'answer',sdp:pc.localDescription});}
    if(msg.type==='answer'&&pc){await pc.setRemoteDescription(msg.sdp);for(const c of pendingCandidates)await pc.addIceCandidate(c);pendingCandidates=[];}
    if(msg.type==='candidate'&&msg.candidate){if(pc?.remoteDescription)await pc.addIceCandidate(msg.candidate);else pendingCandidates.push(msg.candidate);}
    if(msg.type==='peer-left'){setReady(false);status('Thiết bị kia đã rời phòng');peerBadge('Mất kết nối');}
    if(msg.type==='error'){status(msg.message,'error');peerBadge('Lỗi');toast(msg.message);connectBtn.disabled=false;}
  }catch(err){console.error(err);toast('Không thể thiết lập kết nối. Hãy thử kết nối lại.');}};
  ws.onclose=()=>{connectBtn.disabled=false;if(connected)setReady(false);};
  ws.onerror=()=>{status('Không kết nối được tới server','error');peerBadge('Lỗi');connectBtn.disabled=false;};
}
function sendSignal(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
async function createPeer(initiator){if(pc)pc.close();pendingCandidates=[];pc=new RTCPeerConnection({iceServers:[]});pc.onicecandidate=e=>{if(e.candidate)sendSignal({type:'candidate',candidate:e.candidate});};pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')setReady(true);else if(['failed','disconnected','closed'].includes(pc.connectionState)){setReady(false);if(pc.connectionState==='failed')status('Kết nối trực tiếp thất bại — kiểm tra cùng Wi-Fi','error');}};pc.ondatachannel=e=>setupChannel(e.channel);if(initiator){channel=pc.createDataChannel('files');setupChannel(channel);const offer=await pc.createOffer();await pc.setLocalDescription(offer);sendSignal({type:'offer',sdp:pc.localDescription});}}
function setupChannel(ch){channel=ch;channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=HIGH_WATER/2;channel.onopen=()=>setReady(true);channel.onclose=()=>setReady(false);channel.onmessage=e=>receive(e.data);}
let incoming=null, received=[], receivedBytes=0;
function receive(data){
  if(typeof data==='string'){let m;try{m=JSON.parse(data)}catch{return;}
    if(m.kind==='text'){showText(m.text);}
    else if(m.kind==='file-start'){incoming=m;received=[];receivedBytes=0;showFile(m.name,m.size,'Đang nhận…');channel.send(JSON.stringify({kind:'file-ack'}));}
    else if(m.kind==='file-cancel'&&incoming){updateFile(incoming.name,'Người gửi đã hủy');incoming=null;received=[];receivedBytes=0;}
    else if(m.kind==='file-end'&&incoming){const blob=new Blob(received,{type:incoming.type||'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=incoming.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);updateFile(incoming.name,'Đã nhận · '+fmt(incoming.size));toast(`Đã nhận ${incoming.name}`);incoming=null;received=[];}
  }else if(incoming){received.push(data);receivedBytes+=data.byteLength;updateFile(incoming.name,`Đang nhận · ${Math.min(100,Math.round(receivedBytes/incoming.size*100))}%`);}
}
function showFile(name,size,state){const row=document.createElement('div');row.className='file-item';row.dataset.name=name;const icon=document.createElement('span');icon.className='file-icon';icon.textContent=(name.split('.').pop()||'FILE').slice(0,4).toUpperCase();const info=document.createElement('span');info.className='file-info';const b=document.createElement('b');b.textContent=name;const small=document.createElement('span');small.textContent=`${fmt(size)} · ${state}`;info.append(b,small);row.append(icon,info);$('fileList').prepend(row);}
function showText(text){const card=document.createElement('div');card.className='text-card';const head=document.createElement('div');head.className='text-card-head';const label=document.createElement('span');label.textContent='Văn bản nhận được';const button=document.createElement('button');button.className='copy-button';button.textContent='Sao chép';const pre=document.createElement('pre');pre.textContent=text;button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);toast('Đã sao chép văn bản.');}catch{toast('Không thể truy cập clipboard trên thiết bị này.');}});head.append(label,button);card.append(head,pre);$('fileList').prepend(card);}
function updateFile(name,state){const row=[...$('fileList').children].find(x=>x.dataset.name===name);if(row){const s=row.querySelector('.file-info span');if(s)s.textContent=state;}}
function waitBuffer(){return new Promise(resolve=>{if(channel.bufferedAmount<=HIGH_WATER)return resolve();channel.onbufferedamountlow=()=>resolve();});}
async function sendFile(file){if(!connected||channel?.readyState!=='open'){toast('Hai thiết bị chưa kết nối.');return;}cancelled=false;$('progressWrap').hidden=false;$('progressName').textContent=file.name;$('progressPct').textContent='0%';$('progressBar').style.width='0%';$('progressDetail').textContent=`0 B / ${fmt(file.size)}`;showFile(file.name,file.size,'Đang gửi…');channel.send(JSON.stringify({kind:'file-start',name:file.name,size:file.size,type:file.type}));
  await new Promise(resolve=>{const prev=channel.onmessage;channel.onmessage=e=>{if(typeof e.data==='string'){try{if(JSON.parse(e.data).kind==='file-ack'){channel.onmessage=prev;resolve();return;}}catch{}}if(prev)prev(e);};});
  let sent=0;while(sent<file.size&&!cancelled){await waitBuffer();const chunk=file.slice(sent,sent+CHUNK);channel.send(await chunk.arrayBuffer());sent+=chunk.size;const pct=Math.round(sent/file.size*100);$('progressPct').textContent=`${pct}%`;$('progressBar').style.width=`${pct}%`;$('progressDetail').textContent=`${fmt(sent)} / ${fmt(file.size)}`;updateFile(file.name,`Đang gửi · ${pct}%`);}
  if(cancelled){channel.send(JSON.stringify({kind:'file-cancel'}));updateFile(file.name,'Đã hủy');$('progressName').textContent='Đã hủy';return;}channel.send(JSON.stringify({kind:'file-end'}));updateFile(file.name,'Đã gửi · '+fmt(file.size));$('progressName').textContent='Đã gửi thành công';toast(`Đã gửi ${file.name}`);
}
let fileQueue=[],sendingQueue=false;
async function sendFiles(files){const picked=[...files];if(!picked.length)return;if(!connected){toast("Kết nối với thiết bị kia trước khi gửi file.");return;}fileQueue.push(...picked);if(sendingQueue){toast(`Đã thêm ${picked.length} file vào hàng đợi.`);return;}sendingQueue=true;try{while(fileQueue.length&&connected){const next=fileQueue.shift();await sendFile(next);}}finally{sendingQueue=false;if(fileQueue.length&&!connected){fileQueue=[];toast("Đã dừng hàng đợi vì kết nối bị ngắt.");}}}
$('textInput').addEventListener('input',()=>{$('textCount').textContent=`${textInput.value.length.toLocaleString()} ký tự`;});
sendTextBtn.addEventListener('click',()=>{const text=textInput.value;if(!connected||channel?.readyState!=='open'){toast('Hai thiết bị chưa kết nối.');return;}if(!text.trim()){toast('Nhập nội dung text trước khi gửi.');return;}const payload=JSON.stringify({kind:'text',text});if(new TextEncoder().encode(payload).byteLength>48*1024){toast('Văn bản quá dài; giới hạn khoảng 48 KB mỗi lần gửi.');return;}channel.send(payload);showText(text);textInput.value='';$('textCount').textContent='0 ký tự';toast('Đã gửi văn bản.');});
document.addEventListener('paste',event=>{const item=[...(event.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(!item)return;if(!connected){toast('Kết nối với thiết bị kia trước khi gửi ảnh.');return;}const image=item.getAsFile();if(image){event.preventDefault();const ext=image.type.split('/')[1]?.replace('jpeg','jpg')||'png';sendFiles([new File([image],`clipboard-${Date.now()}.${ext}`,{type:image.type})]);}});
connectBtn.addEventListener('click',connect);roomInput.addEventListener('keydown',e=>{if(e.key==='Enter')connect();});fileInput.addEventListener('change',()=>{sendFiles([...fileInput.files]);fileInput.value='';});$('cancelBtn').addEventListener('click',()=>{cancelled=true;});
const dz=$('dropzone');for(const name of ['dragenter','dragover'])dz.addEventListener(name,e=>{e.preventDefault();if(connected)dz.classList.add('dragover');});for(const name of ['dragleave','drop'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('dragover');});dz.addEventListener('drop',e=>{if(connected)sendFiles([...e.dataTransfer.files]);});
roomInput.value=new URLSearchParams(location.search).get('room')||'';



