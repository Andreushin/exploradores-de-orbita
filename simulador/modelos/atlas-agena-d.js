// Generado automáticamente desde originales/atlas-agena-d/atlas-agena-assembled.html (modelo 3D de JU4NMAX).
// Solo la construcción del cohete: texturas, materiales y piezas. No editar a mano:
// si cambia el modelo original, vuelve a correr la extracción.
export function construir(THREE) {
    function createTexture(width, height, drawFn) {
      const cv = document.createElement('canvas');
      cv.width = width; cv.height = height;
      const ctx = cv.getContext('2d');
      drawFn(ctx, width, height);
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }

    function drawFlag(ctx, x, y, w, h) {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(x, y, w, h);
      const stripeH = h / 13;
      ctx.fillStyle = '#ffffff';
      for(let i = 1; i < 13; i += 2) {
        ctx.fillRect(x, y + i * stripeH, w, stripeH);
      }
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x, y, w * 0.42, stripeH * 7);
      ctx.fillStyle = '#ffffff';
      for(let r = 0; r < 3; r++) {
        for(let c = 0; c < 4; c++) ctx.fillRect(x + 4 + c * 8, y + 3 + r * 6, 2, 2);
      }
    }

    // 1. Textura del Tanque de Acero Inoxidable Atlas (Balloon Tank)
    const atlasTankTex = createTexture(1024, 2048, (ctx, w, h) => {
      // Acero inoxidable pulido base
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#94a3b8');
      grad.addColorStop(0.25, '#cbd5e1');
      grad.addColorStop(0.5, '#f1f5f9');
      grad.addColorStop(0.75, '#cbd5e1');
      grad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Líneas horizontales de paneles soldados de acero
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
      ctx.lineWidth = 2;
      for(let y = 0; y < h; y += 45) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Costuras verticales de tanque presurizado
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 3;
      for(let x = 0; x < w; x += 256) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Rótulo vertical UNITED STATES en negro
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 44px Arial, Helvetica, sans-serif';
      ctx.letterSpacing = '10px';
      const textX1 = 340;
      const textX2 = 852;
      const letters = ['U','N','I','T','E','D',' ','S','T','A','T','E','S'];
      letters.forEach((l, idx) => {
        if(l !== ' ') {
          ctx.fillText(l, textX1, 580 + idx * 75);
          ctx.fillText(l, textX2, 580 + idx * 75);
        }
      });

      // Placas rojas y marcas de alerta
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(textX1 - 30, 1680, 45, 30);
      ctx.fillRect(textX2 - 30, 1680, 45, 30);
    });

    // 2. Textura de la Faldón de Popa / Booster Skirt (Corrugada)
    const skirtTex = createTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, w, h);

      // Estructura corrugada vertical
      for(let x = 0; x < w; x += 10) {
        ctx.fillStyle = (x % 20 === 0) ? '#64748b' : '#cbd5e1';
        ctx.fillRect(x, 0, 5, h);
      }

      // Paneles rectangulares de acceso
      ctx.fillStyle = '#475569';
      for(let x = 60; x < w; x += 256) {
        ctx.fillRect(x, 120, 120, 180);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, 120, 120, 180);
      }
    });

    // 3. Textura de la Interetapa Atlas-Agena con Damero Blanco/Negro
    const interstageTex = createTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Banda de damero blanco y negro (Checkerboard) histórica de 2 filas
      const rows = 2;
      const cols = 24;
      const cellW = w / cols;
      const cellH = 65;
      const startY = 220;

      for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
          if((r + c) % 2 === 0) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(c * cellW, startY + r * cellH, cellW, cellH);
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(c * cellW, startY + r * cellH, cellW, cellH);
          }
        }
      }

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, startY); ctx.lineTo(w, startY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, startY + rows * cellH); ctx.lineTo(w, startY + rows * cellH); ctx.stroke();
    });

    // 4. Textura de la Etapa Superior Agena D
    const agenaTex = createTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, w, h);

      // Bahía de instrumentos corrugada
      for(let x = 0; x < w; x += 12) {
        ctx.fillStyle = (x % 24 === 0) ? '#94a3b8' : '#cbd5e1';
        ctx.fillRect(x, 0, 6, 240);
      }

      // Bandera estadounidense
      drawFlag(ctx, 360, 260, 110, 65);
      drawFlag(ctx, 870, 260, 110, 65);

      // Rótulos de Agena D
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('AGENA D · ATV-5003', 320, 360);
      ctx.fillText('AGENA D · ATV-5003', 830, 360);
    });

    // ── 4. Materiales PBR ───────────────────────────────────────────────────
    const matSteel  = new THREE.MeshStandardMaterial({ map: atlasTankTex, roughness: 0.22, metalness: 0.88 });
    const matSkirt  = new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.35, metalness: 0.65 });
    const matInter  = new THREE.MeshStandardMaterial({ map: interstageTex, roughness: 0.40, metalness: 0.25 });
    const matAgena  = new THREE.MeshStandardMaterial({ map: agenaTex, roughness: 0.30, metalness: 0.40 });
    const matWhite  = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.15 });
    const matDark   = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.50, metalness: 0.30 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.90 });
    const matMetal  = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.20, metalness: 0.85 });
    const matGold   = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.30, metalness: 0.80 });

    // ── 5. Construcción del Cohete Atlas-Agena D ────────────────────────────
    const rocket = new THREE.Group();

    // [1] COFIA / NOSE FAIRING (Protector cónico aerodinámico superior)
    {
      const fairing = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.76, 2.4, 32), matWhite);
      fairing.position.y = 12.8;
      rocket.add(fairing);

      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI*2, 0, Math.PI/2), matWhite);
      noseTip.position.y = 14.0;
      rocket.add(noseTip);
    }

    // [2] ETAPA SUPERIOR AGENA D (Target Docking Vehicle)
    {
      // Cono de Acoplamiento y Adaptador ATDA / TDA
      const dockingRing = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.76, 0.5, 32), matDark);
      dockingRing.position.y = 11.35;
      rocket.add(dockingRing);

      // Cilindro principal de Agena D
      const agenaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 3.2, 32), matAgena);
      agenaBody.position.y = 9.5;
      rocket.add(agenaBody);

      // Antenas de telemetría y radar de banda L (para acople con Gemini)
      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI/4;
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), matMetal);
        ant.position.set(Math.cos(ang)*0.82, 10.8, Math.sin(ang)*0.82);
        ant.rotation.z = Math.cos(ang) * 0.4;
        ant.rotation.x = Math.sin(ang) * 0.4;
        rocket.add(ant);
      }
    }

    // [3] INTERETAPA ATLAS-AGENACONTENIENDO EL DAMERO BLANCO Y NEGRO
    {
      // Cono de transición y shroud
      const interstage = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 1.25, 2.2, 32), matInter);
      interstage.position.y = 6.8;
      rocket.add(interstage);
    }

    // [4] TANQUE PRINCIPAL ATLAS SLV-3 (ACERO INOXIDABLE DE PRESIÓN)
    {
      // Domo cónico superior de unión
      const atlasCone = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.52, 2.4, 32), matSteel);
      atlasCone.position.y = 4.5;
      rocket.add(atlasCone);

      // Cuerpo cilíndrico de acero inoxidable de 3.05 m de diámetro
      const atlasBody = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 9.8, 32), matSteel);
      atlasBody.position.y = -1.6;
      rocket.add(atlasBody);

      // Tuberías externas de cableado y LOX (Side Conduits / Pods)
      [-1.53, 1.53].forEach(x => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 11.2), matMetal);
        pipe.position.set(x, -1.0, 0);
        rocket.add(pipe);

        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.16), matWhite);
        pod.position.set(x, -4.5, 0);
        rocket.add(pod);
      });
    }

    // [5] FALDA DE POPA Y ESTRUCTURA DE MOTORES (BOOSTER SKIRT)
    {
      // Faldón corrugado ensanchado de la primera etapa
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.76, 2.8, 32), matSkirt);
      skirt.position.y = -7.9;
      rocket.add(skirt);

      // Carenados laterales de los motores de despegue (Booster pods)
      [-1.55, 1.55].forEach(x => {
        const fairing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.8, 16), matSkirt);
        fairing.position.set(x, -7.9, 0);
        rocket.add(fairing);
      });

      // 2x Motores Booster Rocketdyne XLR89 (exteriores desechables)
      [-0.95, 0.95].forEach(x => {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.4, 24, 1, true), matEngine);
        bell.position.set(x, -9.9, 0);
        rocket.add(bell);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 24), matMetal);
        ring.rotation.x = Math.PI/2;
        ring.position.set(x, -10.6, 0);
        rocket.add(ring);
      });

      // 1x Motor Central Sustainer Rocketdyne XLR105 (no desechable)
      const sustainerBell = new THREE.Mesh(new THREE.ConeGeometry(0.40, 1.25, 24, 1, true), matEngine);
      sustainerBell.position.set(0, -9.7, 0);
      rocket.add(sustainerBell);

      // 2x Pequeños motores vernier para control de cabeceo y balanceo
      [ [0, -1.6], [0, 1.6] ].forEach(([vx, vz]) => {
        const vernier = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 12, 1, true), matEngine);
        vernier.position.set(vx, -8.2, vz);
        vernier.rotation.x = vz > 0 ? 0.3 : -0.3;
        rocket.add(vernier);
      });
    }
    return rocket;
}
