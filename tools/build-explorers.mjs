// Packs the generated explorer models for the game (web/assets/explorers/).
//   node build-explorers.mjs <rawDir> <outDir>
// rawDir holds, per outfit X in a, b, c: X-walk.glb (the Meshy-rigged body with the Casual_Walk clip), and per hairstyle: hair-<name>.glb (hair on a solid red mannequin head).
// Needs: @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp meshoptimizer
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, compactPrimitive, reorder, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [rawDir, outDir] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(outDir, { recursive: true });

async function decode(tex) { return sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true }); }
const sampler = ({ data, info }) => (u, v) => {
  const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height)));
  const o = (y * info.width + x) * info.channels; return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255];
};

async function finish(doc, file) {
  await doc.transform(dedup(), prune(), resample(), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(POSITION|NORMAL|TEXCOORD_\d+|JOINTS_\d+|WEIGHTS_\d+)$/, quantizeNormal: 8, quantizeTexcoord: 12, quantizePosition: 14 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(file, doc);
  console.log(path.basename(file), (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
}

// ---------- bodies ----------
for (const X of fs.readdirSync(rawDir).filter(f => f.endsWith('-walk.glb')).map(f => f.slice(0, -9))) {
  const walk = path.join(rawDir, `${X}-walk.glb`);
  if (!fs.existsSync(walk)) { console.log('skip body', X); continue; }
  // the walk clip only: standing still is posed in code (the catalog idles stretch, dab or hold an arm out)
  const doc = await io.read(walk), root = doc.getRoot();
  root.listAnimations()[0].setName('walk');
  // drop constant translation/scale tracks (only the hips really move)
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) {
    const p = ch.getTargetPath(); if (p === 'rotation' || ch.getTargetNode().getName() === 'Hips' && p === 'translation') continue;
    const o = ch.getSampler().getOutput().getArray(); let same = true; for (let i = 3; i < o.length && same; i++) if (Math.abs(o[i] - o[i % 3]) > 1e-4) same = false;
    if (same) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
  }
  const mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0];
  prim.setAttribute('TANGENT', null);
  // head landmarks (bind pose, metres): the box of everything the Head bone carries
  const skin = root.listSkins()[0], headJ = skin.listJoints().findIndex(j => j.getName() === 'Head');
  const P = prim.getAttribute('POSITION').getArray(), J = prim.getAttribute('JOINTS_0').getArray(), W = prim.getAttribute('WEIGHTS_0').getArray();
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let hipsY = 0;
  for (let i = 0; i < P.length / 3; i++) {
    let dom = 0, best = -1; for (let k = 0; k < 4; k++) if (W[i * 4 + k] > best) { best = W[i * 4 + k]; dom = J[i * 4 + k]; }
    if (dom !== headJ) continue; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], P[i * 3 + a]); mx[a] = Math.max(mx[a], P[i * 3 + a]); }
  }
  let yMin = 1e9, yMax = -1e9; for (let i = 1; i < P.length; i += 3) { yMin = Math.min(yMin, P[i]); yMax = Math.max(yMax, P[i]); }
  const node = root.listNodes().find(n => n.getMesh() === mesh);
  node.setExtras({ explorer: { head: { min: mn, max: mx }, height: [yMin, yMax] } });
  // a 1024 texture is plenty for a character this size on a phone
  const tex = root.listTextures()[0];
  tex.setImage(new Uint8Array(await sharp(Buffer.from(tex.getImage())).resize(1024, 1024).jpeg({ quality: 86, mozjpeg: true }).toBuffer())).setMimeType('image/jpeg');
  await finish(doc, path.join(outDir, `body-${X}.glb`));
}

// ---------- hairstyles ----------
const YAW = { spiky: 0, goatee: 90 }; // degrees about y; the rest are -90 (the goatee came out facing the other way)
for (const f of fs.readdirSync(rawDir).filter(f => /^(hair|beard|hat|shoe)-.*\.glb$/.test(f))) {
  const isBeard = f.startsWith('beard-'), skin = []; // beards: the mannequin's skin, to measure how far each tuft stands off it
  const doc = await io.read(path.join(rawDir, f)), root = doc.getRoot();
  // turn the piece to face +z (Tripo's models face +x)
  const yaw = (YAW[f.replace(/^(hair|beard|hat|shoe)-/, '').slice(0, -4)] ?? -90) * Math.PI / 180, qy = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  if (yaw) for (const n of root.listScenes()[0].listChildren()) { const t = n.getTranslation(), c = Math.cos(yaw), sn = Math.sin(yaw); n.setTranslation([t[0] * c + t[2] * sn, t[1], -t[0] * sn + t[2] * c]); n.setRotation(qmul(qy, n.getRotation())); }
  const tex = root.listTextures()[0], img = await decode(tex), at = sampler(img);
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], lums = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray(), I = prim.getIndices().getArray(), keep = [];
      const wp = i => { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]]; };
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], b = I[t + 1], c = I[t + 2];
        // the colour in the middle of the triangle and halfway to each corner: red means mannequin
        let red = 0; const S = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
        let lsum = 0;
        for (const [wa, wb, wc] of S) {
          const [r, g, bb] = at(UV[a * 2] * wa + UV[b * 2] * wb + UV[c * 2] * wc, UV[a * 2 + 1] * wa + UV[b * 2 + 1] * wb + UV[c * 2 + 1] * wc);
          if (r > 0.3 && r > g * 1.7 && r > bb * 1.7) red++; lsum += 0.3 * r + 0.59 * g + 0.11 * bb;
        }
        if (red >= 2) { for (const v of [a, b, c]) { const p = wp(v); if (isBeard) skin.push(p); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } } }
        else { keep.push(a, b, c); lums.push(lsum / 4); }
      }
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)));
      compactPrimitive(prim);
      prim.setAttribute('TANGENT', null);
    }
  }
  // greyscale texture, levelled so the hair's typical tone is a light grey: the game tints it any colour
  lums.sort((p, q) => p - q); const med = lums[Math.floor(lums.length / 2)] || 0.6, gain = 0.8 / med;
  const g = await sharp(Buffer.from(tex.getImage())).resize(512, 512).greyscale().linear(gain, 0).jpeg({ quality: 85 }).toBuffer();
  tex.setImage(new Uint8Array(g)).setMimeType('image/jpeg');
  root.listScenes()[0].setExtras({ mannequin: { min: mn, max: mx } });
  if (isBeard) {
    // how far each vertex stands off the mannequin's skin, along the line from a point inside the head at mouth height:
    // the game rebuilds the beard on its own faces with these offsets, so it sits on any jaw without sinking or floating
    const C = [(mn[0] + mx[0]) / 2, mn[1] + 0.42 * (mx[1] - mn[1]), (mn[2] + mx[2]) / 2], AZ = 72, EL = 48, R = new Float32Array(AZ * EL);
    const bin = d => { const r = Math.hypot(d[0], d[1], d[2]) || 1e-9, az = Math.atan2(d[0], d[2]), el = Math.asin(Math.max(-1, Math.min(1, d[1] / r)));
      return Math.min(AZ - 1, Math.floor((az + Math.PI) / (2 * Math.PI) * AZ)) + Math.min(EL - 1, Math.floor((el + Math.PI / 2) / Math.PI * EL)) * AZ; };
    for (const p of skin) { const d = [p[0] - C[0], p[1] - C[1], p[2] - C[2]], k = bin(d); R[k] = Math.max(R[k], Math.hypot(...d)); }
    for (let pass = 0; pass < 6; pass++) for (let k = 0; k < R.length; k++) if (!R[k]) { const a = k % AZ, e = Math.floor(k / AZ); let s2 = 0, n2 = 0; for (const [da, de] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const e2 = e + de; if (e2 < 0 || e2 >= EL) continue; const v = R[(a + da + AZ) % AZ + e2 * AZ]; if (v) { s2 += v; n2++; } } if (n2) R[k] = s2 / n2; }
    for (const node of root.listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const P = prim.getAttribute('POSITION').getArray(), off = new Float32Array(P.length / 3);
        for (let i = 0; i < off.length; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; const p = [M[0] * x + M[4] * y + M[8] * z + M[12] - C[0], M[1] * x + M[5] * y + M[9] * z + M[13] - C[1], M[2] * x + M[6] * y + M[10] * z + M[14] - C[2]]; off[i] = Math.hypot(...p) - (R[bin(p)] || Math.hypot(...p)); }
        prim.setAttribute('_OFFSET', doc.createAccessor().setType('SCALAR').setArray(off));
      }
    }
    console.log('  beard skin points', skin.length, 'centre', C.map(v => v.toFixed(3)).join(','));
  }
  await doc.transform(weld());
  await finish(doc, path.join(outDir, f));
  console.log('  mannequin head', mn.map(v => v.toFixed(3)).join(','), '→', mx.map(v => v.toFixed(3)).join(','), 'gain', gain.toFixed(2));
}
