// scene.js — Trạng thái dùng chung, thiết lập canvas, dữ liệu & hàm vẽ:
// phi kiếm, đội hình, tia sét, Đại Kiếm.
window.App = window.App || {};

/* ---------- Trạng thái & tham chiếu DOM dùng chung ---------- */

App.state = {
  W: 0, H: 0, DPR: 1,
  mx: 0, my: 0, prevMx: 0, prevMy: 0,
  mouseVelX: 0, mouseVelY: 0,
  dragging: false,

  idleMode: 'free',      // 'free' | 'formation' | 'stored'
  formationIndex: 0,
  t: 0,

  COUNT_MODES: [18, 36, 72],
  countIndex: 2,
  activeCount: 72,

  illusionOn: false,
  lightningOn: true,

  greatSwordActive: false,
  greatSwordX: 0,
  greatSwordY: 0,
  greatSwordAngle: 0,
  greatSwordProgress: 0  // Biến kiểm soát hiệu ứng hội tụ/tách ra mượt mà
};
App.state.activeCount = App.state.COUNT_MODES[App.state.countIndex];

App.dom = {
  canvas: document.getElementById('c'),
  stateTag: document.getElementById('stateTag'),
  swordCountEl: document.getElementById('swordCount'),
  storeBtn: document.getElementById('storeBtn'),
  changeFormBtn: document.getElementById('changeFormBtn'),
  countBtn: document.getElementById('countBtn'),
  illusionBtn: document.getElementById('illusionBtn'),
  lightningBtn: document.getElementById('lightningBtn'),

  handBtn: document.getElementById('handBtn'),
  handPanel: document.getElementById('handPanel'),
  handVideo: document.getElementById('handVideo'),
  handOverlay: document.getElementById('handOverlay'),
  handStatus: document.getElementById('handStatus')
};
App.dom.ctx = App.dom.canvas.getContext('2d');
App.dom.handOverlayCtx = App.dom.handOverlay.getContext('2d');

/* ---------- Khởi tạo và tải hình ảnh kiem.png ---------- */
App.swordImg = new Image();
App.swordImg.src = 'kiem.png'; 
App.swordImgLoaded = false;
App.swordImg.onload = function() {
  App.swordImgLoaded = true;
};

/* ---------- Hàm toán học tiện ích ---------- */

App.utils = {
  noise1D(t, seed){
    return Math.sin(t*0.6 + seed) * 0.5 + Math.sin(t*1.37 + seed*2.13) * 0.3 + Math.sin(t*2.31 + seed*3.7) * 0.2;
  },
  lerp(a,b,f){ return a + (b-a)*f; },
  clampMag(x,y,max){
    const m = Math.hypot(x,y);
    if (m > max){ const k = max/m; return [x*k, y*k]; }
    return [x,y];
  }
};

/* ---------- Thiết lập & resize canvas ---------- */

App.resize = function resize(){
  const { canvas, ctx } = App.dom;
  const s = App.state;
  s.DPR = Math.min(window.devicePixelRatio || 1, 2);
  s.W = window.innerWidth;
  s.H = window.innerHeight;
  canvas.width = s.W * s.DPR;
  canvas.height = s.H * s.DPR;
  canvas.style.width = s.W + 'px';
  canvas.style.height = s.H + 'px';
  ctx.setTransform(s.DPR,0,0,s.DPR,0,0);
};
window.addEventListener('resize', App.resize);
App.resize();

App.state.mx = App.state.W/2; App.state.my = App.state.H/2;
App.state.prevMx = App.state.mx; App.state.prevMy = App.state.my;

/* ---------- Dữ liệu phi kiếm ---------- */

App.PALETTES = [
  { glow:'rgba(70,220,100,0.6)' },
  { glow:'rgba(50,200,80,0.55)' },
  { glow:'rgba(40,180,65,0.5)' }
];

App.STYLES = [
  { length: 160, width: 132, paletteIdx: 0 },
  { length: 135, width: 110, paletteIdx: 1 },
  { length: 110, width: 90,  paletteIdx: 2 }
];

App.TOTAL = 72;
App.swords = [];
(function initSwords(){
  const { W, H } = App.state;
  for (let i = 0; i < App.TOTAL; i++){
    const style = App.STYLES[i % App.STYLES.length];
    App.swords.push({
      style,
      x: Math.random()*W,
      y: Math.random()*H,
      vx: 0, vy: 0,
      angle: Math.random()*Math.PI*2,
      idleSpeed: 1.1 + Math.random()*1.6,
      seedA: Math.random()*1000,
      seedB: Math.random()*1000,
      seedC: Math.random()*1000,
      orbitRadius: 60 + Math.random()*Math.min(W, H)*0.42,
      orbitAngle0: Math.random()*Math.PI*2,
      orbitSpeed: (0.35 + Math.random()*0.55) * (Math.random() < 0.5 ? 1 : -1),
      radiusNoiseAmp: 18 + Math.random()*34,
      angleNoiseAmp: 0.35 + Math.random()*0.5,
      flicker: 0.6 + Math.random()*0.4,
      flingActive: false, flingDirX: 0, flingDirY: 0, flingSpeed: 0,
      frictionFactor: 0.945 + Math.random()*0.02,
      storeJitterR: 8 + Math.random()*14,
      storeJitterSeed: Math.random()*1000,
      stowed: false
    });
  }
  App.dom.swordCountEl.textContent = App.swords.length;
})();

function calcConcentric(i, tSec, cx, cy, minDim, count){
  const ring0N = Math.max(1, Math.round(count * 8/72));
  const ring1N = Math.max(1, Math.round(count * 24/72));
  const ring2N = Math.max(1, count - ring0N - ring1N);
  let ringIdx = i < ring0N ? 0 : (i < ring0N+ring1N ? 1 : 2);
  const within = ringIdx === 0 ? i : (ringIdx === 1 ? i-ring0N : i-ring0N-ring1N);
  const ringN = [ring0N, ring1N, ring2N][ringIdx];
  
  const radii = [0.22, 0.32, 0.44], speeds = [0.5, -0.3, 0.2];
  const angle = (within/ringN)*Math.PI*2 + tSec*speeds[ringIdx];
  const r = radii[ringIdx] * minDim + 30; 
  
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, facing: angle };
}
App.FORMATIONS = [{ name: 'Đồng Tâm', calc: calcConcentric }];

/* ---------- Hàm Vẽ Phi Kiếm Bằng Hình Ảnh kiem.png ---------- */
App.drawSword = function drawSword(x, y, angle, length, width, palette, alphaMul){
  if (!App.swordImgLoaded) return; 

  const ctx = App.dom.ctx;
  ctx.save();
  
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);

  ctx.globalAlpha = alphaMul;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 14; 

  ctx.drawImage(
    App.swordImg,
    -width / 2,
    -length * 0.22, 
    width,
    length
  );

  ctx.restore();
};

/* ---------- Hiệu ứng Phóng Sét ---------- */

App.lightnings = [];

App.spawnLightning = function spawnLightning(x, y, dirAngle){
  const segs = 4 + Math.floor(Math.random()*2);
  const points = [{x,y}];
  let curX = x, curY = y;
  const totalLen = 30 + Math.random()*44;
  const segLen = totalLen/segs;
  for (let k=0; k<segs; k++){
    const jitterAngle = dirAngle + (Math.random()-0.5)*0.9;
    curX += Math.cos(jitterAngle)*segLen;
    curY += Math.sin(jitterAngle)*segLen;
    points.push({x:curX, y:curY});
  }
  App.lightnings.push({ points, life: 9, maxLife: 9 });
};

App.drawLightnings = function drawLightnings(){
  const ctx = App.dom.ctx;
  const lightnings = App.lightnings;
  ctx.save();
  for (let i=lightnings.length-1; i>=0; i--){
    const l = lightnings[i];
    const a = l.life/l.maxLife;
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffe27a';
    ctx.shadowColor = 'rgba(255,220,110,0.9)';
    ctx.shadowBlur = 13;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    l.points.forEach((p, idx) => { if (idx===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.stroke();
    l.life--;
    if (l.life <= 0) lightnings.splice(i,1);
  }
  ctx.restore();
};

/* ---------- Đại Kiếm Bằng Hình Ảnh Khổng Lồ kiem.png ---------- */
App.updateAndDrawGreatSword = function updateAndDrawGreatSword(){
  const s = App.state;
  
  if (s.greatSwordActive) {
    if (s.greatSwordProgress < 1) s.greatSwordProgress += 0.05;
  } else {
    if (s.greatSwordProgress > 0) s.greatSwordProgress -= 0.05;
  }

  if (s.greatSwordProgress <= 0.001 || !App.swordImgLoaded) return;

  // Đo vận tốc dịch chuyển tức thời của tay phải/chuột ngự cự kiếm
  const moveSpeed = Math.hypot(s.mouseVelX, s.mouseVelY);
  
  // TỐI ƯU ĐỘ NHẠY (FIXED AUDIO): Hạ ngưỡng vận tốc từ 14 xuống 2.5 để camera bắt tiếng vung kiếm nhạy hơn
  if (s.greatSwordProgress > 0.9 && moveSpeed > 2.5) {
    if (typeof App.playGreatSwordSound === 'function') {
      App.playGreatSwordSound();
    }
  }

  const ctx = App.dom.ctx;
  ctx.save();
  
  ctx.translate(s.greatSwordX, s.greatSwordY);
  ctx.rotate(s.greatSwordAngle + Math.PI / 2);

  const p = s.greatSwordProgress;
  const len = 750 * p;
  const width = 560 * p;

  ctx.shadowColor = 'rgba(111,255,120,0.7)';
  ctx.shadowBlur = 70 * p;
  ctx.globalAlpha = p;

  ctx.drawImage(
    App.swordImg,
    -width / 2,
    -len * 0.78, 
    width,
    len
  );

  ctx.restore();
};

/* ---------- Hệ thống Quản lý Âm thanh Trận pháp (Audio Pool) ---------- */
App.audioPool = [];
App.poolSize = 10; 

for (let i = 0; i < App.poolSize; i++) {
  const audio = new Audio('sword_cut.mp3');
  audio.volume = 0.4; 
  App.audioPool.push(audio);
}

App.playCutSound = function playCutSound() {
  const availableAudio = App.audioPool.find(audio => audio.paused || audio.ended);
  if (availableAudio) {
    availableAudio.currentTime = 0; 
    availableAudio.play().catch(() => {}); 
  }
};

// ĐỐI TƯỢNG PHÁT ÂM THANH RIÊNG CHO ĐẠI KIẾM (FIXED GREATSWORD AUDIO)
App.greatSwordAudio = new Audio('sword_cut.mp3');
App.greatSwordAudio.volume = 0.85;       // Đẩy âm lượng cao hẳn để tạo độ uy lực khổng lồ
App.greatSwordAudio.playbackRate = 0.70; // Hạ tốc độ phát xuống để âm thanh rít trầm hùng, dày và nặng hơn

App.playGreatSwordSound = function playGreatSwordSound() {
  // Không kiểm tra trạng thái nữa, cứ vung tay đạt tốc độ là ép tua về đầu và chém ngay lập tức [suy luận]
  App.greatSwordAudio.currentTime = 0;
  App.greatSwordAudio.play().catch(() => {});
};