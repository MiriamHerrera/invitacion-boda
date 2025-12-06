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
	const GOLD = (css.getPropertyValue('--primary') || '#d4af37').trim();

	function rand(min, max) { return Math.random() * (max - min) + min; }

	// Partículas (hojas elípticas doradas) - conteo fijo para consistencia
	const COUNT = 50; // menos hojas para un fondo más sutil
	const particles = Array.from({ length: COUNT }).map(() => ({
		x: seeded() * width,
		y: seeded() * height,
		r: sr(0.8, 2.6),
		vx: sr(-20, 20),   // px/s
		vy: sr(-16, 16),   // px/s
		alpha: sr(0.4, 0.95),
		blinkSpeed: sr(0.6, 1.6), // Hz
		w: sr(6.0, 12.0),        // ancho de la hoja (más grande)
		h: sr(3.2, 6.4),         // alto de la hoja (más grande)
		angle: sr(0, Math.PI * 2),
		spin: sr(-0.6, 0.6)      // rotación rad/s
	}));

	// Al tocar/clic: brotan hojas elípticas (no líneas)
	const bursts = [];
	function spawnBurst(x, y) {
		const N = 10 + Math.floor(Math.random() * 8);
		for (let i = 0; i < N; i++) {
			const ang = Math.random() * Math.PI * 2;
			const speed = rand(90, 220); // px/s (más lejos)
			const life = rand(1.2, 2.0); // s (más duración)
			const w = rand(8, 16);
			const h = rand(4, 9);
			bursts.push({
				x, y,
				vx: Math.cos(ang) * speed,
				vy: Math.sin(ang) * speed,
				life: 0,
				max: life,
				w, h,
				angle: Math.random() * Math.PI * 2,
				spin: rand(-1.2, 1.2),
				alpha: rand(0.65, 1)
			});
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

			// brillo/centelleo
			const t = ts * 0.001 * p.blinkSpeed + i;
			const pulse = 0.6 + 0.4 * Math.sin(t);
			const a = Math.max(0.05, Math.min(1, p.alpha * pulse));

			// render: hoja dorada con puntas y venas (beziers)
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			const lg = ctx.createLinearGradient(0, -p.h, 0, p.h);
			lg.addColorStop(0, hexToRgba(GOLD, a * 0.85));
			lg.addColorStop(1, hexToRgba(GOLD, a * 0.55));
			ctx.fillStyle = lg;
			// forma de hoja (dos beziers)
			ctx.beginPath();
			ctx.moveTo(0, -p.h);
			ctx.bezierCurveTo(p.w, -p.h * 0.3, p.w, p.h * 0.3, 0, p.h);
			ctx.bezierCurveTo(-p.w, p.h * 0.3, -p.w, -p.h * 0.3, 0, -p.h);
			ctx.closePath();
			ctx.fill();
			// nervadura principal
			ctx.strokeStyle = hexToRgba('#000000', a * 0.14);
			ctx.lineWidth = Math.max(0.5, Math.min(p.w, p.h) * 0.12);
			ctx.beginPath();
			ctx.moveTo(0, -p.h * 0.95);
			ctx.lineTo(0, p.h * 0.95);
			ctx.stroke();
			// venas secundarias (tres por lado)
			ctx.strokeStyle = hexToRgba('#000000', a * 0.10);
			ctx.lineWidth = Math.max(0.3, Math.min(p.w, p.h) * 0.06);
			for (let k = -2; k <= 2; k++) {
				if (k === 0) continue;
				const t2 = k / 3;
				const y2 = t2 * p.h * 0.85;
				const dir2 = k < 0 ? -1 : 1;
				ctx.beginPath();
				ctx.moveTo(0, y2);
				ctx.quadraticCurveTo(dir2 * p.w * 0.35, y2 + dir2 * p.h * 0.10, dir2 * p.w * 0.6, y2 + dir2 * p.h * 0.02);
				ctx.stroke();
			}
			ctx.restore();
		}

		// Actualizar/dibujar hojas del burst
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
			const lg2 = ctx.createLinearGradient(0, -b.h, 0, b.h);
			lg2.addColorStop(0, hexToRgba(GOLD, a));
			lg2.addColorStop(1, hexToRgba(GOLD, a * 0.6));
			ctx.fillStyle = lg2;
			ctx.beginPath();
			ctx.moveTo(0, -b.h);
			ctx.bezierCurveTo(b.w, -b.h * 0.3, b.w, b.h * 0.3, 0, b.h);
			ctx.bezierCurveTo(-b.w, b.h * 0.3, -b.w, -b.h * 0.3, 0, -b.h);
			ctx.closePath();
			ctx.fill();
			// nervadura principal
			ctx.strokeStyle = hexToRgba('#000000', a * 0.16);
			ctx.lineWidth = Math.max(0.5, Math.min(b.w, b.h) * 0.12);
			ctx.beginPath();
			ctx.moveTo(0, -b.h * 0.95);
			ctx.lineTo(0, b.h * 0.95);
			ctx.stroke();
			// venas secundarias
			ctx.strokeStyle = hexToRgba('#000000', a * 0.10);
			ctx.lineWidth = Math.max(0.3, Math.min(b.w, b.h) * 0.06);
			for (let k = -2; k <= 2; k++) {
				if (k === 0) continue;
				const t2 = k / 3;
				const y2 = t2 * b.h * 0.85;
				const dir2 = k < 0 ? -1 : 1;
				ctx.beginPath();
				ctx.moveTo(0, y2);
				ctx.quadraticCurveTo(dir2 * b.w * 0.35, y2 + dir2 * b.h * 0.10, dir2 * b.w * 0.6, y2 + dir2 * b.h * 0.02);
				ctx.stroke();
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


