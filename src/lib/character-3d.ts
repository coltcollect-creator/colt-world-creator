import type * as THREE_TYPES from "three";

export type THREE_NS = typeof import("three");

export type Character3DOptions = {
  jacketColor?: number;
  shirtColor?: number;
  pantsColor?: number;
  shoesColor?: number;
  hairColor?: number;
  skinColor?: number;
  scale?: number;
};

export type Character3DInstance = {
  group: THREE_TYPES.Group;
  shadowDisc: THREE_TYPES.Mesh;
  updateAnimation: (isMoving: boolean, dt: number) => void;
  setDirection: (moveX: number, moveZ: number, dt: number) => void;
  setRotationInstant: (angle: number) => void;
  getCurrentAngle: () => number;
  dispose: () => void;
};

/**
 * Creates a fully-articulated, high-fidelity 3D humanoid character for the convention room.
 * Built directly with Three.js hierarchy: real limbs, swinging joints, knee bending,
 * 360-degree fluid rotation and natural walking physics.
 */
export function createConventionCharacter3D(
  THREE: THREE_NS,
  options: Character3DOptions = {}
): Character3DInstance {
  const {
    jacketColor = 0x6d28d9, // Stylish convention purple jacket
    shirtColor = 0xf8fafc,  // Crisp white inner shirt
    pantsColor = 0x1e293b,  // Dark slate tech trousers
    shoesColor = 0xf1f5f9,  // Modern sneakers
    hairColor = 0x1c1917,   // Espresso dark styled hair
    skinColor = 0xfed7aa,   // Warm natural skin tone
    scale = 1.0,
  } = options;

  const rootGroup = new THREE.Group();
  rootGroup.name = "Character3D_Root";

  // Dynamic ground shadow disc
  const shadowGeo = new THREE.CircleGeometry(26 * scale, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.38,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 1.2;
  rootGroup.add(shadowDisc);

  // Rotating model pivot (handles smooth 360° turn)
  const pivot = new THREE.Group();
  pivot.name = "Character_Pivot";
  rootGroup.add(pivot);

  // Reusable materials
  const matSkin = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.6,
    metalness: 0.05,
  });
  const matJacket = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.45,
    metalness: 0.1,
  });
  const matJacketTrim = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Golden yellow trim accent
    roughness: 0.35,
    metalness: 0.3,
  });
  const matShirt = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.7,
  });
  const matPants = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.75,
  });
  const matShoes = new THREE.MeshStandardMaterial({
    color: shoesColor,
    roughness: 0.35,
  });
  const matShoeSole = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, // Cyan runner accent sole
    roughness: 0.4,
  });
  const matHair = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.8,
  });
  const matBadge = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.2,
    metalness: 0.1,
  });

  // ==========================================
  // 1. PELVIS & BODY GROUP (Center of gravity)
  // ==========================================
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "Body_Group";
  const BASE_BODY_Y = 54 * scale;
  bodyGroup.position.y = BASE_BODY_Y;
  pivot.add(bodyGroup);

  // Pelvis / Hips
  const pelvisGeo = new THREE.BoxGeometry(22 * scale, 12 * scale, 16 * scale);
  const pelvis = new THREE.Mesh(pelvisGeo, matPants);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyGroup.add(pelvis);

  // Torso / Jacket
  const torsoGeo = new THREE.BoxGeometry(26 * scale, 28 * scale, 18 * scale);
  const torso = new THREE.Mesh(torsoGeo, matJacket);
  torso.position.y = 18 * scale;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Inner Shirt Front Center Reveal
  const shirtFrontGeo = new THREE.BoxGeometry(10 * scale, 24 * scale, 2 * scale);
  const shirtFront = new THREE.Mesh(shirtFrontGeo, matShirt);
  shirtFront.position.set(0, 18 * scale, 9.2 * scale);
  bodyGroup.add(shirtFront);

  // Jacket Zipper / Golden Trim Lines
  const trimGeo = new THREE.BoxGeometry(2 * scale, 26 * scale, 2.2 * scale);
  const trimLeft = new THREE.Mesh(trimGeo, matJacketTrim);
  trimLeft.position.set(-5.5 * scale, 18 * scale, 9.2 * scale);
  const trimRight = new THREE.Mesh(trimGeo, matJacketTrim);
  trimRight.position.set(5.5 * scale, 18 * scale, 9.2 * scale);
  bodyGroup.add(trimLeft, trimRight);

  // Convention Lanyard & Badge
  const lanyardStrapGeo = new THREE.TorusGeometry(8 * scale, 0.8 * scale, 6, 16, Math.PI);
  const lanyardStrap = new THREE.Mesh(lanyardStrapGeo, matJacketTrim);
  lanyardStrap.rotation.x = Math.PI / 2 + 0.3;
  lanyardStrap.position.set(0, 30 * scale, 6 * scale);
  bodyGroup.add(lanyardStrap);

  const badgeGroup = new THREE.Group();
  badgeGroup.position.set(0, 20 * scale, 10.5 * scale);
  const badgeCard = new THREE.Mesh(
    new THREE.BoxGeometry(7 * scale, 10 * scale, 0.8 * scale),
    matBadge
  );
  badgeCard.castShadow = true;
  badgeGroup.add(badgeCard);
  bodyGroup.add(badgeGroup);

  // ==========================================
  // 2. NECK, HEAD & HAIR
  // ==========================================
  const neckGeo = new THREE.CylinderGeometry(4.5 * scale, 5 * scale, 7 * scale, 10);
  const neck = new THREE.Mesh(neckGeo, matSkin);
  neck.position.y = 34 * scale;
  bodyGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.name = "Head_Group";
  const BASE_HEAD_Y = 46 * scale;
  headGroup.position.y = BASE_HEAD_Y;
  bodyGroup.add(headGroup);

  // Head base
  const headGeo = new THREE.SphereGeometry(12 * scale, 18, 18);
  headGeo.scale(1, 1.12, 1);
  const headMesh = new THREE.Mesh(headGeo, matSkin);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Dedicated Face Group - tilted slightly up (-0.22 rad) to directly gaze into elevated 2.5D camera
  const faceGroup = new THREE.Group();
  faceGroup.name = "Face_Group";
  faceGroup.position.set(0, 1 * scale, 0);
  faceGroup.rotation.x = -0.22;
  headGroup.add(faceGroup);

  // High-Resolution Stylized Anime / Convention Front Face Decal (512x512)
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 512;
  faceCanvas.height = 512;
  const fCtx = faceCanvas.getContext("2d");
  if (fCtx) {
    fCtx.clearRect(0, 0, 512, 512);

    // Thick Expressive Eyebrows
    fCtx.strokeStyle = "#18181b";
    fCtx.lineWidth = 14;
    fCtx.lineCap = "round";
    // Left eyebrow
    fCtx.beginPath();
    fCtx.arc(160, 145, 55, Math.PI * 1.15, Math.PI * 1.82, false);
    fCtx.stroke();
    // Right eyebrow
    fCtx.beginPath();
    fCtx.arc(352, 145, 55, Math.PI * 1.18, Math.PI * 1.85, false);
    fCtx.stroke();

    // Large Vibrant Anime Eyes (Visible from elevated 3D camera)
    const drawBigExpressiveEye = (cx: number, cy: number, isLeft: boolean) => {
      // 1. Crisp White Sclera with soft drop shadow
      fCtx.save();
      fCtx.fillStyle = "#ffffff";
      fCtx.beginPath();
      fCtx.ellipse(cx, cy, 52, 65, isLeft ? 0.05 : -0.05, 0, Math.PI * 2);
      fCtx.fill();

      // Bold Eye Contour Border
      fCtx.strokeStyle = "#09090b";
      fCtx.lineWidth = 10;
      fCtx.stroke();
      fCtx.restore();

      // 2. Multi-stop Glowing Sapphire & Cyan Iris
      const irisGrad = fCtx.createRadialGradient(cx, cy - 8, 4, cx, cy + 4, 38);
      irisGrad.addColorStop(0, "#67e8f9"); // Bright electric cyan
      irisGrad.addColorStop(0.35, "#06b6d4"); // Cyan
      irisGrad.addColorStop(0.7, "#0284c7"); // Royal sky
      irisGrad.addColorStop(1, "#0f172a"); // Deep navy
      fCtx.fillStyle = irisGrad;
      fCtx.beginPath();
      fCtx.ellipse(cx, cy + 3, 37, 48, 0, 0, Math.PI * 2);
      fCtx.fill();

      // 3. Deep Obsidian Pupil
      fCtx.fillStyle = "#020617";
      fCtx.beginPath();
      fCtx.ellipse(cx, cy + 6, 20, 26, 0, 0, Math.PI * 2);
      fCtx.fill();

      // 4. Large Sparkling Catch-Light Gleams
      // Main top-left sparkle
      fCtx.fillStyle = "#ffffff";
      fCtx.beginPath();
      fCtx.arc(cx - 13, cy - 14, 14, 0, Math.PI * 2);
      fCtx.fill();
      // Secondary playful gleam
      fCtx.beginPath();
      fCtx.arc(cx + 14, cy + 15, 7.5, 0, Math.PI * 2);
      fCtx.fill();
      // Tiny twinkle
      fCtx.beginPath();
      fCtx.arc(cx - 10, cy + 18, 4, 0, Math.PI * 2);
      fCtx.fill();

      // 5. Stylized Upper Eyelash Wing
      fCtx.strokeStyle = "#09090b";
      fCtx.lineWidth = 12;
      fCtx.lineCap = "round";
      fCtx.beginPath();
      fCtx.arc(cx, cy - 6, 54, Math.PI * 1.10, Math.PI * 1.90, false);
      fCtx.stroke();
    };

    drawBigExpressiveEye(160, 215, true);
    drawBigExpressiveEye(352, 215, false);

    // Warm Rosy Cheek Blush
    const blushGradL = fCtx.createRadialGradient(105, 295, 2, 105, 295, 48);
    blushGradL.addColorStop(0, "rgba(244, 63, 94, 0.75)");
    blushGradL.addColorStop(0.6, "rgba(251, 113, 133, 0.45)");
    blushGradL.addColorStop(1, "rgba(251, 113, 133, 0)");
    fCtx.fillStyle = blushGradL;
    fCtx.beginPath();
    fCtx.ellipse(105, 295, 48, 25, -0.08, 0, Math.PI * 2);
    fCtx.fill();

    const blushGradR = fCtx.createRadialGradient(407, 295, 2, 407, 295, 48);
    blushGradR.addColorStop(0, "rgba(244, 63, 94, 0.75)");
    blushGradR.addColorStop(0.6, "rgba(251, 113, 133, 0.45)");
    blushGradR.addColorStop(1, "rgba(251, 113, 133, 0)");
    fCtx.fillStyle = blushGradR;
    fCtx.beginPath();
    fCtx.ellipse(407, 295, 48, 25, 0.08, 0, Math.PI * 2);
    fCtx.fill();

    // Cute Stylized Nose
    fCtx.fillStyle = "#ea580c";
    fCtx.beginPath();
    fCtx.ellipse(256, 290, 6, 5, 0, 0, Math.PI * 2);
    fCtx.fill();

    // Big Cheerful Smile with Teeth and Tongue
    fCtx.save();
    fCtx.beginPath();
    fCtx.arc(256, 315, 60, 0.22 * Math.PI, 0.78 * Math.PI, false);
    fCtx.closePath();
    fCtx.fillStyle = "#881337"; // Mouth interior
    fCtx.fill();
    fCtx.strokeStyle = "#4c0519";
    fCtx.lineWidth = 10;
    fCtx.lineJoin = "round";
    fCtx.stroke();

    // Upper Teeth Sparkle Strip
    fCtx.fillStyle = "#ffffff";
    fCtx.beginPath();
    fCtx.arc(256, 315, 58, 0.32 * Math.PI, 0.68 * Math.PI, false);
    fCtx.lineTo(256 + Math.cos(0.32 * Math.PI) * 58, 315 + Math.sin(0.32 * Math.PI) * 58);
    fCtx.fill();

    // Tongue
    fCtx.fillStyle = "#fb7185";
    fCtx.beginPath();
    fCtx.arc(256, 355, 30, 0, Math.PI, false);
    fCtx.fill();
    fCtx.restore();
  }

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshBasicMaterial({
    map: faceTex,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // Curved front face visor plate (wraps perfectly across the front hemisphere of the head)
  const faceGeo = new THREE.PlaneGeometry(21 * scale, 21 * scale);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.set(0, 0.5 * scale, 12.3 * scale);
  faceMesh.renderOrder = 10;
  faceGroup.add(faceMesh);

  // 3D Physical Eye Glint Spheres (catch real scene lights for authentic 3D presence)
  const eyeGlintGeo = new THREE.SphereGeometry(1.2 * scale, 8, 8);
  const matGlint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glintLeft = new THREE.Mesh(eyeGlintGeo, matGlint);
  glintLeft.position.set(-4.2 * scale, 1.8 * scale, 12.45 * scale);
  const glintRight = new THREE.Mesh(eyeGlintGeo, matGlint);
  glintRight.position.set(4.2 * scale, 1.8 * scale, 12.45 * scale);
  faceGroup.add(glintLeft, glintRight);

  // Ears
  const earGeo = new THREE.SphereGeometry(2.5 * scale, 8, 8);
  earGeo.scale(0.5, 1, 0.8);
  const leftEar = new THREE.Mesh(earGeo, matSkin);
  leftEar.position.set(-11.5 * scale, 0, 0);
  const rightEar = new THREE.Mesh(earGeo, matSkin);
  rightEar.position.set(11.5 * scale, 0, 0);
  headGroup.add(leftEar, rightEar);

  // Stylized 3D Convention Hair (Volumetric, lifted above forehead and eyes)
  const hairGroup = new THREE.Group();
  const hairTopGeo = new THREE.SphereGeometry(13.2 * scale, 14, 14);
  hairTopGeo.scale(1.04, 1.15, 1.08);
  const hairTop = new THREE.Mesh(hairTopGeo, matHair);
  hairTop.position.set(0, 3.2 * scale, -1.8 * scale);
  hairTop.castShadow = true;
  hairGroup.add(hairTop);

  // Side & Front Hair Tufts (Lifted & swept naturally so face is 100% visible)
  const bangGeo = new THREE.ConeGeometry(3.8 * scale, 8.5 * scale, 5);
  const bang1 = new THREE.Mesh(bangGeo, matHair);
  bang1.rotation.set(-0.25, 0.2, -0.65);
  bang1.position.set(-6.5 * scale, 11 * scale, 9.5 * scale);

  const bang2 = new THREE.Mesh(bangGeo, matHair);
  bang2.rotation.set(-0.3, -0.25, 0.65);
  bang2.position.set(6.5 * scale, 11.2 * scale, 9.5 * scale);

  const bang3 = new THREE.Mesh(bangGeo, matHair);
  bang3.rotation.set(-0.15, 0, 0);
  bang3.position.set(0, 12.8 * scale, 10 * scale);
  hairGroup.add(bang1, bang2, bang3);

  headGroup.add(hairGroup);

  // ==========================================
  // 3. ARMS WITH SHOULDER & ELBOW ARTICULATION
  // ==========================================
  // Left Arm (Pivot at left shoulder)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = "Left_Arm_Group";
  leftArmGroup.position.set(-16 * scale, 28 * scale, 0);
  bodyGroup.add(leftArmGroup);

  // Shoulder Joint
  const shoulderGeo = new THREE.SphereGeometry(4.5 * scale, 10, 10);
  const leftShoulder = new THREE.Mesh(shoulderGeo, matJacket);
  leftArmGroup.add(leftShoulder);

  // Upper Arm
  const upperArmGeo = new THREE.CylinderGeometry(3.8 * scale, 3.4 * scale, 13 * scale, 10);
  const leftUpperArm = new THREE.Mesh(upperArmGeo, matJacket);
  leftUpperArm.position.y = -6.5 * scale;
  leftUpperArm.castShadow = true;
  leftArmGroup.add(leftUpperArm);

  // Elbow Joint & Forearm
  const leftElbowGroup = new THREE.Group();
  leftElbowGroup.position.y = -13 * scale;
  leftArmGroup.add(leftElbowGroup);

  const forearmGeo = new THREE.CylinderGeometry(3.2 * scale, 2.8 * scale, 12 * scale, 10);
  const leftForearm = new THREE.Mesh(forearmGeo, matJacket);
  leftForearm.position.y = -6 * scale;
  leftForearm.castShadow = true;
  leftElbowGroup.add(leftForearm);

  // Hand
  const handGeo = new THREE.SphereGeometry(3.2 * scale, 10, 10);
  handGeo.scale(0.8, 1.2, 1);
  const leftHand = new THREE.Mesh(handGeo, matSkin);
  leftHand.position.y = -13 * scale;
  leftHand.castShadow = true;
  leftElbowGroup.add(leftHand);

  // Right Arm (Pivot at right shoulder)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.name = "Right_Arm_Group";
  rightArmGroup.position.set(16 * scale, 28 * scale, 0);
  bodyGroup.add(rightArmGroup);

  const rightShoulder = new THREE.Mesh(shoulderGeo, matJacket);
  rightArmGroup.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, matJacket);
  rightUpperArm.position.y = -6.5 * scale;
  rightUpperArm.castShadow = true;
  rightArmGroup.add(rightUpperArm);

  const rightElbowGroup = new THREE.Group();
  rightElbowGroup.position.y = -13 * scale;
  rightArmGroup.add(rightElbowGroup);

  const rightForearm = new THREE.Mesh(forearmGeo, matJacket);
  rightForearm.position.y = -6 * scale;
  rightForearm.castShadow = true;
  rightElbowGroup.add(rightForearm);

  const rightHand = new THREE.Mesh(handGeo, matSkin);
  rightHand.position.y = -13 * scale;
  rightHand.castShadow = true;
  rightElbowGroup.add(rightHand);

  // ==========================================
  // 4. LEGS WITH HIP, KNEE & SNEAKER JOINTS
  // ==========================================
  // Left Leg (Pivot at left hip)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.name = "Left_Leg_Group";
  leftLegGroup.position.set(-7.5 * scale, 0, 0); // Attached to bodyGroup
  bodyGroup.add(leftLegGroup);

  // Left Thigh
  const thighGeo = new THREE.CylinderGeometry(5.2 * scale, 4.4 * scale, 22 * scale, 10);
  const leftThigh = new THREE.Mesh(thighGeo, matPants);
  leftThigh.position.y = -11 * scale;
  leftThigh.castShadow = true;
  leftLegGroup.add(leftThigh);

  // Left Knee & Shin
  const leftKneeGroup = new THREE.Group();
  leftKneeGroup.position.y = -22 * scale;
  leftLegGroup.add(leftKneeGroup);

  const shinGeo = new THREE.CylinderGeometry(4.4 * scale, 3.8 * scale, 20 * scale, 10);
  const leftShin = new THREE.Mesh(shinGeo, matPants);
  leftShin.position.y = -10 * scale;
  leftShin.castShadow = true;
  leftKneeGroup.add(leftShin);

  // Left Sneaker
  const leftFootGroup = new THREE.Group();
  leftFootGroup.position.set(0, -20 * scale, 2 * scale);
  leftKneeGroup.add(leftFootGroup);

  const sneakerUpperGeo = new THREE.BoxGeometry(8 * scale, 7 * scale, 17 * scale);
  const leftSneakerUpper = new THREE.Mesh(sneakerUpperGeo, matShoes);
  leftSneakerUpper.position.set(0, 3.5 * scale, 2 * scale);
  leftSneakerUpper.castShadow = true;

  const soleGeo = new THREE.BoxGeometry(8.8 * scale, 3 * scale, 18.5 * scale);
  const leftSole = new THREE.Mesh(soleGeo, matShoeSole);
  leftSole.position.set(0, 1 * scale, 2 * scale);
  leftFootGroup.add(leftSneakerUpper, leftSole);

  // Right Leg (Pivot at right hip)
  const rightLegGroup = new THREE.Group();
  rightLegGroup.name = "Right_Leg_Group";
  rightLegGroup.position.set(7.5 * scale, 0, 0);
  bodyGroup.add(rightLegGroup);

  // Right Thigh
  const rightThigh = new THREE.Mesh(thighGeo, matPants);
  rightThigh.position.y = -11 * scale;
  rightThigh.castShadow = true;
  rightLegGroup.add(rightThigh);

  // Right Knee & Shin
  const rightKneeGroup = new THREE.Group();
  rightKneeGroup.position.y = -22 * scale;
  rightLegGroup.add(rightKneeGroup);

  const rightShin = new THREE.Mesh(shinGeo, matPants);
  rightShin.position.y = -10 * scale;
  rightShin.castShadow = true;
  rightKneeGroup.add(rightShin);

  // Right Sneaker
  const rightFootGroup = new THREE.Group();
  rightFootGroup.position.set(0, -20 * scale, 2 * scale);
  rightKneeGroup.add(rightFootGroup);

  const rightSneakerUpper = new THREE.Mesh(sneakerUpperGeo, matShoes);
  rightSneakerUpper.position.set(0, 3.5 * scale, 2 * scale);
  rightSneakerUpper.castShadow = true;

  const rightSole = new THREE.Mesh(soleGeo, matShoeSole);
  rightSole.position.set(0, 1 * scale, 2 * scale);
  rightFootGroup.add(rightSneakerUpper, rightSole);

  // Initial Rest Poses
  leftArmGroup.rotation.z = 0.08;
  rightArmGroup.rotation.z = -0.08;

  // ==========================================
  // 5. ANIMATION & ROTATION ENGINE
  // ==========================================
  let walkCycle = 0;
  let currentAngle = 0;

  function setDirection(moveX: number, moveZ: number, dt: number) {
    if (Math.hypot(moveX, moveZ) < 0.001) return;
    const targetAngle = Math.atan2(moveX, moveZ);
    let diff = targetAngle - currentAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    currentAngle += diff * Math.min(1, dt * 18);
    pivot.rotation.y = currentAngle;
  }

  function setRotationInstant(angle: number) {
    currentAngle = angle;
    pivot.rotation.y = angle;
  }

  function getCurrentAngle() {
    return currentAngle;
  }

  function updateAnimation(isMoving: boolean, dt: number) {
    const clampedDt = Math.min(0.1, Math.max(0.001, dt));

    if (isMoving) {
      walkCycle += clampedDt * 10.5;

      // 1. Legs swinging back and forth with realistic stride
      const legSwing = Math.sin(walkCycle) * 0.65;
      leftLegGroup.rotation.x = legSwing;
      rightLegGroup.rotation.x = -legSwing;

      // 2. Realistic Knee Bending on backward step
      // Knees bend naturally only when moving backward to lift foot
      leftKneeGroup.rotation.x = Math.max(0, -legSwing * 0.9);
      rightKneeGroup.rotation.x = Math.max(0, legSwing * 0.9);

      // Foot tilt during step
      leftFootGroup.rotation.x = Math.sin(walkCycle) * 0.15;
      rightFootGroup.rotation.x = -Math.sin(walkCycle) * 0.15;

      // 3. Arms swinging opposite to legs with natural elbow flex
      const armSwing = Math.sin(walkCycle) * 0.55;
      leftArmGroup.rotation.x = -armSwing;
      rightArmGroup.rotation.x = armSwing;
      leftElbowGroup.rotation.x = 0.2 + Math.abs(armSwing) * 0.3;
      rightElbowGroup.rotation.x = 0.2 + Math.abs(armSwing) * 0.3;

      // 4. Subtle pelvis bounce and torso twist
      const stepBounce = Math.abs(Math.sin(walkCycle)) * (3.8 * scale);
      bodyGroup.position.y = BASE_BODY_Y + stepBounce;
      bodyGroup.rotation.y = Math.sin(walkCycle) * 0.08;
      bodyGroup.rotation.z = Math.sin(walkCycle) * 0.04;

      // Head counters body tilt
      headGroup.rotation.z = -Math.sin(walkCycle) * 0.03;
      badgeGroup.rotation.x = Math.sin(walkCycle * 2) * 0.25;

      // Shadow pulses subtly with height
      shadowDisc.scale.setScalar(1 - (stepBounce / (50 * scale)));
    } else {
      // Smooth return to relaxed idle breathing stance
      walkCycle += clampedDt * 2.2;
      const breathe = Math.sin(walkCycle) * 0.015;

      leftLegGroup.rotation.x = THREE.MathUtils.lerp(leftLegGroup.rotation.x, 0, clampedDt * 10);
      rightLegGroup.rotation.x = THREE.MathUtils.lerp(rightLegGroup.rotation.x, 0, clampedDt * 10);
      leftKneeGroup.rotation.x = THREE.MathUtils.lerp(leftKneeGroup.rotation.x, 0, clampedDt * 10);
      rightKneeGroup.rotation.x = THREE.MathUtils.lerp(rightKneeGroup.rotation.x, 0, clampedDt * 10);
      leftFootGroup.rotation.x = THREE.MathUtils.lerp(leftFootGroup.rotation.x, 0, clampedDt * 10);
      rightFootGroup.rotation.x = THREE.MathUtils.lerp(rightFootGroup.rotation.x, 0, clampedDt * 10);

      leftArmGroup.rotation.x = THREE.MathUtils.lerp(leftArmGroup.rotation.x, 0.06 + breathe, clampedDt * 8);
      rightArmGroup.rotation.x = THREE.MathUtils.lerp(rightArmGroup.rotation.x, 0.06 + breathe, clampedDt * 8);
      leftArmGroup.rotation.z = THREE.MathUtils.lerp(leftArmGroup.rotation.z, 0.08, clampedDt * 8);
      rightArmGroup.rotation.z = THREE.MathUtils.lerp(rightArmGroup.rotation.z, -0.08, clampedDt * 8);
      leftElbowGroup.rotation.x = THREE.MathUtils.lerp(leftElbowGroup.rotation.x, 0.12, clampedDt * 8);
      rightElbowGroup.rotation.x = THREE.MathUtils.lerp(rightElbowGroup.rotation.x, 0.12, clampedDt * 8);

      bodyGroup.position.y = THREE.MathUtils.lerp(
        bodyGroup.position.y,
        BASE_BODY_Y + Math.sin(walkCycle) * (1.2 * scale),
        clampedDt * 8
      );
      bodyGroup.rotation.y = THREE.MathUtils.lerp(bodyGroup.rotation.y, 0, clampedDt * 8);
      bodyGroup.rotation.z = THREE.MathUtils.lerp(bodyGroup.rotation.z, 0, clampedDt * 8);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, 0, clampedDt * 8);
      headGroup.position.y = BASE_HEAD_Y + Math.sin(walkCycle) * (0.8 * scale);
      badgeGroup.rotation.x = THREE.MathUtils.lerp(badgeGroup.rotation.x, 0, clampedDt * 6);
      shadowDisc.scale.setScalar(1);
    }
  }

  function dispose() {
    // Dispose geometries and materials cleanly
    const geometries = [
      shadowGeo, pelvisGeo, torsoGeo, shirtFrontGeo, trimGeo,
      lanyardStrapGeo, neckGeo, headGeo, faceGeo, earGeo,
      hairTopGeo, bangGeo, shoulderGeo, upperArmGeo, forearmGeo,
      handGeo, thighGeo, shinGeo, sneakerUpperGeo, soleGeo, eyeGlintGeo,
    ];
    for (const g of geometries) g.dispose();

    const materials = [
      shadowMat, matSkin, matJacket, matJacketTrim, matShirt,
      matPants, matShoes, matShoeSole, matHair, matBadge, faceMat, matGlint,
    ];
    for (const m of materials) m.dispose();
    faceTex.dispose();
  }

  return {
    group: rootGroup,
    shadowDisc,
    updateAnimation,
    setDirection,
    setRotationInstant,
    getCurrentAngle,
    dispose,
  };
}
