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

/* ---------- Dữ liệu & vẽ phi kiếm (Theo mẫu ảnh thanh trúc kiếm lục) ---------- */

App.PALETTES = [
  { core:'#b4f099', edge:'#235c2e', vein:'#143d1d', guard:'#f3c04d', glow:'rgba(70,220,100,0.6)' },
  { core:'#a3eb83', edge:'#1b4d24', vein:'#0f3015', guard:'#e0b23f', glow:'rgba(50,200,80,0.55)' },
  { core:'#8fdf6c', edge:'#123a1a', vein:'#0a210e', guard:'#c99a34', glow:'rgba(40,180,65,0.5)' }
];
App.STYLES = [
  { length: 55, width: 3.6, paletteIdx: 0 },
  { length: 48, width: 3.0, paletteIdx: 1 },
  { length: 40, width: 2.4, paletteIdx: 2 }
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
  const radii = [0.12,0.22,0.34], speeds = [0.5,-0.3,0.2];
  const angle = (within/ringN)*Math.PI*2 + tSec*speeds[ringIdx];
  const r = radii[ringIdx]*minDim;
  return { x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r, facing: angle };
}
App.FORMATIONS = [{ name: 'Đồng Tâm', calc: calcConcentric }];

// Hàm vẽ kiếm được tinh chỉnh theo ảnh image_4fbba2.jpg (cán ngắn, xanh trúc)
App.drawSword = function drawSword(x, y, angle, length, width, palette, alphaMul){
  const ctx = App.dom.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const bladeBase = 0;
  const tipX = length * 0.82;

  // 1. Vẽ lưỡi kiếm màu xanh trúc gờ nổi
  const grad = ctx.createLinearGradient(bladeBase, 0, tipX, 0);
  grad.addColorStop(0, palette.edge);
  grad.addColorStop(0.3, palette.core);
  grad.addColorStop(0.7, palette.core);
  grad.addColorStop(1, palette.edge);

  ctx.globalAlpha = alphaMul;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(tipX, 0);
  ctx.lineTo(bladeBase, -width * 0.5);
  ctx.lineTo(bladeBase, width * 0.5);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Các gờ phân đốt giả lập đốt trúc dọc thân kiếm
  ctx.globalAlpha = alphaMul * 0.4;
  ctx.strokeStyle = palette.vein;
  ctx.lineWidth = 0.8;
  for (let d = 1; d <= 4; d++) {
    const dotX = bladeBase + (tipX - bladeBase) * (d * 0.2);
    ctx.beginPath();
    ctx.moveTo(dotX, -width * 0.4);
    ctx.lineTo(dotX, width * 0.4);
    ctx.stroke();
  }

  // Gờ trục chính giữa thanh kiếm
  ctx.globalAlpha = alphaMul * 0.7;
  ctx.beginPath();
  ctx.moveTo(tipX - length * 0.05, 0);
  ctx.lineTo(bladeBase, 0);
  ctx.stroke();

  // 2. Vẽ Hộ Thủ (Vàng Gold - Dẹt bầu dục theo hình mẫu)
  ctx.globalAlpha = alphaMul;
  ctx.fillStyle = palette.guard;
  ctx.beginPath();
  ctx.ellipse(bladeBase, 0, width * 0.4, width * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 3. Vẽ Cán Kiếm NGẮN (Đã sửa ngắn lại đáng kể cho đẹp và giống hình)
  const gripLen = length * 0.16; 
  const gripWidth = width * 0.45;
  ctx.globalAlpha = alphaMul * 0.95;
  ctx.fillStyle = palette.edge;
  ctx.fillRect(bladeBase - gripLen, -gripWidth * 0.5, gripLen, gripWidth);

  // Đốc kiếm nhỏ phía sau cán
  ctx.fillStyle = palette.guard;
  ctx.beginPath();
  ctx.arc(bladeBase - gripLen, 0, gripWidth * 0.6, 0, Math.PI * 2);
  ctx.fill();

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

/* ---------- Đại Kiếm (Hội tụ / tách mượt mà theo tiến trình) ---------- */

App.updateAndDrawGreatSword = function updateAndDrawGreatSword(){
  const s = App.state;
  
  // Cập nhật tiến trình tích tụ (progress) mượt mà
  if (s.greatSwordActive) {
    if (s.greatSwordProgress < 1) s.greatSwordProgress += 0.05; // Hội tụ vào
  } else {
    if (s.greatSwordProgress > 0) s.greatSwordProgress -= 0.05; // Rã trận ra
  }

  if (s.greatSwordProgress <= 0.001) return;

  const ctx = App.dom.ctx;
  ctx.save();
  ctx.translate(s.greatSwordX, s.greatSwordY);
  ctx.rotate(s.greatSwordAngle);

  // Kích thước Đại Kiếm biến đổi mượt mà dựa trên progress thay vì đột ngột xuất hiện
  const p = s.greatSwordProgress;
  const len = 250 * p;
  const width = 12 * p;

  ctx.shadowColor = 'rgba(111,255,120,0.7)';
  ctx.shadowBlur = 40 * p;
  ctx.globalAlpha = p;

  const bladeBase = 0;
  const tipX = len * 0.85;

  // Vẽ lưỡi Đại Kiếm xanh trúc theo phong cách đồng bộ ảnh mẫu
  const grad = ctx.createLinearGradient(bladeBase, 0, tipX, 0);
  grad.addColorStop(0, '#103317');
  grad.addColorStop(0.3, '#a1eb81');
  grad.addColorStop(0.7, '#ffffff');
  grad.addColorStop(1, '#1b4d24');

  ctx.beginPath();
  ctx.moveTo(tipX, 0);
  ctx.lineTo(bladeBase, -width * 0.5);
  ctx.lineTo(bladeBase, width * 0.5);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Vẽ gờ trúc trên trục Đại Kiếm
  ctx.strokeStyle = '#143d1d';
  ctx.lineWidth = 2 * p;
  for (let d = 1; d <= 5; d++) {
    const dotX = bladeBase + (tipX - bladeBase) * (d * 0.16);
    ctx.beginPath();
    ctx.moveTo(dotX, -width * 0.4);
    ctx.lineTo(dotX, width * 0.4);
    ctx.stroke();
  }

  // Vân kiếm vàng dọc xương sống
  ctx.strokeStyle = '#f3c04d';
  ctx.lineWidth = 1.5 * p;
  ctx.beginPath();
  ctx.moveTo(tipX - len * 0.05, 0);
  ctx.lineTo(bladeBase, 0);
  ctx.stroke();

  // Hộ thủ Đại Kiếm vàng dẹt giống hình mẫu
  ctx.fillStyle = '#f3c04d';
  ctx.beginPath();
  ctx.ellipse(bladeBase, 0, width * 0.4, width * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cán Đại Kiếm ngắn cân đối
  const gripLen = len * 0.18;
  const gripWidth = width * 0.45;
  ctx.fillStyle = '#103317';
  ctx.fillRect(bladeBase - gripLen, -gripWidth * 0.5, gripLen, gripWidth);

  // Đốc Đại Kiếm
  ctx.fillStyle = '#f3c04d';
  ctx.beginPath();
  ctx.arc(bladeBase - gripLen, 0, gripWidth * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};