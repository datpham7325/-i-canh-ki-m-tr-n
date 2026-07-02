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

  for (let i = 0; i < s.activeCount; i++){
    const sw = App.swords[i];
    let desiredX, desiredY, maxSpeed, maxForce;
    let formationFacing = null;

    if (s.greatSwordProgress > 0.001) {
      const dx = s.greatSwordX - sw.x;
      const dy = s.greatSwordY - sw.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pullForce = 0.25 + s.greatSwordProgress * 0.45; 
      desiredX = (dx / dist) * 12;
      desiredY = (dy / dist) * 12;
      maxSpeed = 14;
      maxForce = pullForce;
    } 
    // Luồng xử lý kỹ năng tuần hoàn liên tục (Tay trái -> Tản cuộn tay phải -> Tay trái) [suy luận]
    else if (s.leftAttackActive) {
      sw.flingActive = false;
      if (sw.waveState === undefined) sw.waveState = 0;

      if (sw.waveState === 0) {
        const dxToLeft = s.leftAttackX - sw.x;
        const dyToLeft = s.leftAttackY - sw.y;
        const distToLeft = Math.hypot(dxToLeft, dyToLeft) || 1;

        if (distToLeft < 45) {
          // Giai đoạn 1: Chạm tay trái -> Đổi pha, kích hoạt phản lực hướng về tay phải [suy luận]
          sw.waveState = 1;
          const randomAngle = Math.atan2(dyToLeft, dxToLeft) + (Math.random() - 0.5) * 1.5;
          sw.vx = Math.cos(randomAngle) * 15;
          sw.vy = Math.sin(randomAngle) * 15;
          desiredX = sw.vx; desiredY = sw.vy;
          maxSpeed = 16; maxForce = 1.3;
        } else {
          desiredX = (dxToLeft / distToLeft) * 14;
          desiredY = (dyToLeft / distToLeft) * 14;
          maxSpeed = 14; maxForce = 0.85;
        }
      } else {
        const dxToRight = s.mx - sw.x;
        const dyToRight = s.my - sw.y;
        const distToRight = Math.hypot(dxToRight, dyToRight) || 1;

        if (distToRight < 55) {
          // Giai đoạn 2: Quay về tay phải -> Đổi pha, nạp động năng phóng lại tay trái [suy luận]
          sw.waveState = 0;
          desiredX = (s.leftAttackX - sw.x);
          desiredY = (s.leftAttackY - sw.y);
          maxSpeed = 15; maxForce = 1.2;
        } else {
          desiredX = (dxToRight / distToRight) * 14;
          desiredY = (dyToRight / distToRight) * 14;
          maxSpeed = 14; maxForce = 0.85;
        }
      }

      if (s.lightningOn && Math.random() < 0.12) {
        App.spawnLightning(sw.x, sw.y, sw.angle);
      }
    } else {
      if (sw.waveState !== undefined) sw.waveState = 0;

      if (s.dragging){
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
        desiredX = sw.flingDirX * sw.flingSpeed;
        desiredY = sw.flingDirY * sw.flingSpeed;
        maxSpeed = sw.flingSpeed;
        maxForce = 0.6;
        sw.flingSpeed *= sw.frictionFactor;
        if (sw.flingSpeed < 1.2) sw.flingActive = false;
      } else if (s.idleMode === 'stored'){
        const jx = Math.cos(timeSec*0.8 + sw.storeJitterSeed) * sw.storeJitterR;
        const jy = Math.sin(timeSec*0.9 + sw.storeJitterSeed*1.3) * sw.storeJitterR;
        const targetX = pouchX + jx, targetY = pouchY + jy;
        let dX = (targetX - sw.x) * 0.16, dY = (targetY - sw.y) * 0.16;
        [dX, dY] = clampMag(dX, dY, 5.5);
        desiredX = dX; desiredY = dY;
        maxSpeed = 5.5; maxForce = 0.5;
      } 
      // Chế độ Trận Đồng Tâm kết hợp đột kích ngẫu nhiên [suy luận]
      else if (s.idleMode === 'formation'){
        const f = App.FORMATIONS[s.formationIndex].calc(i, timeSec, cx, cy, minDim, s.activeCount);

        if (sw.isRogue === undefined) { sw.isRogue = false; sw.rogueTargetX = 0; sw.rogueTargetY = 0; sw.rogueTimer = 0; }

        // Tỉ lệ xác suất nhỏ để một thanh bứt khỏi hàng ngũ phóng ra ngoài đột kích [suy luận]
        if (!sw.isRogue && Math.random() < 0.0012) { 
          sw.isRogue = true;
          sw.rogueTimer = 75 + Math.floor(Math.random() * 60);
          const randomAngle = Math.random() * Math.PI * 2;
          const targetDist = minDim * (0.45 + Math.random() * 0.35);
          sw.rogueTargetX = cx + Math.cos(randomAngle) * targetDist;
          sw.rogueTargetY = cy + Math.sin(randomAngle) * targetDist;

          if (s.lightningOn && Math.random() < 0.4) {
            App.spawnLightning(sw.x, sw.y, randomAngle);
          }
        }

        if (sw.isRogue) {
          const dx = sw.rogueTargetX - sw.x;
          const dy = sw.rogueTargetY - sw.y;
          const dist = Math.hypot(dx, dy) || 1;

          desiredX = (dx / dist) * 13;
          desiredY = (dy / dist) * 13;
          maxSpeed = 13;
          maxForce = 0.8;

          sw.rogueTimer--;
          if (dist < 20 || sw.rogueTimer <= 0) {
            sw.isRogue = false;
          }
        } else {
          let dX = (f.x - sw.x) * 0.13, dY = (f.y - sw.y) * 0.13;
          [dX, dY] = clampMag(dX, dY, 6.2);
          desiredX = dX; desiredY = dY;
          maxSpeed = 6.2; maxForce = 0.42;
          formationFacing = f.facing;
        }
      } else {
        if (sw.isRogue !== undefined) sw.isRogue = false;

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

    const speedMag = Math.hypot(sw.vx, sw.vy);
    if (formationFacing !== null && speedMag < 0.7 && !sw.isRogue){ 
      let diff = formationFacing - sw.angle;
      while (diff > Math.PI) diff -= Math.PI*2;
      while (diff < -Math.PI) diff += Math.PI*2;
      sw.angle += diff * 0.15;
    } else if (speedMag > 0.05){
      const targetFacing = Math.atan2(sw.vy, sw.vx);
      let diff = targetFacing - sw.angle;
      while (diff > Math.PI) diff -= Math.PI*2;
      while (diff < -Math.PI) diff += Math.PI*2;
      sw.angle += diff * 0.25;
    }

    const isHidden = (s.idleMode === 'stored' && !s.dragging && !sw.flingActive && sw.stowed);
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