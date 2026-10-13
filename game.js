/* ============================================================
 * 赛博牛马：逆袭董事长 · 稳定物理优化版
 * ============================================================ */
(function () {
  'use strict';

  // 1. 基础物理配置
  const W = 410;
  const H = 650;
  const WALL = 10;
  const DROP_Y = 65;
  const DANGER_Y = 110;

  // 物理参数：降低重力和弹力，避免角色弹得过高
  const GRAVITY = 1900;
  const SUBSTEPS = 3;
  const ITER = 6;
  const DROP_MS = 360;
  const OVER_LIMIT = 1.6;
  const REST_SPEED = 140;
  const REST_SPEED2 = REST_SPEED * REST_SPEED;

  const RESTITUTION = 0.16;
  const WALL_RESTITUTION = 0.20;
  const REST_THRESHOLD = 75;
  const FRICTION = 0.955;
  const SQUASH_DECAY = 9.0;
  const SQUASH_MAX = 0.30;
  const ASSET_FILL = 0.92;

  const REVIVE_STEP = 2000;
  const MAX_TIER = 9;

  // 10 级职阶配置
  const TIERS = [
    { level: 0, name: '实习生员工', r: 20, score: 2, color: '#f5cd79', spriteSrc: 'images/level0.jpg' },
    { level: 1, name: '正式员工', r: 30, score: 4, color: '#e15f41', spriteSrc: 'images/level1.jpg' },
    { level: 2, name: '小组组长', r: 35, score: 8, color: '#3dc1d3', spriteSrc: 'images/level2.jpg' },
    { level: 3, name: '主管', r: 40, score: 16, color: '#546de5', spriteSrc: 'images/level3.jpg' },
    { level: 4, name: '副经理', r: 50, score: 32, color: '#e66767', spriteSrc: 'images/level4.jpg' },
    { level: 5, name: '经理', r: 60, score: 64, color: '#778beb', spriteSrc: 'images/level5.jpg' },
    { level: 6, name: '副总监', r: 75, score: 128, color: '#cf6a87', spriteSrc: 'images/level6.jpg' },
    { level: 7, name: '总监', r: 90, score: 256, color: '#f78fb3', spriteSrc: 'images/level7.jpg' },
    { level: 8, name: '业务合伙人', r: 105, score: 512, color: '#63cdda', spriteSrc: 'images/level8.jpg' },
    { level: 9, name: '敲钟董事长', r: 110, score: 1024, color: '#f8a5c2', spriteSrc: 'images/level9.jpg' }
  ];

  const MEME_TEXTS = {
    1: ['收到！', '这就改！'],
    2: ['拉齐认知', '找准抓手'],
    3: ['打通底层逻辑', '形成业务闭环'],
    4: ['高频打低频', '组合拳打法'],
    5: ['商业模式重塑', '降本增效！'],
    6: ['架构重组', '向管理要效益'],
    7: ['资本杠杆', '重构价值链'],
    8: ['期权变现', '分红自由'],
    9: ['🎉 纳斯达克敲钟！', '财富自由！']
  };

  // 2. DOM 与本地存储
  const STORAGE_KEY_USER = 'cyber_ox_current_player';
  const STORAGE_KEY_RANKS = 'cyber_ox_leaderboard';

  const container = document.getElementById('game-container');
  let canvas = document.getElementById('game-canvas');

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');

  const scoreText = document.getElementById('score-text');
  const nextTierText = document.getElementById('next-tier-text');
  const finalScoreText = document.getElementById('final-score-text');
  const currentPlayerDisplay = document.getElementById('current-player-name');
  const playerBadge = document.getElementById('player-badge');

  const accountModal = document.getElementById('account-modal');
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const gameOverModal = document.getElementById('game-over-modal');
  const reviveModal = document.getElementById('revive-modal');
  const reviveScoreVal = document.getElementById('revive-score-val');
  const useReviveBtn = document.getElementById('use-revive-btn');
  const giveupBtn = document.getElementById('giveup-btn');
  const reviveBadge = document.getElementById('revive-badge');
  const reviveCountText = document.getElementById('revive-count-text');

  const playerNameInput = document.getElementById('player-name-input');
  const saveNameBtn = document.getElementById('save-name-btn');
  const rankBtn = document.getElementById('rank-btn');
  const closeRankBtn = document.getElementById('close-rank-btn');
  const leaderboardList = document.getElementById('leaderboard-list');
  const restartBtn = document.getElementById('restart-btn');

  // 3. 音效
  const Sound = {
    ctx: null,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    },

    tone(f1, f2, dur, vol, type = 'sine') {
      const c = this.ensure();
      if (!c) return;

      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(f1, t);

      if (f2 && f2 !== f1) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, f2),
          t + dur
        );
      }

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    drop() {
      this.tone(180, 120, 0.08, 0.05, 'sine');
    },

    merge(tier) {
      const base = 220 * Math.pow(1.14, tier);
      this.tone(base, base * 1.6, 0.18, 0.14, 'sine');
      this.tone(base * 1.5, base * 2.5, 0.1, 0.06, 'triangle');
    },

    over() {
      this.tone(360, 80, 0.65, 0.18, 'sawtooth');
    },

    bonus() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => this.tone(f, f, 0.22, 0.12, 'triangle'), i * 80);
      });
    }
  };

  function haptic(ms) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  // 4. 用户信息与排行榜
  let currentPlayer = localStorage.getItem(STORAGE_KEY_USER);

  function initUserAccount() {
    if (!currentPlayer) {
      accountModal.style.display = 'flex';
    } else {
      currentPlayerDisplay.innerText = currentPlayer;
    }
  }

  saveNameBtn.addEventListener('click', () => {
    const val = playerNameInput.value.trim();

    if (val) {
      currentPlayer = val;
      localStorage.setItem(STORAGE_KEY_USER, currentPlayer);
      currentPlayerDisplay.innerText = currentPlayer;
      accountModal.style.display = 'none';
    }
  });

  playerBadge.addEventListener('click', () => {
    playerNameInput.value = currentPlayer || '';
    accountModal.style.display = 'flex';
  });

  function getLeaderboard() {
    const data = localStorage.getItem(STORAGE_KEY_RANKS);
    return data ? JSON.parse(data) : [];
  }

  function saveScoreToLeaderboard(name, sc) {
    if (sc <= 0) return;

    const list = getLeaderboard();
    list.push({
      name: name || '无名牛马',
      score: sc,
      date: new Date().toLocaleDateString()
    });

    list.sort((a, b) => b.score - a.score);
    localStorage.setItem(
      STORAGE_KEY_RANKS,
      JSON.stringify(list.slice(0, 10))
    );
  }

  function renderLeaderboard() {
    const list = getLeaderboard();
    leaderboardList.innerHTML = '';

    if (list.length === 0) {
      leaderboardList.innerHTML =
        '<div style="text-align:center;color:#888;padding:15px;">暂无打工记录</div>';
      return;
    }

    list.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML =
        `<span>#${index + 1} ${item.name}</span><span>¥${item.score}</span>`;
      leaderboardList.appendChild(row);
    });
  }

  rankBtn.addEventListener('click', () => {
    renderLeaderboard();
    leaderboardModal.style.display = 'flex';
  });

  closeRankBtn.addEventListener('click', () => {
    leaderboardModal.style.display = 'none';
  });

  // 5. 图像处理与白底剔除
  const processedAssets = {};

  function processTightSprite(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const can = document.createElement('canvas');

    can.width = w;
    can.height = h;

    const c = can.getContext('2d');
    c.drawImage(img, 0, 0);

    const imgData = c.getImageData(0, 0, w, h);
    const data = imgData.data;
    const rowCounts = new Array(h).fill(0);
    const colCounts = new Array(w).fill(0);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (r > 225 && g > 225 && b > 225) {
          data[idx + 3] = 0;
        } else if (
          x > w * 0.02 && x < w * 0.98 &&
          y > h * 0.02 && y < h * 0.98
        ) {
          rowCounts[y]++;
          colCounts[x]++;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    const minDensity = Math.max(8, Math.floor(w * 0.03));
    let minY = 0;
    let maxY = h - 1;
    let minX = 0;
    let maxX = w - 1;

    for (let y = 0; y < h; y++) {
      if (rowCounts[y] > minDensity) {
        minY = y;
        break;
      }
    }

    for (let y = h - 1; y >= 0; y--) {
      if (rowCounts[y] > minDensity) {
        maxY = y;
        break;
      }
    }

    for (let x = 0; x < w; x++) {
      if (colCounts[x] > minDensity) {
        minX = x;
        break;
      }
    }

    for (let x = w - 1; x >= 0; x--) {
      if (colCounts[x] > minDensity) {
        maxX = x;
        break;
      }
    }

    const realW = Math.max(10, maxX - minX);
    const realH = Math.max(10, maxY - minY);

    c.putImageData(imgData, 0, 0);

    const cleanCan = document.createElement('canvas');
    cleanCan.width = realW;
    cleanCan.height = realH;

    cleanCan.getContext('2d').drawImage(
      can, minX, minY, realW, realH,
      0, 0, realW, realH
    );

    return cleanCan;
  }

  // 6. 游戏状态
  const state = {
    balls: [],
    particles: [],
    floats: [],
    score: 0,
    pending: 0,
    next: Math.floor(Math.random() * 4),
    ready: true,
    aimX: W / 2,
    over: false,
    danger: false,
    flash: 0,
    revives: 0,
    reviveGiven: 0
  };
    function updateReviveBadge() {
    if (!reviveBadge) return;

    if (state.revives > 0) {
      reviveBadge.style.display = 'flex';
      reviveCountText.innerText = '×' + state.revives;
    } else {
      reviveBadge.style.display = 'none';
    }
  }

  function checkGrantRevive() {
    const targetCount = Math.floor(state.score / REVIVE_STEP);

    if (targetCount > state.reviveGiven) {
      const added = targetCount - state.reviveGiven;
      state.reviveGiven = targetCount;
      state.revives += added;
      updateReviveBadge();

      state.floats.push({
        x: W / 2,
        y: 180,
        text: `+${added} 复活币 🪙`,
        life: 1.6,
        big: true
      });

      Sound.bonus();
    }
  }

  function makeBall(x, y, tier, vx = 0, vy = 0) {
    const r = TIERS[tier].r;
    const m = r * r;

    return {
      x, y,
      px: x,
      py: y,
      vx, vy,
      pvx: 0,
      pvy: 0,
      r,
      tier,
      angle: 0,
      mass: m,
      invMass: 1 / m,
      bornAt: performance.now(),
      overTime: 0,
      landed: false,
      dead: false,
      contacts: 0,
      sq: 0,
      sqA: 0,
      popAt: 0
    };
  }

  function squash(b, nx, ny, speed) {
    const k = Math.min(SQUASH_MAX, speed / 1500);
    if (k <= b.sq) return;

    b.sq = k;
    b.sqA = Math.atan2(ny, nx);
  }

  // 核心物理求解：积分、碰撞约束、速度恢复、弹性冲量
  function stepPhysics(dt) {
    const balls = state.balls;
    const merges = [];
    const contacts = [];

    // 1. 积分与重力
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];

      b.px = b.x;
      b.py = b.y;
      b.vy += GRAVITY * dt;
      b.pvx = b.vx;
      b.pvy = b.vy;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.contacts = 0;
    }

    // 2. 约束迭代
    for (let it = 0; it < ITER; it++) {
      // 墙壁与地面约束
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.dead) continue;

        if (b.x - b.r < WALL) {
          b.x = WALL + b.r;
          b.contacts++;
          if (it === 0) {
            contacts.push({ ball: b, nx: 1, ny: 0 });
          }
        }

        if (b.x + b.r > W - WALL) {
          b.x = W - WALL - b.r;
          b.contacts++;
          if (it === 0) {
            contacts.push({ ball: b, nx: -1, ny: 0 });
          }
        }

        if (b.y + b.r > H - WALL) {
          b.y = H - WALL - b.r;
          b.contacts++;
          if (it === 0) {
            contacts.push({ ball: b, nx: 0, ny: -1 });
          }
        }
      }

      // 球球碰撞：统一按圆形半径判断，不再放大垂直距离
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.dead) continue;

        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.dead || a.dead) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const sumR = a.r + b.r;
          const d2 = dx * dx + dy * dy;

          if (d2 >= sumR * sumR) continue;

          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d;
          const ny = dy / d;
          const overlap = sumR - d;

          // 相同等级碰撞时合成
          if (a.tier === b.tier && it === 0 && overlap >= -0.8) {
            a.dead = true;
            b.dead = true;
            merges.push([a, b]);
            continue;
          }

          if (it === 0) {
            contacts.push({ a, b, nx, ny });
          }

          // 限制每轮修正距离，避免重叠后突然被弹飞
          const corr = Math.min(overlap, 2) * 0.45;
          if (corr <= 0) continue;

          const invSum = a.invMass + b.invMass;
          const wa = a.invMass / invSum;
          const wb = b.invMass / invSum;

          a.x -= nx * corr * wa;
          a.y -= ny * corr * wa;
          b.x += nx * corr * wb;
          b.y += ny * corr * wb;

          a.contacts++;
          b.contacts++;
        }
      }
    }

    // 3. 最后夹持一次墙体，避免角色穿墙
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.dead) continue;

      if (b.x - b.r < WALL) {
        b.x = WALL + b.r;
        b.contacts++;
      }

      if (b.x + b.r > W - WALL) {
        b.x = W - WALL - b.r;
        b.contacts++;
      }

      if (b.y + b.r > H - WALL) {
        b.y = H - WALL - b.r;
        b.contacts++;
      }
    }

    // 4. 根据位置变化恢复速度
    const invDt = 1 / dt;

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.dead) continue;

      const dx = b.x - b.px;
      const dy = b.y - b.py;

      let vx = dx * invDt;
      let vy = dy * invDt;

      if (b.contacts > 0) {
        vx *= FRICTION;
      }
      vx = Math.max(-600, Math.min(600, vx));
      vy = Math.max(-500, Math.min(1200, vy));

      if (b.sq > 0) {
        b.sq = Math.max(0, b.sq - b.sq * SQUASH_DECAY * dt);
      }

      b.vx = vx;
      b.vy = vy;
      b.angle += (dx / b.r) * 0.85;

      if (!b.landed && (b.contacts > 0 || performance.now() - b.bornAt > 800)) {
        b.landed = true;
      }
    }

    // 5. 弹性冲量：降低反弹，过滤低速碰撞
    for (let k = 0; k < contacts.length; k++) {
      const ct = contacts[k];

      if (ct.ball) {
        // 撞墙或地面
        const b = ct.ball;
        const vnPre = b.pvx * ct.nx + b.pvy * ct.ny;

        if (vnPre < -REST_THRESHOLD) {
          const vnPost = b.vx * ct.nx + b.vy * ct.ny;
          const target = -WALL_RESTITUTION * vnPre;
          const j = target - vnPost;

          if (j > 0) {
            b.vx += j * ct.nx;
            b.vy += j * ct.ny;
            squash(b, ct.nx, ct.ny, -vnPre);
          }
        }
      } else {
        // 两个角色互撞
        const a = ct.a;
        const b = ct.b;

        const vnPre =
          (a.pvx - b.pvx) * ct.nx +
          (a.pvy - b.pvy) * ct.ny;

        if (vnPre > REST_THRESHOLD) {
          const vnPost =
            (a.vx - b.vx) * ct.nx +
            (a.vy - b.vy) * ct.ny;

          const target = -RESTITUTION * vnPre;
          const j = (vnPost - target) / (a.invMass + b.invMass);

          if (j > 0) {
            a.vx -= j * a.invMass * ct.nx;
            a.vy -= j * a.invMass * ct.ny;
            b.vx += j * b.invMass * ct.nx;
            b.vy += j * b.invMass * ct.ny;

            squash(a, -ct.nx, -ct.ny, vnPre);
            squash(b, ct.nx, ct.ny, vnPre);
          }
        }
      }
    }

    if (merges.length) {
      processMerges(merges);
    }
  }

  function processMerges(merges) {
    for (let k = 0; k < merges.length; k++) {
      const [a, b] = merges[k];
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const tier = a.tier;

      // 双董事长相撞的彩蛋
      if (tier >= MAX_TIER) {
        addScore(2000, mx, my, '+¥2000 年终分红！');
        state.revives++;
        updateReviveBadge();
        state.flash = 1.0;
        burst(mx, my, '#ffeaa7', 48);
        burst(mx, my, '#ff7675', 36);
        Sound.bonus();
        haptic(100);

        state.floats.push({
          x: mx,
          y: my - 40,
          text: '🎉 纳斯达克敲钟双消！',
          life: 2.0,
          big: true
        });

        continue;
      }

      const nt = tier + 1;
      const nb = makeBall(
        mx,
        my,
        nt,
        (a.vx + b.vx) * 0.15,
        (a.vy + b.vy) * 0.15
      );

      nb.x = Math.max(WALL + nb.r, Math.min(W - WALL - nb.r, nb.x));
      nb.y = Math.min(nb.y, H - WALL - nb.r);
      nb.px = nb.x;
      nb.py = nb.y;
      nb.landed = true;
      nb.popAt = performance.now();

      state.balls.push(nb);

      container.classList.remove('screen-shake');
      void container.offsetWidth;
      container.classList.add('screen-shake');

      addScore(TIERS[nt].score, mx, my, '+' + TIERS[nt].score);
      spawnMeme(mx, my, nt);
      burst(mx, my, TIERS[nt].color, 8 + nt * 2);
      Sound.merge(nt);
      haptic(10 + nt * 3);
    }

    state.balls = state.balls.filter(b => !b.dead);
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 200;

      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        r: 2.5 + Math.random() * 3,
        life: 1,
        color
      });
    }
  }

  function spawnMeme(x, y, tier) {
    const list = MEME_TEXTS[tier] || ['升职加薪！'];
    const text = list[Math.floor(Math.random() * list.length)];

    state.floats.push({
      x,
      y: y - 25,
      text,
      life: 1.4,
      big: tier >= 7
    });
  }

  function addScore(n, x, y, text) {
    state.score += n;
    scoreText.innerText = state.score;

    if (x !== undefined) {
      state.floats.push({ x, y, text, life: 1.0 });
    }

    checkGrantRevive();
  }

  // 7. 画面渲染
  function render(dt) {
    ctx.clearRect(0, 0, W, H);

    // 瞄准线和落点阴影
    if (state.ready && !state.over) {
      const currentR = TIERS[state.pending].r;

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(116, 185, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(state.aimX, DROP_Y);
      ctx.lineTo(state.aimX, H - WALL);
      ctx.stroke();

      ctx.fillStyle = 'rgba(116, 185, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(state.aimX, H - WALL - 4, currentR * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawCharacter(ctx, state.aimX, DROP_Y, currentR, state.pending, null, 1, 0);
    }

    // 绘制场上的角色
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.dead) continue;

      let scale = 1;

      if (b.popAt) {
        const t = (performance.now() - b.popAt) / 220;

        if (t < 1) {
          scale = 1 + 0.28 * (1 - t);
        } else {
          b.popAt = 0;
        }
      }

      drawCharacter(
        ctx, b.x, b.y, b.r, b.tier,
        b.sq > 0.004 ? { a: b.sqA, k: b.sq } : null,
        scale,
        b.angle
      );
    }

    // 粒子效果
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];

      p.vy += 1200 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= 1.8 * dt;

      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // 浮动文字
    ctx.textAlign = 'center';

    for (let i = state.floats.length - 1; i >= 0; i--) {
      const f = state.floats[i];

      f.y -= 35 * dt;
      f.life -= dt;

      if (f.life <= 0) {
        state.floats.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = f.big ? 'bold 22px sans-serif' : 'bold 14px sans-serif';
      ctx.fillStyle = f.big ? '#ffeaa7' : '#ffd32a';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // 全屏闪烁效果
    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = state.flash * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
    function drawCharacter(c, x, y, r, tier, squashShape, scale = 1, angle = 0) {
    const canvasAsset = processedAssets[tier];

    c.save();
    c.translate(x, y);

    if (squashShape) {
      c.rotate(squashShape.a);
      c.scale(1 - squashShape.k, 1 + squashShape.k * 0.85);
      c.rotate(-squashShape.a);
    }

    if (scale !== 1) c.scale(scale, scale);
    if (angle !== 0) c.rotate(angle);

    if (canvasAsset) {
      const drawH = r * 2.40;
      const drawW = drawH * (canvasAsset.width / canvasAsset.height);
      c.drawImage(canvasAsset, -drawW / 2, -drawH / 2 - 2, drawW, drawH);
    } else {
      c.fillStyle = TIERS[tier].color;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  }

  // 8. 交互控制与复活逻辑
  function tryDrop() {
    if (state.over || !state.ready) return;

    const tier = state.pending;
    const r = TIERS[tier].r;
    const x = Math.max(WALL + r, Math.min(W - WALL - r, state.aimX));
    const b = makeBall(x, DROP_Y, tier, 0, 130);

    state.balls.push(b);
    state.ready = false;
    state.pending = state.next;
    state.next = Math.floor(Math.random() *4);

    nextTierText.innerText = TIERS[state.next].name;
    Sound.drop();

    setTimeout(() => {
      if (!state.over) state.ready = true;
    }, DROP_MS);
  }

  function pointerToX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }

  let isTouching = false;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state.over || !state.ready) return;

    Sound.ensure();
    isTouching = true;

    const clientX = e.touches[0].clientX;
    const r = TIERS[state.pending].r;

    state.aimX = Math.max(
      WALL + r,
      Math.min(W - WALL - r, pointerToX(clientX))
    );
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching || state.over || !state.ready) return;

    const clientX = e.touches[0].clientX;
    const r = TIERS[state.pending].r;

    state.aimX = Math.max(
      WALL + r,
      Math.min(W - WALL - r, pointerToX(clientX))
    );
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!isTouching || state.over || !state.ready) return;

    isTouching = false;
    tryDrop();
  }, { passive: false });

  canvas.addEventListener('touchcancel', () => {
    isTouching = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = TIERS[state.pending].r;

    state.aimX = Math.max(
      WALL + r,
      Math.min(W - WALL - r, pointerToX(e.clientX))
    );
  });

  canvas.addEventListener('mouseup', () => {
    Sound.ensure();
    tryDrop();
  });

  // 停留在警戒线上方才计时，高速飞过不立即判负
  function checkGameOver(dt) {
    let danger = false;

    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.dead || !b.landed) continue;

      if (b.y - b.r < DANGER_Y) {
        danger = true;

        if (b.vx * b.vx + b.vy * b.vy < REST_SPEED2) {
          b.overTime += dt;

          if (b.overTime > OVER_LIMIT) {
            handleGameOverTrigger();
            return;
          }
        } else {
          b.overTime = Math.max(0, b.overTime - dt * 2);
        }
      } else {
        b.overTime = Math.max(0, b.overTime - dt * 2);
      }
    }

    state.danger = danger;
  }

  function handleGameOverTrigger() {
    state.over = true;
    Sound.over();

    if (state.revives > 0) {
      if (reviveScoreVal) {
        reviveScoreVal.innerText = `¥${state.score}`;
      }

      if (reviveModal) {
        reviveModal.style.display = 'flex';
      }
    } else {
      settleGameOver();
    }
  }

  function executeRevive() {
    if (state.revives <= 0) return;

    state.revives--;
    updateReviveBadge();
    reviveModal.style.display = 'none';

    // 找到最靠上的角色并移除
    let topIdx = -1;
    let minTopY = Infinity;

    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      const topY = b.y - b.r;

      if (topY < minTopY) {
        minTopY = topY;
        topIdx = i;
      }
    }

    if (topIdx >= 0) {
      state.balls.splice(topIdx, 1);
    }

    // 清除仍然越过警戒线的角色
    state.balls = state.balls.filter(
      b => (b.y - b.r) >= DANGER_Y + 5
    );

    state.balls.forEach(b => {
      b.overTime = 0;
    });

    state.over = false;
    state.ready = true;
    state.flash = 0.8;

    Sound.bonus();
    haptic(60);
  }

  function settleGameOver() {
    if (reviveModal) {
      reviveModal.style.display = 'none';
    }

    saveScoreToLeaderboard(currentPlayer, state.score);
    finalScoreText.innerText = `本次到手薪资: ¥${state.score}`;
    gameOverModal.style.display = 'flex';
  }

  if (useReviveBtn) {
    useReviveBtn.addEventListener('click', executeRevive);
  }

  if (giveupBtn) {
    giveupBtn.addEventListener('click', settleGameOver);
  }

  restartBtn.addEventListener('click', () => {
    location.reload();
  });

  // 9. 主循环
  let last = performance.now();

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;

    if (dt > 0.1) dt = 0.1;

    if (!state.over) {
      const sub = dt / SUBSTEPS;

      for (let s = 0; s < SUBSTEPS; s++) {
        stepPhysics(sub);
      }

      checkGameOver(dt);
    }

    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt * 2.0);
    }

    render(dt);
    requestAnimationFrame(loop);
  }

  // 10. 画布自适应
  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(
      canvas.width / W,
      0,
      0,
      canvas.height / H,
      0,
      0
    );
  }

  window.addEventListener('resize', resize);

  initUserAccount();
  resize();

  // 11. 加载角色图片，图片加载失败时仍然启动游戏
  let loaded = 0;

  TIERS.forEach(t => {
    const img = new Image();
    img.src = t.spriteSrc;

    img.onload = () => {
      processedAssets[t.level] = processTightSprite(img);
      loaded++;

      if (loaded === TIERS.length) {
        nextTierText.innerText = TIERS[state.next].name;

        requestAnimationFrame((time) => {
          last = time;
          loop(time);
        });
      }
    };

    img.onerror = () => {
      loaded++;

      if (loaded === TIERS.length) {
        nextTierText.innerText = TIERS[state.next].name;

        requestAnimationFrame((time) => {
          last = time;
          loop(time);
        });
      }
    };
  });
})();

// =========================
// 微信打赏功能
// =========================

document.addEventListener("DOMContentLoaded", function () {
    const donateBtn = document.getElementById("donateBtn");
    const donateModal = document.getElementById("donateModal");
    const closeDonateBtn = document.getElementById("closeDonateBtn");

    // 打开打赏弹窗
    donateBtn.addEventListener("click", function () {
        donateModal.classList.add("show");
    });

    // 点击关闭按钮
    closeDonateBtn.addEventListener("click", function () {
        donateModal.classList.remove("show");
    });

    // 点击弹窗外部区域关闭
    donateModal.addEventListener("click", function (event) {
        if (event.target === donateModal) {
            donateModal.classList.remove("show");
        }
    });

    // 按 Esc 键关闭弹窗
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            donateModal.classList.remove("show");
        }
    });
});