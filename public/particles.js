(() => {
	// Permite forzar animación con ?anim=1 y respetar reduce-motion salvo override
	const qs = new URLSearchParams(window.location.search);
	const animOverride = qs.get('anim');
	if (animOverride === '1') localStorage.setItem('ANIM_BG', '1');
	if (animOverride === '0') localStorage.setItem('ANIM_BG', '0');
	const stored = localStorage.getItem('ANIM_BG');
	const forceAnim = stored === '1';
	const forceOff = stored === '0';
	const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!forceAnim && (forceOff || prefersReduce)) return;

	// PRNG con semilla para que el fondo siempre sea igual
	const seedStr = qs.get('seed') || qs.get('i') || 'RM-INVITACION-1';
	function strToSeed(s) {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}
	function mulberry32(a) {
		return function () {
			a |= 0; a = a + 0x6D2B79F5 | 0;
			let t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}
	const seeded = mulberry32(strToSeed(String(seedStr)));
	function sr(min, max) { return seeded() * (max - min) + min; }
	const effect = (qs.get('effect') || 'petals').toLowerCase();
	const IS_CONFETTI = effect === 'confetti';

	const canvas = document.getElementById('bg-canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');

	let dpr = Math.min(window.devicePixelRatio || 1, 2);
	let width = 0;
	let height = 0;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = Math.max(1, Math.floor(width * dpr));
		canvas.height = Math.max(1, Math.floor(height * dpr));
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	window.addEventListener('resize', resize);
	resize();

	// Colores desde CSS vars
	const css = getComputedStyle(document.documentElement);
	const BG = (css.getPropertyValue('--bg') || '#011229').trim();
	const GOLD = (css.getPropertyValue('--primary') || '#d4af37').trim();
	// Colores dorados acordes a las esquinas (toman los CSS vars)
	const PRIMARY_GOLD = (css.getPropertyValue('--primary') || '#a48729').trim();       // base
	const PRIMARY_GOLD_LIGHT = (css.getPropertyValue('--primary-ink') || '#e6c873').trim(); // claro
	const GOLD_PALETTE = [
		PRIMARY_GOLD,
		PRIMARY_GOLD_LIGHT,
		'#b38b20',  // tono medio cercano
		'#c9a63a',  // tono medio-claro
		'#dcbc63'   // tono claro cálido
	];
	// Luz direccional (de arriba-izquierda hacia abajo-derecha)
	const LIGHT_ANGLE = -Math.PI / 4; // -45°
	// Colores para pétalos (con fallback a rosas suaves)
	const PETAL1 = (css.getPropertyValue('--petal1') || '#f6c1cf').trim(); // rosa claro (centro)
	const PETAL2 = (css.getPropertyValue('--petal2') || '#ffd8e5').trim(); // rosa pálido (borde)
	const PETAL_EDGE = (css.getPropertyValue('--petalEdge') || '#e55a8a').trim(); // borde más intenso
	const PETAL_BASE = (css.getPropertyValue('--petalBase') || '#ffe2a6').trim(); // brillo amarillento en la base

	function rand(min, max) { return Math.random() * (max - min) + min; }

	// Partículas - creación según modo
	let particles = [];
	function createParticles() {
		if (IS_CONFETTI) {
			const COUNT = 40;
			particles = Array.from({ length: COUNT }).map(() => ({
				x: seeded() * width,
				y: seeded() * height,
				w: sr(10, 20),
				h: sr(10, 20),
				color: GOLD_PALETTE[Math.floor(seeded() * GOLD_PALETTE.length)],
				vx: sr(-15, 15), // más lento
				vy: sr(-12, 12), // más lento
				angle: sr(0, Math.PI * 2),
				spin: sr(-0.6, 0.6), // rotación más lenta en background
				alpha: sr(0.8, 1),
				flutter: sr(0.8, 1.4), // “aleteo”
				phase: sr(0, Math.PI * 2)
			}));
		} else {
			// Pétalos
			const COUNT = 50;
			particles = Array.from({ length: COUNT }).map(() => ({
				x: seeded() * width,
				y: seeded() * height,
				r: sr(0.8, 2.6),
				vx: sr(-20, 20),
				vy: sr(-16, 16),
				alpha: sr(0.4, 0.95),
				blinkSpeed: sr(0.6, 1.6),
				w: sr(6.0, 12.0),
				h: sr(3.2, 6.4),
				angle: sr(0, Math.PI * 2),
				spin: sr(-0.6, 0.6)
			}));
		}
	}
	createParticles();

	// Al tocar/clic: brotan piezas según modo
	const bursts = [];
	function spawnBurst(x, y) {
		const N = IS_CONFETTI ? 18 + Math.floor(Math.random() * 12) : 10 + Math.floor(Math.random() * 8);
		for (let i = 0; i < N; i++) {
			const ang = Math.random() * Math.PI * 2;
			const speed = rand(IS_CONFETTI ? 120 : 90, IS_CONFETTI ? 260 : 220); // bursts un poco más lentos
			const life = rand(IS_CONFETTI ? 1.0 : 1.2, IS_CONFETTI ? 2.2 : 2.0);
			if (IS_CONFETTI) {
				bursts.push({
					x, y,
					vx: Math.cos(ang) * speed,
					vy: Math.sin(ang) * speed,
					life: 0, max: life,
					w: rand(10, 24), h: rand(10, 24),
					angle: Math.random() * Math.PI * 2,
					spin: rand(-2.2, 2.2),
					alpha: rand(0.7, 1),
					color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
					flutter: rand(0.8, 1.6),
					phase: Math.random() * Math.PI * 2
				});
			} else {
				const w = rand(8, 16), h = rand(4, 9);
				bursts.push({
					x, y,
					vx: Math.cos(ang) * speed,
					vy: Math.sin(ang) * speed,
					life: 0, max: life,
					w, h,
					angle: Math.random() * Math.PI * 2,
					spin: rand(-1.2, 1.2),
					alpha: rand(0.65, 1)
				});
			}
		}
	}

	// Listener global (canvas tiene pointer-events: none)
	window.addEventListener('pointerdown', (e) => spawnBurst(e.clientX, e.clientY), { passive: true });

	let last = 0;
	function tick(ts) {
		const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
		last = ts;

		// Fondo
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, width, height);

		// Partículas
		// En fondos claros, 'lighter' casi no se ve; cambiamos a 'source-over'
		const bgRgb = hexToRgb(BG);
		const bgLuma = bgRgb ? (0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b) / 255 : 0.1;
		ctx.globalCompositeOperation = bgLuma > 0.7 ? 'source-over' : 'lighter';
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			// movimiento
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.angle += p.spin * dt;

			// envolver suavemente
			if (p.x < -5) p.x = width + 5;
			if (p.x > width + 5) p.x = -5;
			if (p.y < -5) p.y = height + 5;
			if (p.y > height + 5) p.y = -5;

			if (IS_CONFETTI) {
				// confeti dorado metálico: discos circulares con luz direccional fija
				ctx.save();
				ctx.translate(p.x, p.y);
				const col = GOLD_PALETTE[i % GOLD_PALETTE.length];
				const r = Math.max(7, (p.w ? Math.min(p.w, p.h) * 0.88 : 9));

				// Gradientes calculados en espacio global (fijos respecto a pantalla)
				const lx = Math.cos(LIGHT_ANGLE), ly = Math.sin(LIGHT_ANGLE);
				// Base radial: centro sólido que se desvanece (un poco menos blur)
				const base = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
				base.addColorStop(0.00, hexToRgba(col, p.alpha * 0.95));
				base.addColorStop(0.88, hexToRgba(col, p.alpha * 0.86));
				base.addColorStop(1.00, hexToRgba(col, p.alpha * 0.18));
				const hg = ctx.createLinearGradient(-lx * r, -ly * r, lx * r, ly * r);
				const pos = 0.5 + Math.sin(ts * 0.004 + (p.phase || 0)) * 0.08; // movimiento del destello
				const aHi = Math.min(0.45, 0.26 * p.alpha + 0.18); // highlight más brillante
				hg.addColorStop(0.0, 'rgba(255,255,255,0)');
				hg.addColorStop(Math.max(0, pos - 0.10), 'rgba(255,255,255,0)');
				hg.addColorStop(Math.max(0, pos - 0.03), `rgba(255,255,255,${aHi.toFixed(3)})`);
				hg.addColorStop(Math.min(1, pos + 0.03), `rgba(255,255,255,${aHi.toFixed(3)})`);
				hg.addColorStop(Math.min(1, pos + 0.10), 'rgba(255,255,255,0)');
				hg.addColorStop(1.0, 'rgba(255,255,255,0)');

				// Rotación y flip tipo "hoja de papel" (más lento en background)
				ctx.rotate(p.angle);
				const flip = Math.sin(ts * 0.0025 + (p.phase || 0)) * (p.flutter || 1.0);
				const sy = 0.25 + 0.75 * Math.abs(flip); // 0.25 .. 1.0
				ctx.scale(1, sy);

				// Relleno base
				ctx.fillStyle = base;
				ctx.beginPath();
				ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
				ctx.fill();
				// (halo removido para evitar "anillo")

				// Destello superpuesto
				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				ctx.beginPath();
				ctx.ellipse(0, 0, r * 0.80, r * 0.80, 0, 0, Math.PI * 2); // limitar highlight más al centro
				ctx.clip();
				ctx.fillStyle = hg;
				ctx.fillRect(-r, -r, r * 2, r * 2);

				ctx.restore();
				ctx.restore();
			} else {
				// brillo/centelleo en pétalos
				const t = ts * 0.001 * p.blinkSpeed + i;
				const pulse = 0.6 + 0.4 * Math.sin(t);
				const a = Math.max(0.05, Math.min(1, p.alpha * pulse));

				// render: pétalo (forma de lágrima con degradado rosado y borde)
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.angle);
				// ligera curvatura (curl) con deformación
				const curl = 1 + Math.sin(ts * 0.0018 + i) * 0.08;
				ctx.transform(curl, 0, 0.08, 1, 0, 0);

				// cuerpo con degradado
				const lg = ctx.createLinearGradient(0, -p.h, 0, p.h);
				lg.addColorStop(0, hexToRgba(PETAL1, a * 0.95));
				lg.addColorStop(1, hexToRgba(PETAL2, a * 0.65));

				ctx.fillStyle = lg;
				ctx.beginPath();
				ctx.moveTo(0, -p.h);
				ctx.bezierCurveTo(p.w, -p.h * 0.25, p.w * 0.9, p.h * 0.35, 0, p.h);
				ctx.bezierCurveTo(-p.w * 0.9, p.h * 0.35, -p.w, -p.h * 0.25, 0, -p.h);
				ctx.closePath();
				ctx.fill();

				// borde más intenso
				ctx.strokeStyle = hexToRgba(PETAL_EDGE, a * 0.35);
				ctx.lineWidth = Math.max(0.5, Math.min(p.w, p.h) * 0.12);
				ctx.stroke();

				// brillo amarillento en la base
				const rg = ctx.createRadialGradient(0, p.h * 0.7, 1, 0, p.h * 0.7, p.h * 0.7);
				rg.addColorStop(0, hexToRgba(PETAL_BASE, a * 0.25));
				rg.addColorStop(1, hexToRgba(PETAL_BASE, 0));
				ctx.fillStyle = rg;
				ctx.beginPath();
				ctx.moveTo(0, -p.h);
				ctx.bezierCurveTo(p.w, -p.h * 0.25, p.w * 0.9, p.h * 0.35, 0, p.h);
				ctx.bezierCurveTo(-p.w * 0.9, p.h * 0.35, -p.w, -p.h * 0.25, 0, -p.h);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}
		}

		// Actualizar/dibujar burst
		for (let i = bursts.length - 1; i >= 0; i--) {
			const b = bursts[i];
			b.life += dt;
			if (b.life >= b.max) { bursts.splice(i, 1); continue; }
			// arrastre y leve gravedad
			b.vx *= Math.pow(0.97, dt * 60);            // menos arrastre
			b.vy = b.vy * Math.pow(0.97, dt * 60) + 25 * dt; // gravedad más suave
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			b.angle += b.spin * dt;
			const a = Math.max(0, 1 - b.life / b.max) * b.alpha;
			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(b.angle);
			if (IS_CONFETTI) {
				const r = Math.max(8, (b.w ? Math.min(b.w, b.h) * 0.95 : 10));
				const col = b.color || GOLD;
				// Crear gradientes en espacio global para luz fija
				const lx = Math.cos(LIGHT_ANGLE), ly = Math.sin(LIGHT_ANGLE);
				// Base radial también para bursts (un poco menos blur)
				const base = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
				base.addColorStop(0.00, hexToRgba(col, a * 0.95));
				base.addColorStop(0.88, hexToRgba(col, a * 0.86));
				base.addColorStop(1.00, hexToRgba(col, a * 0.18));
				const hg = ctx.createLinearGradient(-lx * r, -ly * r, lx * r, ly * r);
				const pos = 0.5 + Math.sin(ts * 0.004 + i) * 0.08;
				const aHi = Math.min(0.45, 0.26 * a + 0.18);
				hg.addColorStop(0.0, 'rgba(255,255,255,0)');
				hg.addColorStop(Math.max(0, pos - 0.10), 'rgba(255,255,255,0)');
				hg.addColorStop(Math.max(0, pos - 0.03), `rgba(255,255,255,${aHi.toFixed(3)})`);
				hg.addColorStop(Math.min(1, pos + 0.03), `rgba(255,255,255,${aHi.toFixed(3)})`);
				hg.addColorStop(Math.min(1, pos + 0.10), 'rgba(255,255,255,0)');
				hg.addColorStop(1.0, 'rgba(255,255,255,0)');

				// Rotación y flip tipo hoja de papel
				const flip = Math.sin(ts * 0.006 + (b.phase || 0)) * (b.flutter || 1.0);
				const sy = 0.25 + 0.75 * Math.abs(flip);
				ctx.scale(1, sy);

				// base (sin halo previo)
				ctx.fillStyle = base;
				ctx.beginPath();
				ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
				ctx.fill();

				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				ctx.beginPath();
				ctx.ellipse(0, 0, r * 0.80, r * 0.80, 0, 0, Math.PI * 2); // limitar highlight más al centro
				ctx.clip();
				ctx.fillStyle = hg;
				ctx.fillRect(-r, -r, r * 2, r * 2);

				ctx.restore();
			} else {
				const lg2 = ctx.createLinearGradient(0, -b.h, 0, b.h);
				lg2.addColorStop(0, hexToRgba(PETAL1, a));
				lg2.addColorStop(1, hexToRgba(PETAL2, a * 0.7));
				ctx.fillStyle = lg2;
				ctx.beginPath();
				ctx.moveTo(0, -b.h);
				ctx.bezierCurveTo(b.w, -b.h * 0.25, b.w * 0.9, b.h * 0.35, 0, b.h);
				ctx.bezierCurveTo(-b.w * 0.9, b.h * 0.35, -b.w, -b.h * 0.25, 0, -b.h);
				ctx.closePath();
				ctx.fill();
				// borde
				ctx.strokeStyle = hexToRgba(PETAL_EDGE, a * 0.35);
				ctx.lineWidth = Math.max(0.5, Math.min(b.w, b.h) * 0.12);
				ctx.stroke();
				// brillo de base
				const rg2 = ctx.createRadialGradient(0, b.h * 0.7, 1, 0, b.h * 0.7, b.h * 0.7);
				rg2.addColorStop(0, hexToRgba(PETAL_BASE, a * 0.25));
				rg2.addColorStop(1, hexToRgba(PETAL_BASE, 0));
				ctx.fillStyle = rg2;
				ctx.beginPath();
				ctx.moveTo(0, -b.h);
				ctx.bezierCurveTo(b.w, -b.h * 0.25, b.w * 0.9, b.h * 0.35, 0, b.h);
				ctx.bezierCurveTo(-b.w * 0.9, b.h * 0.35, -b.w, -b.h * 0.25, 0, -b.h);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		}

		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);

	function hexToRgba(hex, alpha) {
		const h = hex.replace('#','');
		const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	function hexToRgb(hex) {
		const h = hex.replace('#','');
		const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
		if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
		const n = parseInt(v, 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	}
})();


