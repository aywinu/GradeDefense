/**
 * Procedural textures (no raster assets): soft glows, sparks, motes, scroll
 * paper and wisps, all drawn on canvases once at boot.
 */
import Phaser from 'phaser';

function radial(
  scene: Phaser.Scene,
  key: string,
  size: number,
  stops: Array<[number, string]>,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

function canvasTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

export function createTextures(scene: Phaser.Scene): void {
  // White soft glow, tinted at use.
  radial(scene, 'glow', 128, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.55)'],
    [0.6, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  radial(scene, 'glow-soft', 256, [
    [0, 'rgba(255,255,255,0.6)'],
    [0.5, 'rgba(255,255,255,0.15)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  radial(scene, 'mote', 16, [
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,255,255,0.6)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  canvasTex(scene, 'spark', 32, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 32, 4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(16, 4, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Wisp: a soft teardrop used for ghost trails and soul bolts.
  canvasTex(scene, 'wisp', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(40, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 32, 30, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Torn scroll used for enemy labels.
  canvasTex(scene, 'scroll', 256, 56, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, '#efe2c4');
    g.addColorStop(1, '#cbb88f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 6);
    for (let x = 8; x <= 248; x += 12) ctx.lineTo(x, 6 + ((x * 7) % 5) - 2);
    ctx.lineTo(250, 28);
    for (let x = 248; x >= 8; x -= 12) ctx.lineTo(x, 50 + ((x * 3) % 5) - 2);
    ctx.lineTo(6, 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Rolled ends
    for (const x of [8, 248]) {
      const rg = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      rg.addColorStop(0, '#8a7350');
      rg.addColorStop(0.5, '#e8d6ae');
      rg.addColorStop(1, '#8a7350');
      ctx.fillStyle = rg;
      ctx.fillRect(x - 6, 2, 12, 52);
    }
  });

  // Ghost body: hooded silhouette with tattered hem; tinted per course.
  canvasTex(scene, 'ghost', 96, 120, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(48, 6);
    ctx.bezierCurveTo(84, 6, 90, 40, 88, 70);
    ctx.lineTo(90, 112);
    ctx.lineTo(78, 98);
    ctx.lineTo(68, 116);
    ctx.lineTo(56, 100);
    ctx.lineTo(46, 118);
    ctx.lineTo(36, 100);
    ctx.lineTo(24, 116);
    ctx.lineTo(16, 98);
    ctx.lineTo(6, 112);
    ctx.lineTo(8, 70);
    ctx.bezierCurveTo(6, 40, 12, 6, 48, 6);
    ctx.fill();
    // Hollow eyes
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(36, 44, 6, 9, -0.15, 0, Math.PI * 2);
    ctx.ellipse(60, 44, 6, 9, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(48, 68, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Swarmer: small wisp-bat shape.
  canvasTex(scene, 'imp', 64, 48, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.quadraticCurveTo(18, 2, 2, 10);
    ctx.quadraticCurveTo(12, 18, 10, 28);
    ctx.quadraticCurveTo(20, 22, 26, 30);
    ctx.quadraticCurveTo(32, 40, 38, 30);
    ctx.quadraticCurveTo(44, 22, 54, 28);
    ctx.quadraticCurveTo(52, 18, 62, 10);
    ctx.quadraticCurveTo(46, 2, 32, 14);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(28, 20, 2.5, 0, Math.PI * 2);
    ctx.arc(36, 20, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Boss: horned, crowned wraith (tinted crimson/course).
  canvasTex(scene, 'wraith', 200, 220, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(100, 30);
    ctx.lineTo(70, 6);
    ctx.lineTo(76, 40);
    ctx.bezierCurveTo(30, 50, 20, 100, 24, 140);
    ctx.lineTo(4, 214);
    ctx.lineTo(40, 180);
    ctx.lineTo(60, 216);
    ctx.lineTo(80, 184);
    ctx.lineTo(100, 220);
    ctx.lineTo(120, 184);
    ctx.lineTo(140, 216);
    ctx.lineTo(160, 180);
    ctx.lineTo(196, 214);
    ctx.lineTo(176, 140);
    ctx.bezierCurveTo(180, 100, 170, 50, 124, 40);
    ctx.lineTo(130, 6);
    ctx.lineTo(100, 30);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(70, 82);
    ctx.lineTo(94, 92);
    ctx.lineTo(72, 100);
    ctx.closePath();
    ctx.moveTo(130, 82);
    ctx.lineTo(106, 92);
    ctx.lineTo(128, 100);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(100, 130, 22, 10, 0, 0, Math.PI);
    ctx.fill();
  });

  // Golem: heavy stone shape for multi-phase projects.
  canvasTex(scene, 'golem', 150, 150, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(110, 14);
    ctx.lineTo(132, 52);
    ctx.lineTo(146, 110);
    ctx.lineTo(118, 146);
    ctx.lineTo(32, 146);
    ctx.lineTo(4, 104);
    ctx.lineTo(16, 50);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(60, 20);
    ctx.lineTo(70, 60);
    ctx.lineTo(50, 90);
    ctx.moveTo(110, 40);
    ctx.lineTo(96, 80);
    ctx.lineTo(120, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(54, 66, 8, 0, Math.PI * 2);
    ctx.arc(96, 66, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Candle flame.
  canvasTex(scene, 'flame', 32, 64, (ctx) => {
    const g = ctx.createRadialGradient(16, 44, 1, 16, 40, 22);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.35, 'rgba(255,210,120,0.95)');
    g.addColorStop(0.75, 'rgba(242,140,50,0.5)');
    g.addColorStop(1, 'rgba(242,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.bezierCurveTo(28, 26, 28, 58, 16, 60);
    ctx.bezierCurveTo(4, 58, 4, 26, 16, 2);
    ctx.fill();
  });
}
