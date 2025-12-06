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
	const COUNT = 180;
	const particles = Array.from({ length: COUNT }).map(() => ({
		x: seeded() * width,
		y: seeded() * height,
		r: sr(0.8, 2.6),
		vx: sr(-20, 20),   // px/s
		vy: sr(-16, 16),   // px/s
		alpha: sr(0.4, 0.95),
		blinkSpeed: sr(0.6, 1.6), // Hz
		w: sr(3.0, 6.0),         // ancho de la hoja
		h: sr(1.6, 3.2),         // alto de la hoja
		angle: sr(0, Math.PI * 2),
		spin: sr(-0.6, 0.6)      // rotación rad/s
	}));

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

			// render: hoja elíptica dorada (con degradado lineal sutil)
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			const lg = ctx.createLinearGradient(-p.w, -p.h, p.w, p.h);
			lg.addColorStop(0, hexToRgba(GOLD, a * 0.85));
			lg.addColorStop(1, hexToRgba(GOLD, a * 0.55));
			ctx.fillStyle = lg;
			ctx.beginPath();
			ctx.ellipse(0, 0, p.w, p.h, 0, 0, Math.PI * 2);
			ctx.fill();
			// nervadura
			ctx.strokeStyle = hexToRgba('#000000', a * 0.08);
			ctx.lineWidth = Math.max(0.4, Math.min(p.w, p.h) * 0.12);
			ctx.beginPath();
			ctx.moveTo(-p.w * 0.7, 0);
			ctx.lineTo(p.w * 0.7, 0);
			ctx.stroke();
			ctx.restore();
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
			ctx.strokeStyle = hexToRgba(GOLD, a * 0.9);
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
	function hexToRgb(hex) {
		const h = hex.replace('#','');
		const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
		if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
		const n = parseInt(v, 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	}
})();


