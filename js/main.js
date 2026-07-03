// main.js — Vòng lặp render chính, cập nhật vật lý & khởi động ứng dụng
window.App = window.App || {};

function frame(){
  const s = App.state;
  const { ctx, storeBtn } = App.dom;
  const { noise1D, clampMag } = App.utils;

  s.t += 1;
  const timeSec = s.t / 60;
  const W = s.W, H = s.H;

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(5,8,10,0.20)';
  ctx.fillRect(0, 0, W, H);

  if (s.leftAttackActive) {
    const rGlow = 45 + Math.sin(timeSec*8)*6;
    const g = ctx.createRadialGradient(s.leftAttackX, s.leftAttackY, 0, s.leftAttackX, s.leftAttackY, rGlow);
    g.addColorStop(0, 'rgba(235,90,70,0.45)');
    g.addColorStop(1, 'rgba(235,90,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.leftAttackX, s.leftAttackY, rGlow, 0, Math.PI*2);
    ctx.fill();
  }

  if (s.dragging){
    const rGlow = 30 + Math.sin(timeSec*4)*4;
    const g = ctx.createRadialGradient(s.mx, s.my, 0, s.mx, s.my, rGlow);
    g.addColorStop(0, 'rgba(111,191,95,0.45)');
    g.addColorStop(1, 'rgba(111,191,95,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.mx, s.my, rGlow, 0, Math.PI*2);
    ctx.fill();
  }

  const minDim = Math.min(W, H);
  const cx = W/2, cy = H/2;
  
  const pouchRect = storeBtn.getBoundingClientRect();
  const pouchX = pouchRect.left + pouchRect.width/2;
  const pouchY = pouchRect.top + pouchRect.height/2;

  // --- BỘ ĐIỀU PHỐI QUẢN LÝ TĂNG SỐ LƯỢNG KIẾM TUẦN TỰ ---
  if (s.activeCount < s.targetCount) {
    if (s.t % 3 === 0) {
      const BATCH = 4 + Math.floor(Math.random() * 2);
      let added = 0;
      let playSoundOnce = false;

      for (let i = s.activeCount; i < s.targetCount; i++) {
        const sw = App.swords[i];
        sw.stowed = false;
        sw.isUnstowing = true;
        sw.unstowTimer = 15 + Math.floor(Math.random() * 15);
        sw.x = pouchX; sw.y = pouchY;

        const randomAngle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
        const randomSpeed = 6 + Math.random() * 6;
        sw.vx = Math.cos(randomAngle) * randomSpeed;
        sw.vy = Math.sin(randomAngle) * randomSpeed;

        added++;
        playSoundOnce = true; 
        if (added >= BATCH) break;
      }
      
      if (playSoundOnce && typeof App.playCutSound === 'function') {
        App.playCutSound();
      }
      s.activeCount = Math.min(s.targetCount, s.activeCount + added);
    }
  }

  // --- BỘ ĐIỀU PHỐI XUẤT KIẾM TUẦN TỰ TỪ TÚI (KHI XUẤT TÚI CHUNG THƯỜNG) ---
  if (s.idleMode !== 'stored' && s.activeCount === s.targetCount) {
    if (s.t % 3 === 0) {
      let unstowedThisFrame = 0;
      const BATCH_SIZE = 4 + Math.floor(Math.random() * 2); 
      let playSoundOnce = false;

      for (let i = 0; i < s.activeCount; i++) {
        const sw = App.swords[i];
        if (sw.stowed) {
          sw.stowed = false;
          sw.isUnstowing = true; 
          sw.unstowTimer = 15 + Math.floor(Math.random() * 15); 
          
          sw.x = pouchX; sw.y = pouchY;
          
          const randomAngle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
          const randomSpeed = 6 + Math.random() * 6;
          sw.vx = Math.cos(randomAngle) * randomSpeed;
          sw.vy = Math.sin(randomAngle) * randomSpeed;

          unstowedThisFrame++;
          playSoundOnce = true;
          if (unstowedThisFrame >= BATCH_SIZE) break;
        }
      }
      
      if (playSoundOnce && typeof App.playCutSound === 'function') {
        App.playCutSound();
      }
    }
  }

  // --- BỘ ĐIỀU PHỐI TUẦN HOÀN KIẾM TRẬN ---
  if (s.leftAttackActive) {
    let currentlyCharging = 0;
    for (let i = 0; i < s.activeCount; i++) {
      if (App.swords[i].attackStatus === 1) currentlyCharging++;
    }

    const MAX_CHARGING = 4;
    if (s.t % 10 === 0 && currentlyCharging < MAX_CHARGING) {
      const readySwords = [];
      for (let i = 0; i < s.activeCount; i++) {
        const sw = App.swords[i];
        if (!sw.stowed && !sw.isUnstowing && (!sw.attackStatus || sw.attackStatus === 0)) {
          readySwords.push(sw);
        }
      }
      if (readySwords.length > 0) {
        const luckySword = readySwords[Math.floor(Math.random() * readySwords.length)];
        luckySword.attackStatus = 1; 
        luckySword.waveState = 0;
        
        const dx = s.leftAttackX - luckySword.x;
        const dy = s.leftAttackY - luckySword.y;
        luckySword.escapeSide = Math.atan2(dy, dx) + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
      }
    }
  } else {
    for (let i = 0; i < s.activeCount; i++) {
      if (App.swords[i].attackStatus && App.swords[i].attackStatus !== 0) {
        App.swords[i].attackStatus = 3; 
      }
    }
  }

  const loopCount = Math.max(s.activeCount, s.targetCount);

  // --- VÒNG LẶP XỬ LÝ VẬT LÝ VÀ ĐIỀU HƯỚNG TỪNG PHI KIẾM ---
  for (let i = 0; i < loopCount; i++){
    const sw = App.swords[i];
    if (sw.attackStatus === undefined) sw.attackStatus = 0;
    if (sw.stowed === undefined) sw.stowed = false;
    if (sw.isUnstowing === undefined) sw.isUnstowing = false;

    let desiredX, desiredY, maxSpeed, maxForce;
    let formationFacing = null;

    // ƯU TIÊN 1: Đại Kiếm tụ hình
    if (s.greatSwordProgress > 0.001) {
      sw.attackStatus = 0;
      sw.isUnstowing = false;
      const dx = s.greatSwordX - sw.x;
      const dy = s.greatSwordY - sw.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pullForce = 0.25 + s.greatSwordProgress * 0.45; 
      desiredX = (dx / dist) * 12;
      desiredY = (dy / dist) * 12;
      maxSpeed = 14;
      maxForce = pullForce;
    } 
    // ƯU TIÊN 2: Ép phi kiếm thừa lượn về túi ngay lập tức khi giảm số lượng trận pháp
    else if (i >= s.targetCount) {
      sw.attackStatus = 0;
      sw.isUnstowing = false;

      const dx = pouchX - sw.x;
      const dy = pouchY - sw.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < 25) {
        sw.stowed = true;
        if (i === s.activeCount - 1) {
          s.activeCount--; 
        }
      }
      desiredX = (dx / dist) * 14;
      desiredY = (dy / dist) * 14;
      maxSpeed = 14; maxForce = 0.85;
    }
    // ƯU TIÊN 3: Đang trong quá trình bung xả tuần tự từ túi ra ngoài
    else if (sw.isUnstowing && s.idleMode !== 'stored') {
      desiredX = sw.vx;
      desiredY = sw.vy;
      maxSpeed = 14;
      maxForce = 0.1; 

      sw.unstowTimer--;
      if (sw.unstowTimer <= 0) {
        sw.isUnstowing = false; 
      }
    }
    // ƯU TIÊN 4: Chu kỳ tấn công tuần hoàn
    else if (s.leftAttackActive && sw.attackStatus > 0) {
      sw.flingActive = false;

      if (sw.attackStatus === 1) {
        const dx = s.leftAttackX - sw.x;
        const dy = s.leftAttackY - sw.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < 40) {
          sw.attackStatus = 2;
          sw.escapeTargetX = s.leftAttackX + Math.cos(sw.escapeSide) * (minDim * 0.5);
          sw.escapeTargetY = s.leftAttackY + Math.sin(sw.escapeSide) * (minDim * 0.5);
          desiredX = sw.vx; desiredY = sw.vy;
          maxSpeed = 16; maxForce = 1.3;

          if (typeof App.playCutSound === 'function') {
            App.playCutSound();
          }
        } else {
          desiredX = (dx / dist) * 16;
          desiredY = (dy / dist) * 16;
          maxSpeed = 16; maxForce = 0.95;
        }
      } 
      else if (sw.attackStatus === 2) {
        const dx = sw.escapeTargetX - sw.x;
        const dy = sw.escapeTargetY - sw.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < 50) {
          sw.attackStatus = 3;
        }
        desiredX = (dx / dist) * 13;
        desiredY = (dy / dist) * 13;
        maxSpeed = 13; maxForce = 0.85;
      }
      else if (sw.attackStatus === 3) {
        const f = App.FORMATIONS[s.formationIndex].calc(i, timeSec, cx, cy, minDim, s.activeCount);
        const dx = f.x - sw.x;
        const dy = f.y - sw.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < 25) {
          sw.attackStatus = 0;
        }
        desiredX = (dx / dist) * 11;
        desiredY = (dy / dist) * 11;
        maxSpeed = 11; maxForce = 0.7;
        formationFacing = f.facing;
      }

      if (s.lightningOn && Math.random() < 0.12) {
        App.spawnLightning(sw.x, sw.y, sw.angle);
      }
    } 
    // TRẠNG THÁI KHÁC: di chuyển tự do, ngự kiếm, thu túi trữ vật, trận pháp thông thường...
    else {
      if (s.dragging){
        sw.attackStatus = 0;
        sw.flingActive = false;
        const orbitAngle = sw.orbitAngle0 + timeSec * sw.orbitSpeed * 1.7 + noise1D(timeSec*0.9, sw.seedB) * sw.angleNoiseAmp;
        const radius = Math.max(24, sw.orbitRadius*0.5 + noise1D(timeSec*0.5, sw.seedA) * sw.radiusNoiseAmp);
        const targetX = s.mx + Math.cos(orbitAngle) * radius;
        const targetY = s.my + Math.sin(orbitAngle) * radius;
        let dX = (targetX - sw.x) * 0.14, dY = (targetY - sw.y) * 0.14;
        [dX, dY] = clampMag(dX, dY, 8.5);
        desiredX = dX; desiredY = dY;
        maxSpeed = 8.5; maxForce = 0.9;
      } else if (sw.flingActive){
        sw.attackStatus = 0;
        desiredX = sw.flingDirX * sw.flingSpeed;
        desiredY = sw.flingDirY * sw.flingSpeed;
        maxSpeed = sw.flingSpeed; maxForce = 0.6;
        sw.flingSpeed *= sw.frictionFactor;
        if (sw.flingSpeed < 1.2) sw.flingActive = false;
      } 
      else if (s.idleMode === 'stored'){
        sw.attackStatus = 0;
        sw.isUnstowing = false;
        
        const dx = pouchX - sw.x;
        const dy = pouchY - sw.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < 25) {
          sw.stowed = true;
        }

        desiredX = (dx / dist) * 15;
        desiredY = (dy / dist) * 15;
        maxSpeed = 15; 
        maxForce = 0.9;
      } 
      else if (s.idleMode === 'formation' || s.leftAttackActive) {
        const f = App.FORMATIONS[s.formationIndex].calc(i, timeSec, cx, cy, minDim, s.activeCount);
        let dX = (f.x - sw.x) * 0.13, dY = (f.y - sw.y) * 0.13;
        [dX, dY] = clampMag(dX, dY, 6.2);
        desiredX = dX; desiredY = dY;
        maxSpeed = 6.2; maxForce = 0.42;
        formationFacing = f.facing;
      } else {
        const margin = 60;
        const wanderAngle = sw.orbitAngle0 + noise1D(timeSec*0.12, sw.seedA) * 3.2;
        let idleDX = Math.cos(wanderAngle) * sw.idleSpeed;
        let idleDY = Math.sin(wanderAngle) * sw.idleSpeed;
        if (sw.x < margin) idleDX += (margin - sw.x) * 0.02;
        if (sw.x > W - margin) idleDX -= (sw.x - (W - margin)) * 0.02;
        if (sw.y < margin) idleDY += (margin - sw.y) * 0.02;
        if (sw.y > H - margin) idleDY -= (sw.y - (H - margin)) * 0.02;
        desiredX = idleDX; desiredY = idleDY;
        maxSpeed = 3.4; maxForce = 0.22;
      }
    }

    let steerX = desiredX - sw.vx, steerY = desiredY - sw.vy;
    [steerX, steerY] = clampMag(steerX, steerY, maxForce);
    sw.vx += steerX; sw.vy += steerY;
    [sw.vx, sw.vy] = clampMag(sw.vx, sw.vy, maxSpeed);

    sw.x += sw.vx; sw.y += sw.vy;
    if (sw.x < -40) sw.x = -40; if (sw.x > W+40) sw.x = W+40;
    if (sw.y < -40) sw.y = -40; if (sw.y > H+40) sw.y = H+40;

    if (formationFacing !== null){ 
      let diff = formationFacing - sw.angle;
      while (diff > Math.PI) diff -= Math.PI*2;
      while (diff < -Math.PI) diff += Math.PI*2;
      sw.angle += diff * 0.25;
    } else {
      const speedMag = Math.hypot(sw.vx, sw.vy);
      if (speedMag > 0.05){
        const targetFacing = Math.atan2(sw.vy, sw.vx);
        let diff = targetFacing - sw.angle;
        while (diff > Math.PI) diff -= Math.PI*2;
        while (diff < -Math.PI) diff += Math.PI*2;
        sw.angle += diff * 0.25;
      }
    }

    // Chỉ cần phi kiếm nằm trong túi (stowed === true) là tàng hình ngay lập tức
    const isHidden = sw.stowed; 
    if (!isHidden){
      const palette = App.PALETTES[sw.style.paletteIdx];
      const flicker = sw.flicker + Math.sin(timeSec*3 + i)*0.08;
      const lenMul = s.dragging ? 1.1 : 1;
      
      const visibilityAlpha = Math.max(0, 1 - s.greatSwordProgress);
      const alphaNow = Math.min(1, flicker) * visibilityAlpha;

      if (alphaNow > 0.01) {
        if (s.illusionOn){
          for (let k = 0; k < 2; k++){
            const side = k === 0 ? 1 : -1;
            const phase = timeSec*1.5 + sw.seedC*0.01 + k*2.4;
            const dist = 16 + Math.sin(phase)*7;
            const perpAngle = sw.angle + (Math.PI/2)*side;
            const ix = sw.x + Math.cos(perpAngle)*dist;
            const iy = sw.y + Math.sin(perpAngle)*dist;
            const iAngle = sw.angle + Math.sin(phase*0.8)*0.2;
            App.drawSword(ix, iy, iAngle, sw.style.length * lenMul, sw.style.width, palette, alphaNow * 0.32);
          }
        }
        App.drawSword(sw.x, sw.y, sw.angle, sw.style.length * lenMul, sw.style.width, palette, alphaNow);
      }
    }
  }

  if (s.lightningOn && Math.random() < 0.08 && s.activeCount > 0 && !s.leftAttackActive && s.idleMode !== 'formation'){
    const sw = App.swords[Math.floor(Math.random() * s.activeCount)];
    App.spawnLightning(sw.x, sw.y, sw.angle);
  }

  App.drawLightnings();
  App.updateAndDrawGreatSword();

  requestAnimationFrame(frame);
}

App.updateStateTag();
requestAnimationFrame(frame);