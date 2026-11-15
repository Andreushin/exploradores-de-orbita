// Generado automáticamente desde originales/falcon-heavy/falcon-heavy-assembled.html (modelo 3D de JU4NMAX).
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
        for(let c = 0; c < 4; c++) ctx.fillRect(x + 3 + c * 7, y + 2 + r * 5, 2, 2);
      }
    }

    // 1. Textura del Núcleo Falcon 9 / Falcon Heavy (Blanco aeroespacial con logo)
    const coreTex = createTexture(1024, 2048, (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Costuras y paneles cilíndricos
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 2;
      for(let y = 100; y < h; y += 140) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Línea de raceway frontal
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(w * 0.49, 0, w * 0.02, h);

      // Logo SpaceX vertical
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 56px Arial, Helvetica, sans-serif';
      ctx.letterSpacing = '12px';
      ctx.save();
      ctx.translate(220, 1000);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('SPACEX', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(780, 1000);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('SPACEX', 0, 0);
      ctx.restore();

      // Logo "FH" (Falcon Heavy) y Bandera de EE.UU.
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('FH', 485, 300);
      drawFlag(ctx, 475, 330, 75, 45);

      // Indicadores de advertencia y escotillas LOX
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(480, 1500, 64, 40);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(480, 1500, 64, 40);
    });

    // 2. Textura de Interetapa de Fibra de Carbono (Matte Carbon Fiber)
    const carbonTex = createTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // Trama entrelazada de fibra de carbono
      ctx.fillStyle = '#1e293b';
      for(let y = 0; y < h; y += 8) {
        for(let x = 0; x < w; x += 8) {
          if((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
        }
      }

      // Marcadores blancos de separación
      ctx.fillStyle = '#f8fafc';
      for(let x = 32; x < w; x += 128) {
        ctx.fillRect(x, 240, 24, 32);
      }
    });

    // 3. Textura de la Cofia Aerodinámica (5.2m Clamshell Fairing)
    const fairingTex = createTexture(1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Línea de separación bipartita (Clamshell split line)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h); ctx.stroke();

      // Emblema de misión (Space Force / USSF)
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(w * 0.25, 450, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('USSF', w * 0.25 - 24, 455);

      // Logo SpaceX
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('SPACE', w * 0.25 - 60, 560);
      ctx.fillStyle = '#0284c7';
      ctx.fillText('X', w * 0.25 + 36, 560);
    });

    // ── 4. Materiales PBR ───────────────────────────────────────────────────
    const matCore    = new THREE.MeshStandardMaterial({ map: coreTex, roughness: 0.28, metalness: 0.20 });
    const matCarbon  = new THREE.MeshStandardMaterial({ map: carbonTex, roughness: 0.45, metalness: 0.35 });
    const matFairing = new THREE.MeshStandardMaterial({ map: fairingTex, roughness: 0.25, metalness: 0.15 });
    const matTitanium= new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.85 }); // Grid Fins
    const matLegs    = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.40, metalness: 0.70 }); // Carbon fiber legs
    const matEngine  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.90 }); // Merlin 1D
    const matMetal   = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.20, metalness: 0.85 });
    const matWhite   = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.15 });

    // ── 5. Construcción del Falcon Heavy Completo ───────────────────────────
    const rocket = new THREE.Group();

    // [1] COFIA AERODINÁMICA SUPERIOR (5.2m de diámetro)
    {
      const fairingCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.30, 1.30, 2.6, 32), matFairing);
      fairingCyl.position.y = 12.8;
      rocket.add(fairingCyl);

      const fairingCone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.30, 4.2, 32), matFairing);
      fairingCone.position.y = 16.2;
      rocket.add(fairingCone);

      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI*2, 0, Math.PI/2), matWhite);
      noseTip.position.y = 18.3;
      rocket.add(noseTip);
    }

    // [2] SEGUNDA ETAPA (Second Stage con motor Merlin Vacuum)
    {
      const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 4.6, 32), matCore);
      stage2.position.y = 9.2;
      rocket.add(stage2);

      // Cono de transición a la cofia
      const adapter = new THREE.Mesh(new THREE.CylinderGeometry(1.30, 0.92, 0.8, 32), matWhite);
      adapter.position.y = 11.5;
      rocket.add(adapter);
    }

    // [3] INTERETAPA DE FIBRA DE CARBONO (Carbon Composite Interstage)
    {
      const interstage = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 2.2, 32), matCarbon);
      interstage.position.y = 5.8;
      rocket.add(interstage);
    }

    // Función auxiliar para construir Grid Fins (Aletas de Rejilla de Titanio)
    function createGridFin() {
      return new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.04), matTitanium);
    }

    // Función auxiliar para construir Patas de Aterrizaje de Fibra de Carbono (Landing Legs)
    const allLegs = [];
    function createLandingLeg(ang, r, baseY) {
      const legPivot = new THREE.Group();
      legPivot.position.set(Math.cos(ang) * r, baseY, Math.sin(ang) * r);
      legPivot.rotation.y = -ang + Math.PI/2;

      // Pata principal plegada verticalmente
      const legA = new THREE.Mesh(new THREE.BoxGeometry(0.10, 3.6, 0.08), matLegs);
      legA.position.set(0, 1.8, 0.04);
      legPivot.add(legA);

      // Cilindro actuador neumático telescópico
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2), matMetal);
      piston.position.set(0, 1.2, -0.05);
      legPivot.add(piston);

      allLegs.push({ pivot: legPivot, targetRot: 0, currentRot: 0 });
      return legPivot;
    }

    // Función auxiliar para Octaweb (9 motores Merlin 1D: 8 en círculo + 1 central)
    const merlinBells = [];
    function createOctaweb(parent, centerX, baseY, centerZ) {
      const octaGroup = new THREE.Group();
      octaGroup.position.set(centerX, baseY, centerZ);

      // Escudo térmico de base Octaweb
      const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.90, 0.4, 32), matCarbon);
      octaGroup.add(basePlate);

      // Motor central #9
      const bellCenter = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 16, 1, true), matEngine);
      bellCenter.position.set(0, -0.45, 0);
      octaGroup.add(bellCenter);
      merlinBells.push({ mesh: bellCenter, worldX: centerX, worldZ: centerZ });

      // 8 Motores periféricos en anillo
      for(let i=0; i<8; i++) {
        const ang = (i * Math.PI) / 4;
        const ox = Math.cos(ang) * 0.55;
        const oz = Math.sin(ang) * 0.55;
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 16, 1, true), matEngine);
        bell.position.set(ox, -0.45, oz);
        octaGroup.add(bell);
        merlinBells.push({ mesh: bell, worldX: centerX + ox, worldZ: centerZ + oz });
      }

      parent.add(octaGroup);
    }

    // [4] NÚCLEO CENTRAL (CENTER CORE)
    {
      const centerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 14.0, 32), matCore);
      centerBody.position.y = -2.3;
      rocket.add(centerBody);

      // 4 Grid Fins en la parte superior del núcleo central
      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2;
        const gf = createGridFin();
        gf.position.set(Math.cos(ang) * 1.05, 4.4, Math.sin(ang) * 1.05);
        gf.rotation.y = -ang + Math.PI/2;
        rocket.add(gf);
      }

      // 4 Landing legs en la base del núcleo central
      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI/4;
        rocket.add(createLandingLeg(ang, 0.92, -9.1));
      }

      // Octaweb con 9 motores Merlin 1D
      createOctaweb(rocket, 0, -9.3, 0);
    }

    // [5] PROPULSORES LATERALES (SIDE BOOSTERS - 2 CORES CON CONOS AERODINÁMICOS)
    const boosterOffsets = [-1.95, 1.95];
    boosterOffsets.forEach(bx => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0, 0);

      // Cono aerodinámico superior del booster lateral
      const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.92, 2.6, 32), matWhite);
      noseCone.position.y = 5.8;
      bGroup.add(noseCone);

      const noseCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI*2, 0, Math.PI/2), matWhite);
      noseCap.position.y = 7.1;
      bGroup.add(noseCap);

      // Cuerpo cilíndrico del booster (14.0m escala)
      const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 14.0, 32), matCore);
      bBody.position.y = -2.3;
      bGroup.add(bBody);

      // Soportes de conexión estructural con el núcleo central
      [-2.0, 2.0].forEach(sy => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45), matMetal);
        strut.position.set(bx > 0 ? -0.8 : 0.8, sy, 0);
        strut.rotation.z = Math.PI / 2;
        bGroup.add(strut);
      });

      // 4 Grid Fins en la parte superior del booster lateral
      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2;
        const gf = createGridFin();
        gf.position.set(Math.cos(ang) * 1.05, 4.4, Math.sin(ang) * 1.05);
        gf.rotation.y = -ang + Math.PI/2;
        bGroup.add(gf);
      }

      // 4 Landing legs en la base del booster lateral
      for(let i=0; i<4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI/4;
        bGroup.add(createLandingLeg(ang, 0.92, -9.1));
      }

      // Octaweb con 9 motores Merlin 1D
      createOctaweb(bGroup, 0, -9.3, 0);

      rocket.add(bGroup);
    });
    return rocket;
}
