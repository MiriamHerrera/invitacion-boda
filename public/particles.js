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
	const SPARKLE_COLOR = (css.getPropertyValue('--sparkle-color') || css.getPropertyValue('--primary') || 'rgb(165 146 82 / 49%)').trim();

	// Elegir modo de mezcla según luminancia del fondo: en fondos claros,
	// usar 'source-over' para que los destellos se vean sobre blanco;
	// en fondos oscuros, mantener 'lighter' para brillo aditivo.
	function hexToRgb(hex) {
		const h = hex.replace('#', '');
		const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
		const num = parseInt(full, 16);
		return {
			r: (num >> 16) & 255,
			g: (num >> 8) & 255,
			b: num & 255
		};
	}
	function relLuminance({ r, g, b }) {
		function toLinear(c) {
			const cs = c / 255;
			return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
		}
		const R = toLinear(r);
		const G = toLinear(g);
		const B = toLinear(b);
		return 0.2126 * R + 0.7152 * G + 0.0722 * B;
	}
	function parseCssColorToRgba(color) {
		const c = color.trim();
		if (c.startsWith('#')) {
			const { r, g, b } = hexToRgb(c);
			return { r, g, b, a: 1 };
		}
		const modern = /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i;
		const classic = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i;
		let m = c.match(modern) || c.match(classic);
		if (m) {
			let r = Math.max(0, Math.min(255, Number(m[1])));
			let g = Math.max(0, Math.min(255, Number(m[2])));
			let b = Math.max(0, Math.min(255, Number(m[3])));
			let a = 1;
			if (m[4] !== undefined) {
				const raw = String(m[4]).trim();
				a = raw.endsWith('%') ? Math.max(0, Math.min(1, Number(raw.slice(0, -1)) / 100)) : Math.max(0, Math.min(1, Number(raw)));
			}
			return { r, g, b, a: Number.isFinite(a) ? a : 1 };
		}
		return { r: 165, g: 146, b: 82, a: 0.49 };
	}
	function rgbaStringWithMultiplier(baseColor, alphaMultiplier) {
		const { r, g, b, a } = parseCssColorToRgba(baseColor);
		const finalA = Math.max(0, Math.min(1, a * alphaMultiplier));
		return `rgba(${r}, ${g}, ${b}, ${finalA})`;
	}
	let compositeMode = 'lighter';
	try {
		const bgRgb = hexToRgb(BG);
		const lum = relLuminance(bgRgb);
		// Umbral ~0.6: fondos claros como #fff (~1.0) cambian a 'source-over'
		if (lum >= 0.6) compositeMode = 'source-over';
	} catch (_) {
		// si falla, conservar 'lighter'
	}

	function rand(min, max) { return Math.random() * (max - min) + min; }
	function introIsOpen() {
		const body = document.body;
		if (body && body.classList.contains('intro-open')) return true;
		const overlay = document.getElementById('intro-envelope');
		return !!(overlay && !overlay.hidden && !overlay.classList.contains('is-hidden'));
	}

	// Partículas doradas (conteo fijo para consistencia)
	const COUNT = 180;
	function spawnParticleAtEdge() {
		// Elige un borde: 0=izq,1=der,2=arriba,3=abajo
		const edge = Math.floor(sr(0, 4));
		let x = 0, y = 0, vx = 0, vy = 0;
		if (edge === 0) { // izquierda
			x = -5; y = sr(0, height);
			vx = sr(12, 28); vy = sr(-10, 10);
		} else if (edge === 1) { // derecha
			x = width + 5; y = sr(0, height);
			vx = -sr(12, 28); vy = sr(-10, 10);
		} else if (edge === 2) { // arriba
			x = sr(0, width); y = -5;
			vx = sr(-12, 12); vy = sr(10, 24);
		} else { // abajo
			x = sr(0, width); y = height + 5;
			vx = sr(-12, 12); vy = -sr(10, 24);
		}
		return {
			x, y,
			r: sr(0.8, 2.6),
			vx,   // px/s
			vy,   // px/s
			alpha: sr(0.5, 0.95),
			blinkSpeed: sr(0.6, 1.6) // Hz
		};
	}
	function isTooCentral(px, py) {
		const margin = Math.min(width, height) * 0.32;
		return px > margin && px < (width - margin) && py > margin && py < (height - margin);
	}
	const particles = Array.from({ length: COUNT }).map(() => spawnParticleAtEdge());

	// Chispazos al tocar/click: partículas efímeras con trazo
	const sparks = [];
	function spawnBurst(x, y) {
		const N = 28 + Math.floor(Math.random() * 18);
		for (let i = 0; i < N; i++) {
			const ang = Math.random() * Math.PI * 2;
			const speed = rand(80, 220); // px/s
			const life = rand(0.5, 0.9); // s
			sparks.push({
				x, y,
				px: x, py: y, // posición previa para trazo
				vx: Math.cos(ang) * speed,
				vy: Math.sin(ang) * speed,
				life: 0,
				max: life,
				size: rand(1, 2.5)
			});
		}
	}

	// Listener global (canvas tiene pointer-events: none)
	window.addEventListener('pointerdown', (e) => spawnBurst(e.clientX, e.clientY), { passive: true });

	let last = 0;
	function tick(ts) {
		const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
		last = ts;

		// Si el sobre está visible, ocultar el canvas y pausar render
		if (introIsOpen()) {
			if (canvas.style.display !== 'none') canvas.style.display = 'none';
			requestAnimationFrame(tick);
			return;
		} else {
			if (canvas.style.display === 'none') canvas.style.display = '';
		}

		// Fondo
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, width, height);

		// Partículas
		ctx.globalCompositeOperation = compositeMode;
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			// movimiento
			p.x += p.vx * dt;
			p.y += p.vy * dt;

			// Reaparecer en bordes si sale o si entra demasiado al centro
			if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10 || isTooCentral(p.x, p.y)) {
				const fresh = spawnParticleAtEdge();
				p.x = fresh.x; p.y = fresh.y; p.vx = fresh.vx; p.vy = fresh.vy;
				p.r = fresh.r; p.alpha = fresh.alpha; p.blinkSpeed = fresh.blinkSpeed;
			}

			// brillo/centelleo
			const t = ts * 0.001 * p.blinkSpeed + i;
			const pulse = 0.6 + 0.4 * Math.sin(t);
			const a = Math.max(0.05, Math.min(1, p.alpha * pulse));

			// render: círculo con leve halo
			const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
			grad.addColorStop(0, rgbaStringWithMultiplier(SPARKLE_COLOR, a));
			grad.addColorStop(0.6, rgbaStringWithMultiplier(SPARKLE_COLOR, a * 0.35));
			grad.addColorStop(1, rgbaStringWithMultiplier(SPARKLE_COLOR, 0));
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
			ctx.fill();

			// núcleo
			ctx.fillStyle = `${hexToRgba('#ffffff', a * 0.8)}`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}

		// Actualizar/dibujar chispas
		// Físicas sencillas: leve gravedad y fricción
		for (let i = sparks.length - 1; i >= 0; i--) {
			const s = sparks[i];
			s.life += dt;
			if (s.life >= s.max) { sparks.splice(i, 1); continue; }

			// Guardar posición previa
			s.px = s.x; s.py = s.y;

			// Update
			s.vx *= Math.pow(0.9, dt * 60); // arrastre
			s.vy *= Math.pow(0.9, dt * 60);
			s.vy += 60 * dt; // gravedad suave

			s.x += s.vx * dt;
			s.y += s.vy * dt;

			// Alpha según vida
			const a = Math.max(0, 1 - s.life / s.max);
			ctx.strokeStyle = rgbaStringWithMultiplier(SPARKLE_COLOR, a * 0.9);
			ctx.lineWidth = Math.max(0.5, s.size * a);
			ctx.beginPath();
			ctx.moveTo(s.px, s.py);
			ctx.lineTo(s.x, s.y);
			ctx.stroke();

			// pequeño núcleo en el extremo
			ctx.fillStyle = hexToRgba('#ffffff', a * 0.6);
			ctx.beginPath();
			ctx.arc(s.x, s.y, Math.max(0.6, s.size * 0.6 * a), 0, Math.PI * 2);
			ctx.fill();
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
})();


