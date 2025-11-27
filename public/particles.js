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

	// Partículas doradas
	const COUNT = Math.round(Math.min(220, Math.max(100, (width * height) / 12000)));
	const particles = Array.from({ length: COUNT }).map(() => ({
		x: Math.random() * width,
		y: Math.random() * height,
		r: rand(0.8, 2.6),
		vx: rand(-20, 20),   // px/s
		vy: rand(-16, 16),   // px/s
		alpha: rand(0.4, 0.95),
		blinkSpeed: rand(0.6, 1.6) // Hz
	}));

	let last = 0;
	function tick(ts) {
		const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
		last = ts;

		// Fondo
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, width, height);

		// Partículas
		ctx.globalCompositeOperation = 'lighter';
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			// movimiento
			p.x += p.vx * dt;
			p.y += p.vy * dt;

			// envolver suavemente
			if (p.x < -5) p.x = width + 5;
			if (p.x > width + 5) p.x = -5;
			if (p.y < -5) p.y = height + 5;
			if (p.y > height + 5) p.y = -5;

			// brillo/centelleo
			const t = ts * 0.001 * p.blinkSpeed + i;
			const pulse = 0.6 + 0.4 * Math.sin(t);
			const a = Math.max(0.05, Math.min(1, p.alpha * pulse));

			// render: círculo con leve halo
			const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
			grad.addColorStop(0, `${hexToRgba(GOLD, a)}`);
			grad.addColorStop(0.6, `${hexToRgba(GOLD, a * 0.35)}`);
			grad.addColorStop(1, `${hexToRgba(GOLD, 0)}`);
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


