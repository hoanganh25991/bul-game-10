import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { COLOR } from "./constants.js";
import { HERO_MODEL_URL } from "./config.js";

// Creates the Zeus character mesh (placeholder geometry with optional GLTF replacement if ?model=URL).
// Note: This function does NOT add the mesh to the scene; caller should add it.
export function createZeusMesh() {
  const root = new THREE.Group();

  // Torso
  const torsoGeo = new THREE.CapsuleGeometry(0.75, 1.25, 6, 14);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: COLOR.midBlue,
    emissive: 0x0a2a5a,
    metalness: 0.2,
    roughness: 0.55,
  });
  const body = new THREE.Mesh(torsoGeo, torsoMat);
  body.castShadow = true;

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xdbe8ff, emissive: 0x102b5a, roughness: 0.45 })
  );
  head.position.y = 1.75;
  body.add(head);

  // Beard (cone)
  const beard = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0xe6f4ff, emissive: 0x123a6b, roughness: 0.4 })
  );
  beard.position.set(0, 1.35, 0.28);
  beard.rotation.x = Math.PI * 0.05;
  body.add(beard);

  // Laurel crown (thin torus)
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.06, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x2da0ff, metalness: 0.4, roughness: 0.3 })
  );
  crown.position.y = 1.78;
  crown.rotation.x = Math.PI / 2;
  body.add(crown);

  // Shoulder pads
  const shoulderMat = new THREE.MeshStandardMaterial({ color: COLOR.darkBlue, emissive: 0x0a1e3e, metalness: 0.35, roughness: 0.45 });
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), shoulderMat);
  shoulderL.position.set(-0.7, 1.45, 0.1);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.7;
  body.add(shoulderL, shoulderR);

  // Cloak (simple plane)
  const cloak = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.4, 1, 3),
    new THREE.MeshStandardMaterial({ color: 0x0a1f3e, emissive: 0x06152a, side: THREE.DoubleSide, roughness: 0.8 })
  );
  cloak.position.set(0, 1.2, -0.45);
  cloak.rotation.x = Math.PI;
  body.add(cloak);

  // Right hand thunder (no weapon)
  const arm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.6, 6, 10),
    new THREE.MeshStandardMaterial({ color: COLOR.midBlue, emissive: 0x0a2a5a, roughness: 0.55 })
  );
  arm.position.set(0.65, 1.3, 0.15);
  arm.rotation.z = -Math.PI * 0.25;
  // add arms to root so they remain visible in first-person (we'll hide torso separately)
  root.add(arm);

  const handAnchor = new THREE.Object3D();
  handAnchor.position.set(0.85, 1.15, 0.25);
  root.add(handAnchor);

  // left hand anchor for first-person centering (no VFX by default)
  const leftHandAnchor = new THREE.Object3D();
  leftHandAnchor.position.set(-0.85, 1.15, 0.25);
  root.add(leftHandAnchor);

  // Left hand thunder orb + light (for FP two-hands effect)
  const leftThunderOrb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({ color: COLOR.blue, emissive: 0x2da0ff, emissiveIntensity: 2.0, roughness: 0.15, metalness: 0.1 })
  );
  leftHandAnchor.add(leftThunderOrb);
  const leftHandLight = new THREE.PointLight(0x66b3ff, 1.0, 18, 2);
  leftHandAnchor.add(leftHandLight);

  const thunderOrb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({ color: COLOR.blue, emissive: 0x2da0ff, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.1 })
  );
  handAnchor.add(thunderOrb);

  const handLight = new THREE.PointLight(0x66b3ff, 1.3, 20, 2);
  handAnchor.add(handLight);
  // expose for idle pulse control
  root.userData.handLight = handLight;
  root.userData.thunderOrb = thunderOrb;
  // expose left-hand VFX too
  root.userData.leftHandLight = leftHandLight;
  root.userData.leftThunderOrb = leftThunderOrb;

  // Left arm (symmetric)
  const armL = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.6, 6, 10),
    new THREE.MeshStandardMaterial({ color: COLOR.midBlue, emissive: 0x0a2a5a, roughness: 0.55 })
  );
  armL.position.set(-0.65, 1.3, 0.15);
  armL.rotation.z = Math.PI * 0.25;
  root.add(armL);
  // expose arms for FP gesture animation
  root.userData.rightArm = arm;
  root.userData.leftArm = armL;

  // Biceps bulges
  const bicepR = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 14),
    new THREE.MeshStandardMaterial({ color: COLOR.midBlue, emissive: 0x0a2a5a, roughness: 0.55 })
  );
  bicepR.position.set(0.55, 1.45, 0.12);
  const bicepL = bicepR.clone();
  bicepL.position.x = -0.55;
  root.add(bicepR, bicepL);

  // Tunic (waist cloth)
  const tunic = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.9, 1.0, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: COLOR.midBlue, emissive: 0x0a1f3e, metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide })
  );
  tunic.position.set(0, 0.6, 0);
  body.add(tunic);

  // Belt
  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.06, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2da0ff, metalness: 0.5, roughness: 0.2 })
  );
  belt.position.y = 1.0;
  body.add(belt);

  // Hair cap
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x13233a, emissive: 0x091529, roughness: 0.65 })
  );
  hairCap.position.set(0, 0.18, 0); // relative to head
  head.add(hairCap);

  // Small ponytail
  const pony = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0x13233a, emissive: 0x091529 })
  );
  pony.position.set(0, -0.2, -0.25);
  pony.rotation.x = Math.PI * 0.9;
  head.add(pony);

  // expose hand anchors for VFX and first-person view
  root.userData = root.userData || {};
  root.userData.handAnchor = handAnchor;
  root.userData.leftHandAnchor = leftHandAnchor;
  // parts to hide when entering first-person so only two hands are visible
  root.userData.fpHide = [
    body,
    head,
    cloak,
    tunic,
    belt,
    shoulderL,
    shoulderR,
    bicepR,
    bicepL,
    beard,
    crown,
    hairCap,
    pony
  ];

  // Assemble placeholder into root
  root.add(body);

  // Optional: load external Zeus GLTF model (pass ?model=URL)
  if (HERO_MODEL_URL) {
    const loader = new GLTFLoader();
    loader.load(
      HERO_MODEL_URL,
      (gltf) => {
        const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (model) {
          model.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          // Normalize model height to ~2.2 world units
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const targetHeight = 2.2;
          const s = size.y > 0 ? targetHeight / size.y : 1;
          model.scale.setScalar(s);
          model.position.set(0, 0, 0);
          root.add(model);
          // Hide placeholder body
          body.visible = false;
        }
      },
      undefined,
      (err) => {
        console.warn("Failed to load HERO_MODEL_URL:", HERO_MODEL_URL, err);
      }
    );
  }

  root.position.set(10, 1.1, 10);
  return root;
}

 // Enemy body with single eye detail
 export function createEnemyMesh(options = {}) {
   const color = options.color !== undefined ? options.color : COLOR.enemyDark;
   const eyeEmissive = options.eyeEmissive !== undefined ? options.eyeEmissive : 0x550000;

   const geo = new THREE.CapsuleGeometry(0.6, 0.8, 4, 10);
   const mat = new THREE.MeshStandardMaterial({ color: color, emissive: 0x2a0a0a, roughness: 0.7 });
   const mesh = new THREE.Mesh(geo, mat);
   mesh.castShadow = true;

   const eye = new THREE.Mesh(
     new THREE.SphereGeometry(0.18, 12, 12),
     new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: eyeEmissive })
   );
   eye.position.set(0, 1.2, 0.45);
   mesh.add(eye);

   return mesh;
 }

// Billboard HP bar parts to attach to enemy mesh
export function createBillboardHPBar() {
  const container = new THREE.Group();
  container.position.set(0, 2.2, 0);

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 })
  );
  container.add(bg);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff4545 })
  );
  fill.position.z = 0.001;
  container.add(fill);

  return { container, fill };
}

// Portal geometry; returns group and ring so caller can animate ring rotation
export function createPortalMesh(color = COLOR.portal) {
  // Outer ring (vertical gate)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.15, 16, 40),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.1,
      metalness: 0.35,
      roughness: 0.25
    })
  );

  // Inner swirl (rotating disc to feel like a gate)
  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  swirl.position.z = 0.02;

  // Soft glow backing
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.position.z = -0.02;

  // Base pedestal
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x0e1e38, metalness: 0.3, roughness: 0.6 })
  );
  base.position.y = -1.1;

  // Portal group
  const group = new THREE.Group();
  group.add(ring);
  group.add(glow);
  group.add(swirl);
  group.add(base);

  // Decorative point light for aura
  const light = new THREE.PointLight(color, 0.9, 12, 2);
  light.position.set(0, 0.4, 0);
  group.add(light);

  // Expose parts for animation
  return { group, ring, swirl, glow };
}

// Simple house composed of a base and roof
export function createHouse() {
  const house = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x15315c, roughness: 0.8 })
  );
  base.position.y = 1.5;
  house.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 2.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x0a1f3e, metalness: 0.2 })
  );
  roof.position.y = 4.1;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);

  return house;
}

// Hero overhead HP/MP dual bars (billboard). Colors use COLOR.hp and COLOR.mp.
export function createHeroOverheadBars() {
  const container = new THREE.Group();
  container.position.set(0, 2.6, 0);

  // Backboard
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.26),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5 })
  );
  container.add(bg);

  // HP (top)
  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.74, 0.1),
    new THREE.MeshBasicMaterial({ color: COLOR.hp })
  );
  hpFill.position.set(0, 0.06, 0.001);
  container.add(hpFill);

  // MP (bottom)
  const mpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.74, 0.1),
    new THREE.MeshBasicMaterial({ color: COLOR.mp })
  );
  mpFill.position.set(0, -0.06, 0.001);
  container.add(mpFill);

  return { container, hpFill, mpFill };
}
