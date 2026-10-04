import type * as THREE_TYPES from "three";
import type { DecorPresetItem } from "./decor-catalog";

type THREE_NS = typeof import("three");

export function buildDecor3DGroup(
  THREE: THREE_NS,
  preset: DecorPresetItem,
  ow: number,
  od: number,
  oh: number,
  meta: Record<string, unknown> = {}
): THREE_TYPES.Group {
  const group = new THREE.Group();
  const id = preset.id;
  const col = new THREE.Color(preset.color || "#8b5cf6");

  // Custom image texture (for rugs, posters, custom displays)
  const customImgUrl = (meta.image_url as string) || (meta.sprite_url as string) || null;

  switch (id) {
    // ==========================================
    // 🛎️ 2 עמדות קבלה
    // ==========================================
    case "reception_luxury": {
      // Marble counter base
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.1 });
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.05 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.5 });

      // Curved / layered counter
      const desk = new THREE.Mesh(new THREE.BoxGeometry(ow, oh * 0.8, od * 0.6), marbleMat);
      desk.position.set(0, (oh * 0.8) / 2, 0);
      desk.castShadow = true;
      desk.receiveShadow = true;
      group.add(desk);

      // Gold kickplate & top trim positioned cleanly above the counter without co-planar fighting
      const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(ow + 4, 6, od * 0.6 + 4), goldMat);
      goldTrim.position.set(0, oh * 0.8 + 3, 0);
      goldTrim.castShadow = true;
      goldTrim.receiveShadow = true;
      group.add(goldTrim);

      const goldBase = new THREE.Mesh(new THREE.BoxGeometry(ow + 2, 6, od * 0.6 + 2), goldMat);
      goldBase.position.set(0, 3, 0);
      group.add(goldBase);

      // Reception Computer Monitor
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(40, 26, 6), baseMat);
      monitor.position.set(0, oh * 0.8 + 16, -od * 0.1);
      monitor.castShadow = true;
      group.add(monitor);

      const screenFace = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 22),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      screenFace.position.set(0, oh * 0.8 + 16, -od * 0.1 + 3.2);
      group.add(screenFace);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 12), baseMat);
      stand.position.set(0, oh * 0.8 + 8, -od * 0.1);
      group.add(stand);
      break;
    }

    case "reception_cyber": {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.4, metalness: 0.5 });
      const cyanNeon = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, roughness: 0.2 });
      const pinkNeon = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xdb2777, roughness: 0.2 });

      // Main angled counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(ow, oh * 0.85, od * 0.6), darkMat);
      counter.position.set(0, (oh * 0.85) / 2, 0);
      counter.castShadow = true;
      group.add(counter);

      // Neon front logo strip
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.8, 12, 4), cyanNeon);
      neonStrip.position.set(0, (oh * 0.85) * 0.6, od * 0.3 + 2);
      group.add(neonStrip);

      const underGlow = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, 4, od * 0.6 + 4), pinkNeon);
      underGlow.position.set(0, 2, 0);
      group.add(underGlow);

      // Holographic terminal
      const holoScreen = new THREE.Mesh(
        new THREE.BoxGeometry(50, 30, 2),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 })
      );
      holoScreen.position.set(0, oh * 0.85 + 20, 0);
      group.add(holoScreen);
      break;
    }

    // ==========================================
    // 🪴 4 עציצים
    // ==========================================
    case "pot_terracotta": {
      const potMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.32, ow * 0.22, oh * 0.4, 16), potMat);
      pot.position.y = (oh * 0.4) / 2;
      pot.castShadow = true;
      group.add(pot);

      // Lush round bush
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const bush = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.45, 12, 10), leafMat);
      bush.position.y = oh * 0.65;
      bush.castShadow = true;
      group.add(bush);
      break;
    }

    case "pot_geometric": {
      const potMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.1 });
      const pot = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.5, oh * 0.45, od * 0.5), potMat);
      pot.position.y = (oh * 0.45) / 2;
      pot.castShadow = true;
      group.add(pot);

      // Sansevieria tall blade leaves
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.4 });
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(8, oh * 0.55, 3), leafMat);
        const angle = (i / 5) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 12, oh * 0.45 + (oh * 0.55) / 2 - 8, Math.sin(angle) * 12);
        blade.rotation.z = (Math.random() - 0.5) * 0.2;
        blade.rotation.y = angle;
        blade.castShadow = true;
        group.add(blade);
      }
      break;
    }

    case "pot_gold_tall": {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.85, roughness: 0.2 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.28, ow * 0.25, oh * 0.45, 20), goldMat);
      pot.position.y = (oh * 0.45) / 2;
      pot.castShadow = true;
      group.add(pot);

      // Ficus trunk & canopy
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x573a24 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, oh * 0.5), trunkMat);
      trunk.position.y = oh * 0.55;
      trunk.castShadow = true;
      group.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.4 });
      const crown = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.42, 12, 10), leafMat);
      crown.position.y = oh * 0.85;
      crown.castShadow = true;
      group.add(crown);
      break;
    }

    case "pot_cyber_neon": {
      const potMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.4 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.3, ow * 0.24, oh * 0.4, 16), potMat);
      pot.position.y = (oh * 0.4) / 2;
      pot.castShadow = true;
      group.add(pot);

      // Glowing pink neon ring
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xdb2777 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ow * 0.31, 3, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = oh * 0.38;
      group.add(ring);

      // Purple crystal flora
      const crystalMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, roughness: 0.2 });
      const flora = new THREE.Mesh(new THREE.ConeGeometry(ow * 0.35, oh * 0.6, 6), crystalMat);
      flora.position.y = oh * 0.7;
      flora.castShadow = true;
      group.add(flora);
      break;
    }

    // ==========================================
    // 🌿 3 צמחים
    // ==========================================
    case "plant_monstera": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(20, 16, 35, 12), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      pot.position.y = 17.5;
      group.add(pot);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.25, 6, 4), leafMat);
        const ang = (i / 6) * Math.PI * 2;
        leaf.scale.set(1.4, 0.2, 0.9);
        leaf.position.set(Math.cos(ang) * (ow * 0.28), 50 + i * 10, Math.sin(ang) * (od * 0.28));
        leaf.rotation.x = 0.4;
        leaf.rotation.y = ang;
        leaf.castShadow = true;
        group.add(leaf);
      }
      break;
    }

    case "plant_bamboo": {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.9, 25, od * 0.4), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
      planter.position.y = 12.5;
      group.add(planter);

      const bambooMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.4 });
      for (let i = -3; i <= 3; i++) {
        const cane = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, oh * 0.85, 8), bambooMat);
        cane.position.set(i * (ow * 0.12), (oh * 0.85) / 2 + 15, (Math.random() - 0.5) * 10);
        cane.castShadow = true;
        group.add(cane);
      }
      break;
    }

    case "plant_flower_bush": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(25, 20, 30, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      pot.position.y = 15;
      group.add(pot);

      const bushMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
      const bush = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.42, 10, 8), bushMat);
      bush.position.y = 55;
      group.add(bush);

      const bloomMat = new THREE.MeshStandardMaterial({ color: 0xd946ef, emissive: 0xa21caf, roughness: 0.3 });
      for (let i = 0; i < 7; i++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(8, 6, 6), bloomMat);
        const ang = (i / 7) * Math.PI * 2;
        flower.position.set(Math.cos(ang) * (ow * 0.3), 55 + (Math.random() - 0.5) * 20, Math.sin(ang) * (od * 0.3));
        group.add(flower);
      }
      break;
    }

    // ==========================================
    // 🌳 4 עצים
    // ==========================================
    case "tree_cyber_neon": {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(10, 16, oh * 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      trunk.position.y = (oh * 0.35) / 2;
      trunk.castShadow = true;
      group.add(trunk);

      const coneMat1 = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, roughness: 0.3 });
      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(ow * 0.5, oh * 0.45, 7), coneMat1);
      cone1.position.y = oh * 0.45;
      cone1.castShadow = true;
      group.add(cone1);

      const coneMat2 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.2 });
      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(ow * 0.38, oh * 0.35, 7), coneMat2);
      cone2.position.y = oh * 0.72;
      cone2.castShadow = true;
      group.add(cone2);
      break;
    }

    case "tree_cherry_sakura": {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(12, 18, oh * 0.45, 8), trunkMat);
      trunk.position.y = (oh * 0.45) / 2;
      trunk.castShadow = true;
      group.add(trunk);

      const sakuraMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 });
      const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.45, 12, 10), sakuraMat);
      canopy1.position.set(0, oh * 0.65, 0);
      canopy1.castShadow = true;
      group.add(canopy1);

      const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.32, 10, 8), sakuraMat);
      canopy2.position.set(ow * 0.2, oh * 0.78, 0);
      group.add(canopy2);
      break;
    }

    case "tree_palm_tropical": {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(8, 14, oh * 0.7, 8), trunkMat);
      trunk.position.y = (oh * 0.7) / 2;
      trunk.rotation.z = 0.06;
      trunk.castShadow = true;
      group.add(trunk);

      const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.55, 30), frondMat);
        const ang = (i / 6) * Math.PI * 2;
        frond.position.set(Math.cos(ang) * (ow * 0.25), oh * 0.75, Math.sin(ang) * (od * 0.25));
        frond.rotation.y = ang;
        frond.rotation.x = 0.6;
        frond.castShadow = true;
        group.add(frond);
      }
      break;
    }

    case "tree_golden_oak": {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(14, 20, oh * 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
      trunk.position.y = (oh * 0.45) / 2;
      trunk.castShadow = true;
      group.add(trunk);

      const oakMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(ow * 0.48, 1), oakMat);
      crown.position.y = oh * 0.7;
      crown.castShadow = true;
      group.add(crown);
      break;
    }

    // ==========================================
    // 🥤 3 מכונות משקאות
    // ==========================================
    case "vending_soda_retro": {
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.85, oh * 0.9, od * 0.7), redMat);
      body.position.y = (oh * 0.9) / 2;
      body.castShadow = true;
      group.add(body);

      // Lighted window
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(ow * 0.65, oh * 0.45),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, roughness: 0.1 })
      );
      glass.position.set(0, (oh * 0.9) * 0.55, (od * 0.7) / 2 + 1);
      group.add(glass);

      // Dispenser slot
      const slot = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.5, 20, 6), new THREE.MeshStandardMaterial({ color: 0x111827 }));
      slot.position.set(0, 20, (od * 0.7) / 2 + 1);
      group.add(slot);
      break;
    }

    case "vending_cyber_energy": {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.4, metalness: 0.6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.85, oh * 0.9, od * 0.7), bodyMat);
      body.position.y = (oh * 0.9) / 2;
      body.castShadow = true;
      group.add(body);

      const neonMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669 });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.75, oh * 0.45, 2), neonMat);
      strip.position.set(0, (oh * 0.9) * 0.55, (od * 0.7) / 2 + 1);
      group.add(strip);
      break;
    }

    case "vending_snack_deluxe": {
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.9, oh * 0.92, od * 0.75), blueMat);
      body.position.y = (oh * 0.92) / 2;
      body.castShadow = true;
      group.add(body);

      const glassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7 });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.7, oh * 0.55), glassMat);
      glass.position.set(0, (oh * 0.92) * 0.55, (od * 0.75) / 2 + 1);
      group.add(glass);
      break;
    }

    // ==========================================
    // 🪞 3 מראות
    // ==========================================
    case "mirror_luxury_gold": {
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
      const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.05 });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.8, oh * 0.9, 8), frameMat);
      frame.position.y = (oh * 0.9) / 2;
      frame.castShadow = true;
      group.add(frame);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.68, oh * 0.78), mirrorMat);
      glass.position.set(0, (oh * 0.9) / 2, 4.5);
      group.add(glass);
      break;
    }

    case "mirror_neon_cyber": {
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
      const neonMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce });
      const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.95, roughness: 0.05 });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.85, oh * 0.9, 10), frameMat);
      frame.position.y = (oh * 0.9) / 2;
      group.add(frame);

      const neonBorder = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.88, oh * 0.93, 4), neonMat);
      neonBorder.position.set(0, (oh * 0.9) / 2, -2);
      group.add(neonBorder);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.7, oh * 0.78), mirrorMat);
      glass.position.set(0, (oh * 0.9) / 2, 5.5);
      group.add(glass);
      break;
    }

    case "mirror_modern_wood": {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
      const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.05 });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.75, oh * 0.85, 6), woodMat);
      frame.position.y = (oh * 0.85) / 2 + 10;
      frame.rotation.x = 0.08;
      frame.castShadow = true;
      group.add(frame);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.62, oh * 0.72), mirrorMat);
      glass.position.set(0, (oh * 0.85) / 2 + 10, 3.5);
      glass.rotation.x = 0.08;
      group.add(glass);
      break;
    }

    // ==========================================
    // 🛋️ 4 סוגי ספות ארוכות
    // ==========================================
    case "sofa_cyber_lounge":
    case "sofa_luxury_velvet":
    case "sofa_modern_white":
    case "sofa_leather_tan": {
      const sofaMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: id === "sofa_luxury_velvet" ? 0.3 : 0.6,
        metalness: id === "sofa_cyber_lounge" ? 0.2 : 0.05,
      });

      // Seat base
      const seat = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, 30, od * 0.7), sofaMat);
      seat.position.set(0, 15, 0);
      seat.castShadow = true;
      group.add(seat);

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, oh * 0.7, 24), sofaMat);
      back.position.set(0, (oh * 0.7) / 2 + 15, -od * 0.25);
      back.castShadow = true;
      group.add(back);

      // Left armrest
      const armL = new THREE.Mesh(new THREE.BoxGeometry(22, 45, od * 0.7), sofaMat);
      armL.position.set(-ow * 0.43, 22.5, 0);
      group.add(armL);

      // Right armrest
      const armR = new THREE.Mesh(new THREE.BoxGeometry(22, 45, od * 0.7), sofaMat);
      armR.position.set(ow * 0.43, 22.5, 0);
      group.add(armR);

      // Cyber underglow
      if (id === "sofa_cyber_lounge") {
        const glow = new THREE.Mesh(
          new THREE.PlaneGeometry(ow * 0.9, od * 0.6),
          new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6 })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 1;
        group.add(glow);
      }
      break;
    }

    // ==========================================
    // 🪑 3 סוגי כורסאות בודדות
    // ==========================================
    case "armchair_egg_chair": {
      const eggMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(ow * 0.38, 16, 12), eggMat);
      shell.scale.set(1, 1.25, 0.9);
      shell.position.y = oh * 0.55;
      shell.castShadow = true;
      group.add(shell);

      const standMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 30), standMat);
      pole.position.y = 15;
      group.add(pole);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 4), standMat);
      base.position.y = 2;
      group.add(base);
      break;
    }

    case "armchair_modern_grey": {
      const clothMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.75, 26, od * 0.65), clothMat);
      seat.position.y = 18;
      seat.castShadow = true;
      group.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.75, oh * 0.65, 18), clothMat);
      back.position.set(0, (oh * 0.65) / 2 + 18, -od * 0.22);
      back.castShadow = true;
      group.add(back);
      break;
    }

    case "armchair_cyber_pod": {
      const podMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, roughness: 0.3 });
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(ow * 0.3, 30, 8, 12), podMat);
      pod.position.y = oh * 0.5;
      pod.castShadow = true;
      group.add(pod);
      break;
    }

    // ==========================================
    // ☕ 2 שולחנות עגולים קטנים
    // ==========================================
    case "table_round_glass": {
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.65, roughness: 0.1 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });

      const top = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.42, ow * 0.42, 6, 24), glassMat);
      top.position.y = oh * 0.85;
      top.castShadow = true;
      group.add(top);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, oh * 0.85), goldMat);
      leg.position.y = (oh * 0.85) / 2;
      group.add(leg);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.25, ow * 0.28, 4, 20), goldMat);
      base.position.y = 2;
      group.add(base);
      break;
    }

    case "table_round_cafe": {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7 });

      const top = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.4, ow * 0.4, 8, 20), woodMat);
      top.position.y = oh * 0.9;
      top.castShadow = true;
      group.add(top);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, oh * 0.9), ironMat);
      leg.position.y = (oh * 0.9) / 2;
      group.add(leg);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(ow * 0.24, ow * 0.26, 4, 16), ironMat);
      base.position.y = 2;
      group.add(base);
      break;
    }

    // ==========================================
    // 🏢 2 שולחנות גדולים כעמדה
    // ==========================================
    case "table_large_conference": {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c2b14, roughness: 0.4 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 });

      const top = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, 16, od * 0.75), woodMat);
      top.position.y = oh * 0.85;
      top.castShadow = true;
      group.add(top);

      // 4 metal legs
      const legPositions = [
        [-ow * 0.42, -od * 0.3],
        [ow * 0.42, -od * 0.3],
        [-ow * 0.42, od * 0.3],
        [ow * 0.42, od * 0.3],
      ];
      for (const [lx, lz] of legPositions) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(10, oh * 0.85, 10), steelMat);
        leg.position.set(lx, (oh * 0.85) / 2, lz);
        leg.castShadow = true;
        group.add(leg);
      }
      break;
    }

    case "table_large_cyber": {
      const acrylicMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, roughness: 0.2 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.8 });

      const top = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, 18, od * 0.65), acrylicMat);
      top.position.y = oh * 0.88;
      top.castShadow = true;
      group.add(top);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.9, oh * 0.88, 12), frameMat);
      frame.position.set(0, (oh * 0.88) / 2, 0);
      group.add(frame);
      break;
    }

    // ==========================================
    // 🟪 3 שטיחים (גודל + תמונה מותאמת)
    // ==========================================
    case "rug_luxury_oriental":
    case "rug_geometric_modern":
    case "rug_cyber_hologram":
    default: {
      if (preset.category === "rugs") {
        let rugMat: THREE_TYPES.Material;

        if (customImgUrl) {
          const texLoader = new THREE.TextureLoader();
          const tex = texLoader.load(customImgUrl);
          tex.colorSpace = THREE.SRGBColorSpace;
          rugMat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.7,
            metalness: 0.05,
          });
        } else {
          rugMat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.65,
            metalness: id === "rug_cyber_hologram" ? 0.4 : 0.05,
          });
        }

        const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(ow, od), rugMat);
        rugMesh.rotation.x = -Math.PI / 2;
        rugMesh.position.y = 1.8;
        rugMesh.receiveShadow = true;
        group.add(rugMesh);

        // Cyber glowing rim for hologram rug
        if (id === "rug_cyber_hologram") {
          const glowBorder = new THREE.Mesh(
            new THREE.PlaneGeometry(ow + 10, od + 10),
            new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.4 })
          );
          glowBorder.rotation.x = -Math.PI / 2;
          glowBorder.position.y = 1.6;
          group.add(glowBorder);
        }
      } else {
        // Fallback standard box
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(ow, preset.h || 80, od),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
        );
        box.position.y = (preset.h || 80) / 2;
        box.castShadow = true;
        group.add(box);
      }
      break;
    }
  }

  return group;
}
