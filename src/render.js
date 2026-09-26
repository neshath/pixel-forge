import {drawGardenTile,drawGardenProp,drawGardenWeather,gardenDepth,gardenTheme} from './garden.js';
import { palettes,collisionAt } from './model.js';

const biomeFamilies = {
  jungle: 'forest', ruins: 'forest', temple: 'forest', haunted: 'forest',
  factory: 'city', lab: 'city', desert: 'lava', coast: 'ice', crystal: 'ice'
};

function scenePalette(scene) {
  return palettes[scene.biome] || palettes[biomeFamilies[scene.biome]] || palettes.forest;
}

function pixelPen(c, x, y, p) {
  return (a, b, w, h, color) => {
    c.fillStyle = p[color] || color;
    c.fillRect(x + a, y + b, w, h);
  };
}

// Rotation is in degrees; flips and scale use the visual center as their pivot.
function aroundCenter(c, x, y, w, h, transform, paint) {
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.rotate((Number(transform.rotation) || 0) * Math.PI / 180);
  const size = Number.isFinite(transform.scale) ? transform.scale : 1;
  c.scale((transform.flipX ? -1 : 1) * size, (transform.flipY ? -1 : 1) * size);
  c.translate(-w / 2, -h / 2);
  paint();
  c.restore();
}

// Optional adjacency preserves compatibility with existing six-argument calls.
export function drawTile(c, id, x, y, p = palettes.forest, phase = 0, edges = {}) {
  if([19,20,21].includes(id)){drawGardenTile(c,id,x,y,phase,edges);return;}
  const r = pixelPen(c, x, y, p);
  if (id <= 10) {
    if ((id === 1 || id === 2) && edges.top === false) {
      r(0, 0, 16, 16, 8);
      r(0, 12, 16, 1, 9);
    } else drawLegacyTile(c, id, x, y, p, phase);
    return;
  }
  switch (id) {
    case 11:
      r(0, 0, 16, 16, '#507f9d');
      r(0, 3, 16, 12, '#83b8cd');
      r(3, 6, 2, 6, '#a8d8df');
      r(5, 4, 2, 5, '#a8d8df');
      if (edges.top !== false) {
        r(0, 0, 16, 3, '#eef7eb');
        r(0, 3, 16, 1, '#c9e9eb');
      }
      break;
    case 12:
      r(0, 0, 16, 16, 8); r(1, 1, 14, 14, 10); r(1, 1, 14, 2, 11);
      r(8, 3, 2, 4, 8); r(6, 7, 3, 2, 8); r(9, 9, 2, 6, 8);
      r(3, 10, 4, 2, 9);
      break;
    case 13:
    case 14:
      for (let col = 0; col < 16; col++) {
        const top = id === 13 ? 15 - col : col;
        r(col, top, 1, 16 - top, 8);
        r(col, top, 1, Math.min(3, 16 - top), 6);
        r(col, top, 1, 1, 7);
      }
      break;
    case 15:
      r(0, 0, 16, 3, 10); r(0, 13, 16, 3, 10);
      for (let col = 2; col < 16; col += 5) {
        r(col, 3, 2, 10, 11); r(col + 2, 3, 1, 10, 8);
      }
      r(6, 6, 5, 5, 8); r(8, 7, 1, 3, 14);
      break;
    case 16:
      r(0, 3, 16, 13, '#b6423e'); r(0, 3, 16, 3, '#ffd17b');
      r(0, 6, 16, 2, '#f88948');
      r((phase % 2) * 4, 10, 6, 2, '#ef713b');
      r(10 - (phase % 2) * 3, 14, 4, 1, '#ffb65a');
      break;
    case 17:
      r(0, 0, 16, 16, '#b68158'); r(0, 3, 16, 10, '#ce9d67');
      if (edges.top !== false) {
        r(0, 0, 16, 2, '#f1d79c'); r(0, 2, 16, 2, '#e3bc7d');
      }
      r(0, 12, 16, 1, '#c28e5d');
      break;
    case 18:
      r(7, 0, 2, 16, 5); r(8, 0, 1, 16, 6);
      r(3, 2, 4, 3, 4); r(2, 1, 3, 2, 6);
      r(9, 7, 4, 3, 4); r(11, 6, 3, 2, 6); r(4, 12, 3, 3, 5);
      break;
  }
}

function frameIndex(sprite, entity, time) {
  const count = sprite.frames.length;
  const state = entity.runtime || entity.animationState || {};
  const explicit = entity.frameIndex ?? entity.spriteFrame ?? entity.frame ?? state.frameIndex ?? state.frame;
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(count - 1, Math.floor(explicit)));
  const tick = Math.floor(Math.max(0, time) * 1000 / Math.max(1, Number(sprite.timing) || 160));
  if (sprite.mode === 'one-shot' || sprite.mode === 'once') return Math.min(count - 1, tick);
  if (sprite.mode === 'ping-pong' && count > 1) {
    const phase = tick % (2 * count - 2);
    return phase < count ? phase : 2 * count - 2 - phase;
  }
  return tick % count;
}

function paintSprite(c, sprite, entity, p, time) {
  const frame = sprite.frames[frameIndex(sprite, entity, time)];
  if (!frame) return;
  // Coalesce runs of equal pixels, including transparency.
  for (let y = 0; y < sprite.size; y++) {
    for (let x = 0; x < sprite.size;) {
      const color = frame[y * sprite.size + x];
      let end = x + 1;
      while (end < sprite.size && frame[y * sprite.size + end] === color) end++;
      if (color !== null && color !== undefined && color !== '') {
        c.fillStyle = typeof color === 'number' ? p[color] : color;
        c.fillRect(x, y, end - x, 1);
      }
      x = end;
    }
  }
}

function paintExtraEntity(c, e, p, time) {
  const r = pixelPen(c, 0, 0, p);
  const lit = e.active || e.on ? 6 : 14;
  switch (e.type) {
    case 'key':
      r(1, 3, 7, 7, 8); r(2, 2, 5, 2, 13); r(2, 4, 5, 5, 14);
      r(3, 5, 3, 2, 0); r(7, 6, 7, 2, 14); r(10, 8, 2, 3, 14); r(13, 8, 2, 2, 14);
      break;
    case 'switch':
      r(1, 12, 14, 4, 8); r(2, 12, 12, 1, 11);
      r(e.active ? 9 : 5, 5, 2, 8, 11); r(e.active ? 8 : 3, 3, 5, 4, lit);
      r(4, 14, 3, 1, lit);
      break;
    case 'npc':
      r(2, 5, 12, 10, 0); r(4, 1, 8, 7, 13); r(3, 0, 10, 3, 10);
      r(7, 4, 1, 2, 0); r(10, 4, 1, 2, 0); r(3, 8, 10, 6, 5);
      r(6, 8, 4, 2, 7); r(4, 14, 3, 2, 9); r(10, 14, 3, 2, 9); r(14, 6, 1, 10, 11);
      break;
    case 'trigger':
      r(1, 10, 14, 4, 8); r(2, 10, 12, 2, lit);
      r(4, 7, 8, 2, 12); r(6, 4, 4, 2, 12);
      break;
    case 'transition':
      r(1, 2, 3, 14, 10); r(12, 2, 3, 14, 10); r(4, 0, 8, 3, 11);
      r(5, 4, 6, 10, 2); r(6, 7, 4, 2, 12);
      r(9, 5, 2, 6, 13); r(11, 7, 2, 2, 13);
      break;
    case 'savepoint':
      r(1, 13, 14, 3, 9); r(4, 11, 8, 2, 11);
      r(6, 3, 4, 7, 12); r(4, 5, 8, 3, 12); r(7, 2, 2, 7, 13);
      r(2, 2, 2, 2, lit); r(12, 4, 2, 2, lit);
      break;
    case 'hazard':
      r(6, 0, 4, 16, 8); r(0, 6, 16, 4, 8);
      r(3, 3, 10, 10, 15); r(5, 5, 6, 6, 0); r(7, 6, 2, 4, 14);
      break;
    case 'emitter':
      r(2, 10, 12, 6, 8); r(4, 7, 8, 5, 10); r(5, 7, 6, 2, 11);
      r(6, 3, 4, 3, 12); r(7, Math.floor(time * 3) % 2, 2, 2, 13);
      break;
    case 'platform': {
      const w = e.w || 32;
      r(0, 0, w, 3, 7); r(0, 3, w, 3, 9);
      r(2, 6, 3, 3, 8); r(w - 5, 6, 3, 3, 8);
      break;
    }
    case 'breakable':
      drawTile(c, 12, 0, 0, p);
      r(2, 3, 2, 10, 11); r(12, 3, 2, 10, 9);
      break;
    case 'boss':
      // Crowned furnace beetle, with a pale mask and broad claw silhouette.
      r(3, 7, 26, 20, 0); r(5, 5, 22, 18, 15);
      r(2, 1, 4, 9, 11); r(26, 1, 4, 9, 11);
      r(10, 3, 12, 3, 14); r(13, 0, 6, 4, 14);
      r(8, 9, 16, 10, 13); r(10, 11, 4, 3, 0); r(18, 11, 4, 3, 0);
      r(13, 17, 6, 2, 8); r(0, 13, 6, 12, 9); r(26, 13, 6, 12, 9);
      r(5, 26, 8, 5, 10); r(19, 26, 8, 5, 10);
      break;
    default:
      drawLegacyEntity(c, { ...e, x: 0, y: 0 }, p, time);
  }
}

export function drawEntity(c, e, p = palettes.forest, time = 0, options = {}) {
  if(e.type==='prop'){drawGardenProp(c,e,time);return;}
  if (e.visible === false || e.dead) return;
  const custom = options.customSprite || options.project?.sprite;
  const sprite = e.spriteId === 'custom'
    ? custom
    : options.assetMap?.get(e.spriteId) || options.assets?.find(a => a.id === e.spriteId);
  const valid = sprite?.size > 0 && sprite.frames?.length > 0;
  const w = valid ? sprite.size : e.type === 'boss' ? 32 : e.w || 16;
  const h = valid ? sprite.size : e.type === 'boss' ? 32 : e.h || 16;
  aroundCenter(c, Math.round(e.x), Math.round(e.y), w, h, e, () => {
    if (valid) paintSprite(c, sprite, e, p, time);
    else paintExtraEntity(c, e, p, time);
  });
}

function pixelPolygon(c, points, color) {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fill();
}

// Original authored silhouettes. Repetition is structural, never random noise.
export function background(c, s, ox, oy, scale, w, h, time = 0) {
  const p = scenePalette(s), biome = s.biome || 'forest';
  c.save();
  c.fillStyle = p[0];
  c.fillRect(0, 0, w, h);
  c.scale(scale, scale);
  const vw = w / scale, vh = h / scale;
  const r = pixelPen(c, 0, 0, p), family = biomeFamilies[biome] || biome;
  r(Math.floor(vw * .7), 22, 26, 26, 1);
  r(Math.floor(vw * .7) + 4, 18, 18, 34, 1);
  for (let depth = 0; depth < 3; depth++) {
    const spacing = 112 - depth * 12;
    const offset = ((ox / scale * (.12 + depth * .13)) % spacing + spacing) % spacing;
    const base = Math.floor(vh * (.48 + depth * .2) - oy / scale * .06);
    const ink = p[depth + 1];
    for (let i = -1; i <= Math.ceil(vw / spacing) + 1; i++) {
      const x = Math.floor(i * spacing - offset);
      if (['city', 'factory', 'lab'].includes(biome)) {
        r(x, base - 62, 36, vh, ink); r(x + 4, base - 70, 28, 8, ink);
        r(x + 42, base - 38, 48, vh, ink);
        if (biome === 'factory') {
          r(x + 48, base - 77, 9, 40, ink); r(x + 71, base - 59, 7, 22, ink);
          r(x + 20, base - 20, 65, 5, ink);
        } else if (biome === 'lab') {
          r(x + 47, base - 31, 34, 3, p[depth + 2]);
          r(x + 58, base - 27, 3, 30, p[depth + 2]);
        } else {
          for (let row = 0; row < 3; row++) {
            r(x + 7, base - 55 + row * 14, 3, 5, p[depth + 2]);
            r(x + 23, base - 55 + row * 14, 3, 5, p[depth + 2]);
          }
        }
      } else if (['ruins', 'temple', 'haunted'].includes(biome)) {
        const roof = biome === 'haunted' ? 70 : 45;
        r(x + 12, base - roof, 12, vh, ink); r(x + 64, base - roof, 12, vh, ink);
        r(x + 8, base - roof, 72, 9, ink);
        if (biome === 'temple') {
          for (let step = 0; step < 4; step++) {
            r(x + 8 + step * 7, base - roof - step * 6, 72 - step * 14, 6, ink);
          }
        } else if (biome === 'haunted') {
          pixelPolygon(c, [[x, base - roof], [x + 43, base - 110], [x + 86, base - roof]], ink);
          r(x + 36, base - 55, 12, 24, ink);
        } else {
          r(x + 35, base - 15, 23, vh, ink); r(x + 33, base - 20, 28, 5, ink);
        }
      } else if (biome === 'desert' || biome === 'coast') {
        pixelPolygon(c, [[x - 10, vh], [x - 10, base + 16], [x + 20, base + 10],
          [x + 42, base], [x + 64, base], [x + 100, base + 16], [x + 120, vh]], ink);
        if (biome === 'coast') {
          r(x + 8, base + 28, 60, 1, p[depth + 2]);
          r(x + 40, base + 40, 43, 1, p[depth + 2]);
        } else if (depth === 1) {
          r(x + 30, base - 20, 5, 26, ink);
          r(x + 21, base - 12, 12, 4, ink); r(x + 21, base - 19, 4, 9, ink);
        }
      } else if (family === 'ice' || family === 'lava') {
        const peak = biome === 'crystal' ? 88 : 60;
        pixelPolygon(c, [[x, vh], [x + 8, base], [x + 34, base - peak],
          [x + 49, base - peak + 18], [x + 76, base], [x + 100, vh]], ink);
        if (family === 'ice') {
          pixelPolygon(c, [[x + 34, base - peak], [x + 49, base - peak + 18],
            [x + 53, base - 25], [x + 34, base - 36]], p[depth + 2]);
        } else {
          r(x + 30, base - 40, 4, 27, p[depth + 2]); r(x + 34, base - 15, 6, 21, p[depth + 2]);
        }
      } else {
        r(x + 42, base - 90, 13, vh, ink); r(x + 35, base + 35, 26, vh, ink);
        r(x + 15, base - 46, 66, 9, ink); r(x + 15, base - 62, 7, 22, ink);
        r(x + 74, base - 76, 7, 35, ink);
        r(x + 7, base - 92, 84, 15, ink); r(x + 18, base - 104, 63, 15, ink);
        r(x + 32, base - 111, 38, 10, ink);
        if (biome === 'jungle') {
          r(x + 13, base - 78, 2, 52, ink);
          r(x + 17, base - 29, 14, 2, ink); r(x + 31, base - 29, 2, 23, ink);
        }
      }
    }
  }
  c.restore();
}

function defaultSolid(id) {
  return [1, 2, 3, 4, 11, 12, 13, 14, 15, 17].includes(id);
}

export function drawScene(c, s, options = {}) {
  let {
    x = 0, y = 0, scale = 1, width = c.canvas.width, height = c.canvas.height,
    grid = false, collisions = false, camera = false, selected = null,
    time = 0, entities = s.entities || [], paths = false
  } = options;
  if (!(scale > 0)) return;
  if(s.garden?.animate===false)time=0;
  const themedGarden=gardenTheme(s.biome),willowmereWater=gardenTheme('watergarden');
  const gardenStyle={...themedGarden,water:willowmereWater.water,light:willowmereWater.light,deep:willowmereWater.deep,...(s.garden?.packId===s.biome||s.biome==='watergarden'?s.garden:{})};
  const p = scenePalette(s), layers = s.layers || [];
  c.save();
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, width, height);
  // Every project has a background layer for editable tiles, but an empty layer
  // must not suppress the procedural biome backdrop behind the tilemap.
  if(!s.garden)background(c, s, -x, -y, scale, width, height, time);
  const left = Math.max(0, Math.floor(-Math.round(x) / scale / 16));
  const top = Math.max(0, Math.floor(-Math.round(y) / scale / 16));
  const right = Math.min(s.width - 1, Math.floor((width - Math.round(x)) / scale / 16));
  const bottom = Math.min(s.height - 1, Math.floor((height - Math.round(y)) / scale / 16));
  const metadata = options.tileMetadata || options.tiles;
  const solid = id => {
    const entry = Array.isArray(metadata) ? metadata.find(t => t.id === id) : metadata?.[id];
    return entry ? !!entry.solid : defaultSolid(id);
  };
  const assetMap = new Map((options.assets || options.project?.assets || []).map(a => [a.id, a]));
  const entityOptions = { ...options, assetMap };
  const world = paint => {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
    paint();
    c.restore();
  };
  const eachCell = callback => {
    for (let b = top; b <= bottom; b++) {
      for (let a = left; a <= right; a++) callback(a, b, a + ',' + b);
    }
  };
  const paintEntities = () => {
    if(s.garden){
      for(const e of entities)if(e.type==='prop'&&e.propKind==='bridge')drawGardenProp(c,e,time,'back',{...gardenTheme(e.packId||s.biome),weather:s.garden?.weather});
      for(const e of [...entities].sort((a,b)=>gardenDepth(a)-gardenDepth(b))){
        if(e.type==='prop'){drawGardenProp(c,e,time,e.propKind==='bridge'?'front':'all',{...gardenTheme(e.packId||s.biome),weather:s.garden?.weather});continue;}
        const bridge=entities.find(b=>b.type==='prop'&&b.propKind==='bridge'&&b.visible!==false&&e.x+e.w/2>=b.x&&e.x+e.w/2<b.x+b.w&&e.y+e.h>=b.y+8&&e.y+e.h<b.y+b.h-8);
        const lift=bridge?Math.sin((e.x+e.w/2-bridge.x)/bridge.w*Math.PI)*bridge.elevation:0;
        c.save();c.translate(0,-Math.round(lift));drawEntity(c,e,p,time,entityOptions);c.restore();
      }return;
    }
    const ordered = s.gameType === '2.5d'
      ? [...entities].sort((a, b) => (a.y + (a.h || 16)) - (b.y + (b.h || 16)))
      : entities;
    for (const e of ordered) drawEntity(c, e, p, time, entityOptions);
  };
  if(s.garden)world(()=>eachCell((a,b)=>drawGardenTile(c,6,a*16,b*16,time,{},gardenStyle)));
  for (const layer of layers) {
    if (layer.visible === false) continue;
    world(() => {
      const map = layer.tiles || {};
      eachCell((a, b, key) => {
        const id = map[key];
        if (!id) return;
        if(s.garden&&[6,19,20,21].includes(id)){drawGardenTile(c,id,a*16,b*16,time,{bottom:map[a+','+(b+1)]===id,left:map[(a-1)+','+b]===id},gardenStyle);return;}
        const edges = { top: !solid(map[a + ',' + (b - 1)]) };
        const transform = s.tileTransforms?.[key];
        if (transform) {
          aroundCenter(c, a * 16, b * 16, 16, 16, transform,
            () => drawTile(c, id, 0, 0, p, Math.floor(time * 2), edges));
        } else drawTile(c, id, a * 16, b * 16, p, Math.floor(time * 2), edges);
      });
      if (layer.id === 'entities') paintEntities();
    });
  }
  if (!layers.some(l => l.id === 'entities')) world(paintEntities);
  world(() => {
    c.lineWidth = 1 / scale;
    if (grid) {
      c.strokeStyle = '#d9f2d414'; c.beginPath();
      for (let a = left; a <= right + 1; a++) {
        c.moveTo(a * 16, top * 16); c.lineTo(a * 16, (bottom + 1) * 16);
      }
      for (let b = top; b <= bottom + 1; b++) {
        c.moveTo(left * 16, b * 16); c.lineTo((right + 1) * 16, b * 16);
      }
      c.stroke();
    }
    if (collisions) {
      eachCell((a, b, key) => {
        const enabled = s.garden ? collisionAt(s,a,b)>0 : s.collision?.[key] ?? layers.some(l => l.visible !== false && solid(l.tiles?.[key]));
        if (!enabled) return;
        c.fillStyle = '#67f5d238'; c.strokeStyle = '#67f5d2aa';
        c.fillRect(a * 16, b * 16, 16, 16); c.strokeRect(a * 16, b * 16, 16, 16);
      });
    }
    if (paths && layers.find(l => l.id === 'entities')?.visible !== false) {
      c.strokeStyle = '#e5a66c'; c.fillStyle = '#e5a66c'; c.setLineDash([3, 3]);
      for (const e of entities) {
        if (e.visible === false || !Array.isArray(e.path) || !e.path.length) continue;
        c.beginPath(); c.moveTo(e.x + (e.w || 16) / 2, e.y + (e.h || 16) / 2);
        for (const point of e.path) {
          const px = Array.isArray(point) ? point[0] : point.x;
          const py = Array.isArray(point) ? point[1] : point.y;
          if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
          c.lineTo(px, py); c.fillRect(px - 2, py - 2, 4, 4);
        }
        c.stroke();
      }
      c.setLineDash([]);
    }
    if (camera && s.camera) {
      c.strokeStyle = '#ffd481'; c.setLineDash([5, 4]);
      c.strokeRect(s.camera.x, s.camera.y, s.camera.w, s.camera.h); c.setLineDash([]);
    }
    if (selected) {
      const sw = selected.w || 16, sh = selected.h || 16;
      c.strokeStyle = '#f779a4'; c.fillStyle = '#f779a4';
      c.strokeRect(selected.x - 2, selected.y - 2, sw + 4, sh + 4);
      for (const [a, b] of [[selected.x - 3, selected.y - 3], [selected.x + sw, selected.y - 3],
        [selected.x - 3, selected.y + sh], [selected.x + sw, selected.y + sh]]) c.fillRect(a, b, 3, 3);
    }
    c.strokeStyle = '#78958755'; c.strokeRect(0, 0, s.width * 16, s.height * 16);
  });
  if(s.garden?.weather&&s.garden.weather!=='clear')drawGardenWeather(c,s.garden.weather,time,width,height);
  c.restore();
}

// Original pixel artwork retained as fallbacks.
function drawLegacyTile(c,id,x,y,p,phase=0){const r=(a,b,w,h,col)=>{c.fillStyle=p[col]||col;
  c.fillRect(x+a,y+b,w,h)};
  if(id===1||id===2){r(0,0,16,16,8);
  r(1,2,14,13,9);
  r(1,3,6,5,10);
  r(9,10,6,4,10);
  r(3,11,3,2,8);
  r(10,4,4,2,8);
  r(2,9,6,1,11);
  if(id===1){r(0,0,16,3,6);
  r(0,3,16,3,4);
  r(0,0,5,1,7);
  r(8,0,7,1,7);
  r(3,4,3,5,4);
  r(10,3,4,4,5);
  r(12,7,2,2,4);
  }}
  if(id===3){r(0,0,16,16,8);
  r(1,1,10,6,10);
  r(12,1,4,6,9);
  r(1,8,5,7,9);
  r(7,8,8,7,10);
  r(1,1,10,1,11);
  r(7,8,8,1,11);
  }
  if(id===4){r(0,0,16,3,6);
  r(1,3,14,3,9);
  r(1,3,14,1,11);
  r(3,6,2,4,8);
  r(12,6,2,4,8);
  r(0,0,6,1,7);
  }
  if(id===5){r(0,14,16,2,8);
  for(let a=0;
  a<16;
  a+=6){r(a+2,5,1,2,13);
  r(a+1,7,3,3,12);
  r(a,10,5,4,3);
  r(a+1,9,1,4,13);
  }}
  if(id===6){r(0,5,16,11,2);
  r(0,5,16,1,12);
  r((phase%2)*4,9,7,1,3);
  r(9,13,5,1,12);
  }
  if(id===7){r(7,5,2,11,5);
  [[2,5,5,2],[0,3,3,2],[9,8,5,2],[13,6,3,2],[4,10,4,2],[1,8,4,2],[9,3,4,2],[12,1,2,2]].forEach(q=>r(...q,5));
  r(8,3,1,11,6);
  }
  if(id===8){r(6,1,3,2,13);
  r(4,3,7,7,12);
  r(3,10,9,4,3);
  r(6,3,2,9,13);
  r(10,7,3,6,4);
  r(1,11,3,4,12);
  r(3,14,10,2,2);
  }
  if(id===9){r(2,0,2,16,10);
  r(12,0,2,16,10);
  for(let i=2;
  i<16;
  i+=5)r(4,i,8,2,11);
  }
  if(id===10){r(7,0,2,3,9);
  r(4,3,8,2,11);
  r(3,5,10,8,8);
  r(5,5,6,6,14);
  r(6,6,3,4,13);
  r(4,12,8,2,10);
  }}
function drawLegacyEntity(c,e,p,time=0){if(e.visible===false)return;
  const x=Math.round(e.x),y=Math.round(e.y),r=(a,b,w,h,col)=>{c.fillStyle=p[col]||col;
  c.fillRect(x+a,y+b,w,h)},step=Math.sin(time*10)>0?1:0;
  if(e.type==='player'){r(3,0,7,2,0);
  r(2,2,9,5,13);
  r(1,3,3,4,12);
  r(7,3,3,2,0);
  r(2,7,8,7,3);
  r(2,7,8,2,14);
  r(0,9,3,4,13);
  r(10,9,2,4,13);
  r(3,13,3,3+step,13);
  r(8,13,3,4-step,13);
  r(1,8,3,5,12);
  }
  if(e.type==='enemy'){r(2,5,9,9,0);
  r(1,4,11,7,15);
  r(3,2,7,3,15);
  r(0,6,2,4,9);
  r(11,6,2,4,9);
  r(3,6,2,3,13);
  r(8,6,2,3,13);
  r(4,7,1,2,0);
  r(9,7,1,2,0);
  r(3,11,6,2,8);
  r(1,14,4,2-step,10);
  r(8,14,4,1+step,10);
  }
  if(e.type==='gem'){r(5,2,3,2,13);
  r(3,4,7,5,14);
  r(5,9,3,2,11);
  r(4,4,2,3,13);
  }
  if(e.type==='health'){r(1,3,4,3,15);
  r(7,3,4,3,15);
  r(1,6,10,3,15);
  r(3,9,6,2,15);
  r(5,11,2,2,15);
  r(2,4,2,2,13);
  }
  if(e.type==='checkpoint'){r(2,1,2,15,11);
  r(4,2,9,6,e.active?6:12);
  r(4,7,5,2,e.active?6:12);
  r(0,15,8,1,9);
  }
  if(e.type==='door'){r(0,4,20,28,8);
  r(3,1,14,4,10);
  r(4,4,12,26,2);
  r(6,5,8,23,12);
  r(8,7,4,20,3);
  r(0,28,20,4,10);
  r(0,5,3,23,9);
  r(17,5,3,23,9);
  r(0,4,20,1,11);
  }}
