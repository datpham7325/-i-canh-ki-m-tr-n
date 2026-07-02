// input.js — Toàn bộ nguồn điều khiển: chuột/chạm, nút bấm UI,
// và nhận diện cử chỉ tay qua camera (MediaPipe).
window.App = window.App || {};

const { canvas, stateTag, storeBtn, changeFormBtn, countBtn, illusionBtn, lightningBtn,
        handBtn, handPanel, handVideo, handOverlay, handOverlayCtx, handStatus } = App.dom;

/* ---------- Trạng thái & chuyển chế độ dùng chung ---------- */

App.resetModeButtons = function resetModeButtons(){
  storeBtn.classList.remove('active'); storeBtn.textContent = '🎒 Túi Trữ Vật';
  changeFormBtn.classList.remove('active');
};

App.updateStateTag = function updateStateTag(){
  const s = App.state;
  if (s.leftAttackActive) {
    stateTag.textContent = 'TUẦN HOÀN KIẾM TRẬN'; stateTag.classList.add('active');
  } else if (s.dragging) {
    stateTag.textContent = 'NGỰ KIẾM'; stateTag.classList.add('active');
  } else {
    stateTag.classList.remove('active');
    stateTag.textContent = s.idleMode === 'stored' ? 'NHẬP TÚI' : (s.idleMode === 'formation' ? 'ĐỒNG TÂM' : 'TỰ DO');
  }
};

App.enterFormation = function enterFormation(){
  const s = App.state;
  s.idleMode = 'formation';
  storeBtn.classList.remove('active'); storeBtn.textContent = '🎒 Túi Trữ Vật';
  App.swords.forEach(sw => { sw.stowed = false; });
  changeFormBtn.classList.add('active');
  App.updateStateTag();
};
App.enterStored = function enterStored(){
  const s = App.state;
  s.idleMode = 'stored';
  App.swords.forEach(sw => { sw.stowed = false; });
  App.resetModeButtons();
  storeBtn.classList.add('active');
  storeBtn.textContent = '🎒 Xuất Kiếm';
  App.updateStateTag();
};

/* ---------- Chuột / chạm ---------- */

App.pointerDown = function pointerDown(x, y){
  const s = App.state;
  s.dragging = true; s.mx = s.prevMx = x; s.my = s.prevMy = y; s.mouseVelX = s.mouseVelY = 0;
  App.updateStateTag();
};
App.pointerMove = function pointerMove(x, y){
  const s = App.state;
  if (s.dragging){
    s.mouseVelX = App.utils.lerp(s.mouseVelX, x - s.prevMx, 0.5);
    s.mouseVelY = App.utils.lerp(s.mouseVelY, y - s.prevMy, 0.5);
    s.prevMx = s.mx; s.prevMy = s.my;
  }
  s.mx = x; s.my = y;
};
App.pointerUp = function pointerUp(){
  const s = App.state;
  if (s.dragging && s.idleMode === 'free'){
    const spd = Math.hypot(s.mouseVelX, s.mouseVelY);
    if (spd > 0.4){
      const dirX = s.mouseVelX/spd, dirY = s.mouseVelY/spd;
      const boostMag = Math.min(16, 5.5 + spd*0.75);
      App.swords.slice(0, s.activeCount).forEach(sw => {
        const jitter = (Math.random()-0.5)*0.6;
        const ca = Math.cos(jitter), sa = Math.sin(jitter);
        sw.flingDirX = dirX*ca - dirY*sa;
        sw.flingDirY = dirX*sa + dirY*ca;
        sw.flingSpeed = boostMag * (0.75 + Math.random()*0.5);
        sw.flingActive = true;
      });
    }
  }
  s.dragging = false;
  App.updateStateTag();
};

canvas.addEventListener('mousedown', e => App.pointerDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => App.pointerMove(e.clientX, e.clientY));
window.addEventListener('mouseup', App.pointerUp);

canvas.addEventListener('touchstart', e => { const touch = e.touches[0]; App.pointerDown(touch.clientX, touch.clientY); e.preventDefault(); }, { passive:false });
canvas.addEventListener('touchmove', e => { const touch = e.touches[0]; App.pointerMove(touch.clientX, touch.clientY); e.preventDefault(); }, { passive:false });
window.addEventListener('touchend', App.pointerUp);
window.addEventListener('touchcancel', App.pointerUp);

/* ---------- Nút bấm UI ---------- */

storeBtn.addEventListener('click', () => {
  const s = App.state;
  if (s.idleMode === 'stored'){
    s.idleMode = 'free';
    App.swords.forEach(sw => { sw.stowed = false; });
    App.resetModeButtons();
  } else {
    s.idleMode = 'stored';
    App.swords.forEach(sw => { sw.stowed = false; });
    App.resetModeButtons();
    storeBtn.classList.add('active');
    storeBtn.textContent = '🎒 Xuất Kiếm';
  }
  App.updateStateTag();
});

changeFormBtn.addEventListener('click', () => {
  const s = App.state;
  if (s.idleMode === 'formation'){
    s.idleMode = 'free';
    changeFormBtn.classList.remove('active');
  } else {
    s.idleMode = 'formation';
    storeBtn.classList.remove('active'); storeBtn.textContent = '🎒 Túi Trữ Vật';
    App.swords.forEach(sw => { sw.stowed = false; });
    changeFormBtn.classList.add('active');
  }
  App.updateStateTag();
});

countBtn.addEventListener('click', () => {
  const s = App.state;
  s.countIndex = (s.countIndex + 1) % s.COUNT_MODES.length;
  s.activeCount = s.COUNT_MODES[s.countIndex];
  App.dom.swordCountEl.textContent = s.activeCount;
  countBtn.textContent = '⚔ ' + s.activeCount + ' Kiếm';
});

illusionBtn.addEventListener('click', () => {
  const s = App.state;
  s.illusionOn = !s.illusionOn;
  illusionBtn.classList.toggle('active', s.illusionOn);
});

lightningBtn.addEventListener('click', () => {
  const s = App.state;
  s.lightningOn = !s.lightningOn;
  lightningBtn.classList.toggle('active', s.lightningOn);
});

/* ---------- Nhận diện tay qua camera (MediaPipe) ---------- */

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

let handLandmarker = null;
let handStream = null;
let handTrackingOn = false;
let handRAFId = null;
let lastGestureRight = 'none';
let lastGestureLeft = 'none';
let pointingActive = false;

// Trạng thái bổ sung cho kỹ năng tay trái
App.state.leftAttackActive = false;
App.state.leftAttackX = 0;
App.state.leftAttackY = 0;

function handDist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function fingerExtended(lm, tipI, pipI, mcpI){
  const wrist = lm[0];
  return handDist(wrist, lm[tipI]) > handDist(wrist, lm[pipI]) * 1.08 && handDist(wrist, lm[tipI]) > handDist(wrist, lm[mcpI]) * 1.18;
}

function detectGesture(lm){
  const idx = fingerExtended(lm, 8, 6, 5);
  const mid = fingerExtended(lm, 12, 10, 9);
  const ring = fingerExtended(lm, 16, 14, 13);
  const pinky = fingerExtended(lm, 20, 18, 17);
  if (idx && mid && !ring && !pinky) return 'point';
  if (idx && mid && ring && !pinky) return 'three';
  if (idx && mid && ring && pinky) return 'palm';
  if (!idx && !mid && !ring && !pinky) return 'fist';
  return 'none';
}

function drawHandSkeleton(lm){
  const w = handOverlay.width, h = handOverlay.height;
  handOverlayCtx.lineWidth = 2;
  handOverlayCtx.strokeStyle = 'rgba(227,180,74,0.9)';
  handOverlayCtx.shadowColor = 'rgba(111,191,95,0.6)';
  handOverlayCtx.shadowBlur = 4;
  handOverlayCtx.beginPath();
  HAND_CONNECTIONS.forEach(([a, b]) => {
    const pa = lm[a], pb = lm[b];
    handOverlayCtx.moveTo(pa.x * w, pa.y * h);
    handOverlayCtx.lineTo(pb.x * w, pb.y * h);
  });
  handOverlayCtx.stroke();
  handOverlayCtx.shadowBlur = 0;
  handOverlayCtx.fillStyle = 'rgba(205,238,176,0.95)';
  lm.forEach(p => {
    handOverlayCtx.beginPath();
    handOverlayCtx.arc(p.x * w, p.y * h, 2.4, 0, Math.PI*2);
    handOverlayCtx.fill();
  });
}

async function initHandLandmarker(){
  const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 2
  });
}

function handLoop(){
  if (!handTrackingOn) return;
  handRAFId = requestAnimationFrame(handLoop);
  if (handVideo.readyState < 2) return;

  if (handOverlay.width !== handVideo.videoWidth && handVideo.videoWidth){
    handOverlay.width = handVideo.videoWidth;
    handOverlay.height = handVideo.videoHeight;
  }

  let result;
  try{
    result = handLandmarker.detectForVideo(handVideo, performance.now());
  } catch(err){ return; }

  handOverlayCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);

  const s = App.state;
  const W = s.W, H = s.H;

  if (result && result.landmarks && result.landmarks.length > 0){
    let rightHand = null, leftHand = null;
    let rightGesture = 'none', leftGesture = 'none';

    for (let h = 0; h < result.landmarks.length; h++) {
      const lm = result.landmarks[h];
      const handedness = result.handednesses[h][0].categoryName || 'Unknown';
      const isLeft = handedness.toLowerCase().includes('left');

      drawHandSkeleton(lm);
      const gesture = detectGesture(lm);

      if (isLeft){ leftHand = lm; leftGesture = gesture; }
      else { rightHand = lm; rightGesture = gesture; }
    }

    // --- Xử lý tay phải làm tiêu điểm và đo góc xoay cầm kiếm ---
    if (rightHand) {
      const useTip = rightGesture === 'point';
      const nx = useTip ? (rightHand[8].x + rightHand[12].x) / 2 : rightHand[9].x;
      const ny = useTip ? (rightHand[8].y + rightHand[12].y) / 2 : rightHand[9].y;
      
      s.mx = (1 - nx) * W;
      s.my = ny * H;

      // Đo góc xoay từ cổ tay lên khớp ngón giữa của tay phải [suy luận]
      const dxH = (1 - rightHand[9].x) * W - (1 - rightHand[0].x) * W;
      const dyH = rightHand[9].y * H - rightHand[0].y * H;
      s.rightHandAngle = Math.atan2(dyH, dxH);

      if (rightGesture === 'point'){
        if (!pointingActive){ App.pointerDown(s.mx, s.my); pointingActive = true; }
        else App.pointerMove(s.mx, s.my);
      } else if (pointingActive){
        App.pointerUp();
        pointingActive = false;
      }
    } else if (pointingActive) {
      App.pointerUp();
      pointingActive = false;
    }

    // --- Xử lý tay trái (2 ngón tấn công, 5 ngón bật/tắt sét, 3 ngón huyễn hóa) ---
    if (leftHand) {
      if (leftGesture === 'point') {
        s.leftAttackActive = true;
        const lx = (leftHand[8].x + leftHand[12].x) / 2;
        const ly = (leftHand[8].y + leftHand[12].y) / 2;
        s.leftAttackX = (1 - lx) * W;
        s.leftAttackY = ly * H;
      } else {
        s.leftAttackActive = false;
      }

      if (leftGesture === 'palm' && lastGestureLeft !== 'palm') {
        s.lightningOn = !s.lightningOn;
        lightningBtn.classList.toggle('active', s.lightningOn);
      }
      
      if (leftGesture === 'three' && lastGestureLeft !== 'three') {
        s.illusionOn = !s.illusionOn;
        illusionBtn.classList.toggle('active', s.illusionOn);
      }

      lastGestureLeft = leftGesture;
    } else {
      s.leftAttackActive = false;
      lastGestureLeft = 'none';
    }

    // --- Cơ chế tạo Đại Kiếm: Cả 2 tay nắm chặt (fist) ---
    const bothFists = (leftGesture === 'fist' && rightGesture === 'fist');

    if (bothFists) {
      if (!s.greatSwordActive) s.greatSwordActive = true;
      if (rightHand) {
        // Khóa chặt Đại Kiếm vào tọa độ và hướng vung của tay phải [suy luận]
        s.greatSwordX = s.mx;
        s.greatSwordY = s.my;
        s.greatSwordAngle = s.rightHandAngle; 
      }
    } else {
      if (s.greatSwordActive) s.greatSwordActive = false;
      if (rightGesture !== lastGestureRight) {
        if (rightGesture === 'palm') App.enterFormation();
        else if (rightGesture === 'fist') App.enterStored();
        lastGestureRight = rightGesture;
      }
    }

    if (bothFists) {
      handStatus.textContent = '🗡️ ĐẠI KIẾM - Tay phải ngự cầm, vung chém tự do!';
    } else if (s.leftAttackActive) {
      handStatus.textContent = '🔄 KIẾM TRẬN TUẦN HOÀN - Trái -> Phải -> Trái liên hồi!';
    } else {
      handStatus.textContent = '🖐 Đang nhận diện...';
    }
  } else {
    if (pointingActive){ App.pointerUp(); pointingActive = false; }
    lastGestureRight = 'none';
    lastGestureLeft = 'none';
    s.leftAttackActive = false;
    if (s.greatSwordActive) s.greatSwordActive = false;
    handStatus.textContent = 'Không thấy tay trong khung hình';
  }
  App.updateStateTag();
}

async function startHandTracking(){
  handStatus.textContent = 'Đang khởi động camera...';
  handPanel.classList.add('show');
  handBtn.classList.add('active');
  handBtn.textContent = '📷 Tắt Camera';
  try{
    if (!handLandmarker) await initHandLandmarker();
    handStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
    handVideo.srcObject = handStream;
    await handVideo.play();
    handTrackingOn = true;
    handStatus.textContent = 'Sẵn sàng — nắm 2 tay để tạo Đại Kiếm';
    handLoop();
  } catch(err){
    handStatus.textContent = 'Không mở được camera';
    handTrackingOn = false;
    handBtn.classList.remove('active');
    handBtn.textContent = '📷 Ngự Kiếm (Camera)';
  }
}

function stopHandTracking(){
  handTrackingOn = false;
  handBtn.classList.remove('active');
  handBtn.textContent = '📷 Ngự Kiếm (Camera)';
  handPanel.classList.remove('show');
  if (handRAFId) cancelAnimationFrame(handRAFId);
  if (handStream){ handStream.getTracks().forEach(tr => tr.stop()); handStream = null; }
  handVideo.srcObject = null;
  if (pointingActive){ App.pointerUp(); pointingActive = false; }
  App.state.leftAttackActive = false;
}

handBtn.addEventListener('click', () => {
  if (handTrackingOn) stopHandTracking(); else startHandTracking();
});