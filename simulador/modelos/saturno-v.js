// Generado automáticamente desde originales/saturno-v/apollo11-assembled.html (modelo 3D de JU4NMAX).
// Solo la construcción del cohete: texturas, materiales y piezas. No editar a mano:
// si cambia el modelo original, vuelve a correr la extracción.
export function construir(THREE) {
    function createTexture(w, h, drawFn) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      drawFn(ctx, w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }

    function drawFlag(ctx, x, y, w, h) {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(x, y, w, h);
      const stripeH = h / 7;
      ctx.fillStyle = '#ffffff';
      for(let s = 1; s < 7; s += 2) ctx.fillRect(x, y + s * stripeH, w, stripeH);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(x, y, w * 0.45, h * 0.55);
      ctx.fillStyle = '#ffffff';
      for(let r = 0; r < 3; r++) {
        for(let c = 0; c < 4; c++) ctx.fillRect(x + 4 + c * 8, y + 3 + r * 6, 2, 2);
      }
    }

    const s1cTex = createTexture(1024, 2048, (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w * 0.25, 280);
      ctx.fillRect(w * 0.5, 0, w * 0.25, 280);
      ctx.fillRect(0, 1150, w * 0.25, 480);
      ctx.fillRect(w * 0.5, 1150, w * 0.25, 480);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 720, w, 280);
      ctx.fillStyle = '#cbd5e1';
      for(let x = 0; x < w; x += 12) ctx.fillRect(x, 720, 6, 280);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 720); ctx.lineTo(w, 720); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 1000); ctx.lineTo(w, 1000); ctx.stroke();

      drawFlag(ctx, 380, 420, 160, 95);
      drawFlag(ctx, 890, 420, 160, 95);

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 96px Arial, Helvetica, sans-serif';
      ctx.letterSpacing = '14px';
      ctx.fillText('U', 380, 1260); ctx.fillText('S', 380, 1370); ctx.fillText('A', 380, 1480);
      ctx.fillText('U', 890, 1260); ctx.fillText('S', 890, 1370); ctx.fillText('A', 890, 1480);
    });

    const s2Tex = createTexture(1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w * 0.25, 200);
      ctx.fillRect(w * 0.5, 0, w * 0.25, 200);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 800, w, 224);
      ctx.fillStyle = '#cbd5e1';
      for(let x = 0; x < w; x += 12) ctx.fillRect(x, 800, 6, 224);

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 36px Arial, Helvetica, sans-serif';
      ctx.letterSpacing = '8px';
      ctx.save(); ctx.translate(380, 320); ctx.rotate(Math.PI / 2); ctx.fillText('UNITED STATES', 0, 0); ctx.restore();
      ctx.save(); ctx.translate(890, 320); ctx.rotate(Math.PI / 2); ctx.fillText('UNITED STATES', 0, 0); ctx.restore();
    });

    const s4bTex = createTexture(1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 480, w, 36);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      for(let x = 0; x < w; x += 256) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke();
      }

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('USA', 320, 720);
      drawFlag(ctx, 580, 680, 80, 50);
    });

    const csmTex = createTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b';
      for(let i=0; i<4; i++) {
        ctx.fillRect(i * 256 + 32, 60, 192, 380);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for(let l = 75; l < 430; l += 20) {
          ctx.beginPath(); ctx.moveTo(i*256 + 32, l); ctx.lineTo(i*256 + 224, l); ctx.stroke();
        }
      }
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('APOLLO 11 · CSM-107', 350, 40);
    });

    // ── 4. Construcción del Saturno V Completo Ensamblado ─────────────────────
    const rocket = new THREE.Group();

    const matWhite  = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });
    const matS1C    = new THREE.MeshStandardMaterial({ map: s1cTex, roughness: 0.40, metalness: 0.1 });
    const matS2     = new THREE.MeshStandardMaterial({ map: s2Tex, roughness: 0.40, metalness: 0.1 });
    const matS4B    = new THREE.MeshStandardMaterial({ map: s4bTex, roughness: 0.35, metalness: 0.1 });
    const matCSM    = new THREE.MeshStandardMaterial({ map: csmTex, roughness: 0.30, metalness: 0.4 });
    const matCM     = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.20, metalness: 0.85 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.9 });
    const matMetal  = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.25, metalness: 0.85 });

    // 1. TORRE DE ESCAPE (LES)
    {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.78, 1.4, 24), matWhite);
      cover.position.y = 15.5;
      rocket.add(cover);

      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI/4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.8), matWhite);
        leg.position.set(Math.cos(ang)*0.28, 17.6, Math.sin(ang)*0.28);
        rocket.add(leg);
      }

      const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16), matWhite);
      motorBody.position.y = 19.9;
      rocket.add(motorBody);

      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2;
        const noz = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 12), matEngine);
        noz.position.set(Math.cos(ang)*0.18, 18.9, Math.sin(ang)*0.18);
        noz.rotation.z = Math.cos(ang) * 0.45;
        noz.rotation.x = Math.sin(ang) * -0.45;
        rocket.add(noz);
      }

      const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 16), matMetal);
      noseTip.position.y = 21.45;
      rocket.add(noseTip);
    }

    // 2. MÓDULO DE MANDO Y SERVICIO (CSM Columbia)
    {
      const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 1.15, 1.1, 32), matCM);
      cm.position.y = 14.35;
      rocket.add(cm);

      const sm = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.8, 32), matCSM);
      sm.position.y = 12.80;
      rocket.add(sm);
    }

    // 3. ADAPTADOR SLA & ETAPA S-IVB
    {
      const slaCone = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.95, 2.5, 32, 1, true), matS4B);
      slaCone.position.y = 10.65;
      rocket.add(slaCone);

      const iuRing = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.4, 32), matWhite);
      iuRing.position.y = 9.20;
      rocket.add(iuRing);

      const s4bBody = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 3.8, 32), matS4B);
      s4bBody.position.y = 7.10;
      rocket.add(s4bBody);
    }

    // 4. SEGUNDA ETAPA (S-II)
    {
      const interstageCone = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 3.0, 1.8, 32, 1, true), matS2);
      interstageCone.position.y = 4.30;
      rocket.add(interstageCone);

      const s2Body = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 6.2, 32), matS2);
      s2Body.position.y = 0.30;
      rocket.add(s2Body);
    }

    // 5. PRIMERA ETAPA (S-IC)
    {
      const s1Body = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 13.0, 32), matS1C);
      s1Body.position.y = -9.30;
      rocket.add(s1Body);

      // 4 Aletas estabilizadoras
      for(let f=0; f<4; f++) {
        const ang = (f * Math.PI) / 2;
        const finGroup = new THREE.Group();
        finGroup.position.set(Math.cos(ang)*3.0, -14.8, Math.sin(ang)*3.0);
        finGroup.rotation.y = -ang;

        const fairing = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.8, 16), matWhite);
        fairing.position.set(0.65, -0.2, 0);
        finGroup.add(fairing);

        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(1.8, -1.8);
        finShape.lineTo(1.8, -2.6);
        finShape.lineTo(0, -2.4);
        finShape.closePath();

        const extSettings = { depth: 0.08, bevelEnabled: false };
        const finGeo = new THREE.ExtrudeGeometry(finShape, extSettings);
        const finMesh = new THREE.Mesh(finGeo, matWhite);
        finMesh.position.set(0.65, 0.4, -0.04);
        finGroup.add(finMesh);

        rocket.add(finGroup);
      }

      // 5 Motores F-1
      const f1Offsets = [
        [0, 0],
        [-1.65, 0],
        [ 1.65, 0],
        [0, -1.65],
        [0,  1.65]
      ];
      f1Offsets.forEach(([fx, fz]) => {
        const f1Bell = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.5, 32, 1, true), matEngine);
        f1Bell.position.set(fx, -16.8, fz);
        rocket.add(f1Bell);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 32), matMetal);
        ring.rotation.x = Math.PI/2;
        ring.position.set(fx, -18.0, fz);
        rocket.add(ring);
      });
    }
    return rocket;
}
