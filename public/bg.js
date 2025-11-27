(() => {
	// Permite forzar animación vía ?anim=1 (o desactivar con ?anim=0)
	const qs = new URLSearchParams(window.location.search);
	const animOverride = qs.get('anim');
	if (animOverride === '1') {
		localStorage.setItem('ANIM_BG', '1');
	} else if (animOverride === '0') {
		localStorage.setItem('ANIM_BG', '0');
	}
	const stored = localStorage.getItem('ANIM_BG');
	const forceAnim = stored === '1';
	const forceOff = stored === '0';

	// Respeta la preferencia del usuario salvo que se fuerce
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
	const BG = (css.getPropertyValue('--bg') || '#223145').trim();
	const GOLD_A = '#d4af37';
	const GOLD_B = (css.getPropertyValue('--primary') || '#d4af37').trim();

	// Pre-render de un brillo circular para eficiencia
	function createGlow(radius) {
		const s = radius * 2;
		const off = document.createElement('canvas');
		off.width = off.height = s;
		const octx = off.getContext('2d');
		const g = octx.createRadialGradient(radius, radius, 0, radius, radius, radius);
		g.addColorStop(0, 'rgba(230, 200, 115, 0.35)');
		g.addColorStop(0.5, 'rgba(212, 175, 55, 0.20)');
		g.addColorStop(1, 'rgba(212, 175, 55, 0.00)');
		octx.fillStyle = g;
		octx.fillRect(0, 0, s, s);
		return off;
	}

	// Partículas tipo "brillos" (velocidades en px/segundo)
	const BLOBS = Array.from({ length: 14 }).map(() => {
		const r = 70 + Math.random() * 160;
		return {
			x: Math.random() * width,
			y: Math.random() * height,
			r,
			vx: (Math.random() * 30 - 15), // px/s
			vy: (Math.random() * 30 - 15), // px/s
			img: createGlow(r),
			opacity: 0.45 + Math.random() * 0.4
		};
	});

	let last = 0;
	function tick(ts) {
		// Delta de tiempo (segundos)
		const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
		last = ts;

		// Limpiar fondo
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, width, height);

		// Dibujar brillos con aditivo
		ctx.globalCompositeOperation = 'lighter';
		const t = ts * 0.001;
		BLOBS.forEach((b, idx) => {
			// Movimiento base (px/s) + ondulación (px) escalada por dt
			b.x += b.vx * dt + Math.cos(t * 0.8 + idx) * 10 * dt;
			b.y += b.vy * dt + Math.sin(t * 0.9 + idx * 0.7) * 8 * dt;

			// rebote suave en bordes
			if (b.x < -b.r) b.x = width + b.r;
			if (b.x > width + b.r) b.x = -b.r;
			if (b.y < -b.r) b.y = height + b.r;
			if (b.y > height + b.r) b.y = -b.r;

			// leve pulso de opacidad
			const pulse = 0.8 + 0.2 * Math.sin(t * 1.1 + idx);
			ctx.globalAlpha = Math.max(0, Math.min(1, b.opacity * pulse));
			ctx.drawImage(b.img, b.x - b.r, b.y - b.r);
		});
		ctx.globalAlpha = 1;

		// Velo dorado sutil
		const grad = ctx.createRadialGradient(width * 0.8, height * 0.1, 0, width * 0.8, height * 0.1, Math.max(width, height) * 0.9);
		grad.addColorStop(0, 'rgba(212, 175, 55, 0.06)');
		grad.addColorStop(1, 'rgba(212, 175, 55, 0.00)');
		ctx.globalCompositeOperation = 'lighter';
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, width, height);

		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
})();


