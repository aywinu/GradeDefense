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

  // Shambler: a tall hooded mourner, leaning forward, faceless but for two
  // pinpoint eyes, robe dissolving into tatters.
  canvasTex(scene, 'ghost', 96, 140, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 140);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(40, 4); // hood peak, tilted forward
    ctx.bezierCurveTo(62, 6, 70, 22, 68, 40); // back of hood
    ctx.bezierCurveTo(80, 48, 86, 70, 84, 96); // shoulder to robe
    ctx.lineTo(90, 134);
    ctx.lineTo(80, 118);
    ctx.lineTo(72, 138);
    ctx.lineTo(62, 116);
    ctx.lineTo(52, 136);
    ctx.lineTo(44, 114);
    ctx.lineTo(34, 132);
    ctx.lineTo(28, 112);
    ctx.lineTo(16, 126);
    ctx.lineTo(18, 92);
    // reaching arm
    ctx.bezierCurveTo(8, 84, 2, 78, 4, 70);
    ctx.bezierCurveTo(12, 70, 18, 74, 22, 72);
    ctx.bezierCurveTo(18, 56, 20, 40, 22, 30);
    ctx.bezierCurveTo(24, 16, 30, 6, 40, 4);
    ctx.fill();
    // Face void inside the hood
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(36, 30, 10, 14, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Pinpoint eyes
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(32, 28, 1.6, 0, Math.PI * 2);
    ctx.arc(39, 27, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Swarmer (quizzes): a cursed torn page, folded like wings, with an ink eye.
  canvasTex(scene, 'imp', 64, 56, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    // left half-page (wing)
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(6, 8);
    ctx.lineTo(9, 16);
    ctx.lineTo(4, 22);
    ctx.lineTo(10, 30);
    ctx.lineTo(6, 38);
    ctx.lineTo(32, 42);
    ctx.closePath();
    ctx.fill();
    // right half-page
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(58, 6);
    ctx.lineTo(55, 15);
    ctx.lineTo(61, 22);
    ctx.lineTo(55, 29);
    ctx.lineTo(59, 37);
    ctx.lineTo(32, 42);
    ctx.closePath();
    ctx.fill();
    // ruled lines and an eye, cut out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    for (let y = 16; y < 40; y += 5) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(29, y + 2);
      ctx.moveTo(35, y + 2);
      ctx.lineTo(54, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(32, 30, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(32, 30, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Boss (exams): a tall crowned wraith in a long shroud, skeletal hands, eye slits.
  canvasTex(scene, 'wraith', 200, 240, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    // crown of thorns
    ctx.beginPath();
    ctx.moveTo(70, 48);
    const spikes = [62, 74, 86, 100, 114, 126, 138];
    spikes.forEach((x, i) => {
      ctx.lineTo(x, i % 2 ? 22 : 6 + Math.abs(3 - i) * 4);
      ctx.lineTo(x + 6, 40);
    });
    ctx.lineTo(132, 48);
    ctx.closePath();
    ctx.fill();
    // hood + shroud
    ctx.beginPath();
    ctx.moveTo(100, 30);
    ctx.bezierCurveTo(136, 32, 146, 60, 142, 86);
    ctx.bezierCurveTo(166, 100, 176, 150, 172, 196);
    ctx.lineTo(184, 238);
    ctx.lineTo(160, 214);
    ctx.lineTo(146, 240);
    ctx.lineTo(128, 212);
    ctx.lineTo(112, 240);
    ctx.lineTo(96, 210);
    ctx.lineTo(80, 238);
    ctx.lineTo(66, 210);
    ctx.lineTo(50, 236);
    ctx.lineTo(38, 206);
    ctx.lineTo(18, 232);
    ctx.lineTo(28, 190);
    ctx.bezierCurveTo(24, 150, 34, 104, 58, 86);
    ctx.bezierCurveTo(54, 60, 64, 32, 100, 30);
    ctx.fill();
    // skeletal hands reaching forward (left side)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    [[40, 128], [46, 146]].forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.moveTo(62, hy - 6);
      ctx.lineTo(hx, hy);
      for (let f = -2; f <= 2; f++) {
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 14, hy + f * 4 - 2);
      }
      ctx.stroke();
    });
    // face void and burning eye slits
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(98, 70, 22, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(84, 66);
    ctx.lineTo(96, 70);
    ctx.lineTo(85, 72);
    ctx.closePath();
    ctx.moveTo(112, 66);
    ctx.lineTo(100, 70);
    ctx.lineTo(111, 72);
    ctx.closePath();
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
