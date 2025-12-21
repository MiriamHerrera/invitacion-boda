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
	const SPARKLE_COLOR = (css.getPropertyValue('--sparkle-color') || css.getPropertyValue('--primary') || 'rgb(165 146 82 / 49%)').trim();

	// Elegir modo de mezcla según luminancia del fondo
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
		const lum = relLuminance(hexToRgb(BG));
		if (lum >= 0.6) compositeMode = 'source-over';
	} catch (_) {
		// fallback a 'lighter'
	}

	// Pre-render de un brillo circular para eficiencia
	function createGlow(radius) {
		const s = radius * 2;
		const off = document.createElement('canvas');
		off.width = off.height = s;
		const octx = off.getContext('2d');
		const g = octx.createRadialGradient(radius, radius, 0, radius, radius, radius);
		g.addColorStop(0, rgbaStringWithMultiplier(SPARKLE_COLOR, 1.0)); // base (con alpha del color)
		g.addColorStop(0.5, rgbaStringWithMultiplier(SPARKLE_COLOR, 0.57)); // leve descenso
		g.addColorStop(1, rgbaStringWithMultiplier(SPARKLE_COLOR, 0.0)); // borde transparente
		octx.fillStyle = g;
		octx.fillRect(0, 0, s, s);
		return off;
	}

	// Partículas tipo "brillos" emergiendo desde bordes
	function spawnBlobAtEdge() {
		const edge = Math.floor(Math.random() * 4);
		const r = 70 + Math.random() * 160;
		let x = 0, y = 0, vx = 0, vy = 0;
		if (edge === 0) { // izquierda
			x = -r; y = Math.random() * height;
			vx = 10 + Math.random() * 22; vy = (Math.random() * 20 - 10);
		} else if (edge === 1) { // derecha
			x = width + r; y = Math.random() * height;
			vx = -(10 + Math.random() * 22); vy = (Math.random() * 20 - 10);
		} else if (edge === 2) { // arriba
			x = Math.random() * width; y = -r;
			vx = (Math.random() * 20 - 10); vy = 8 + Math.random() * 18;
		} else { // abajo
			x = Math.random() * width; y = height + r;
			vx = (Math.random() * 20 - 10); vy = -(8 + Math.random() * 18);
		}
		return {
			x, y, r, vx, vy,
			img: createGlow(r),
			opacity: 0.45 + Math.random() * 0.4
		};
	}
	function isTooCentral(px, py, rad) {
		const margin = Math.min(width, height) * 0.30;
		return px > margin && px < (width - margin) && py > margin && py < (height - margin);
	}
	const BLOBS = Array.from({ length: 14 }).map(() => spawnBlobAtEdge());

	let last = 0;
	function tick(ts) {
		// Delta de tiempo (segundos)
		const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
		last = ts;

		// Si el sobre está visible, ocultar el canvas y pausar render
		const body = document.body;
		const overlay = document.getElementById('intro-envelope');
		const introOpen = (body && body.classList.contains('intro-open')) || (overlay && !overlay.hidden && !overlay.classList.contains('is-hidden'));
		if (introOpen) {
			if (canvas.style.display !== 'none') canvas.style.display = 'none';
			requestAnimationFrame(tick);
			return;
		} else {
			if (canvas.style.display === 'none') canvas.style.display = '';
		}

		// Limpiar fondo
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, width, height);

		// Dibujar brillos con aditivo
		ctx.globalCompositeOperation = compositeMode;
		const t = ts * 0.001;
		BLOBS.forEach((b, idx) => {
			// Movimiento base (px/s) + ondulación (px) escalada por dt
			b.x += b.vx * dt + Math.cos(t * 0.8 + idx) * 10 * dt;
			b.y += b.vy * dt + Math.sin(t * 0.9 + idx * 0.7) * 8 * dt;

			// Reaparecer en bordes si salen o si entran demasiado al centro
			if (b.x < -b.r * 1.5 || b.x > width + b.r * 1.5 || b.y < -b.r * 1.5 || b.y > height + b.r * 1.5 || isTooCentral(b.x, b.y, b.r)) {
				const fresh = spawnBlobAtEdge();
				b.x = fresh.x; b.y = fresh.y; b.vx = fresh.vx; b.vy = fresh.vy;
				b.r = fresh.r; b.img = fresh.img; b.opacity = fresh.opacity;
			}

			// leve pulso de opacidad
			const pulse = 0.8 + 0.2 * Math.sin(t * 1.1 + idx);
			ctx.globalAlpha = Math.max(0, Math.min(1, b.opacity * pulse));
			ctx.drawImage(b.img, b.x - b.r, b.y - b.r);
		});
		ctx.globalAlpha = 1;

		// Velo dorado sutil
		const grad = ctx.createRadialGradient(width * 0.8, height * 0.1, 0, width * 0.8, height * 0.1, Math.max(width, height) * 0.9);
		grad.addColorStop(0, rgbaStringWithMultiplier(SPARKLE_COLOR, 0.06 / 0.49)); // mantener ~0.06 con base 0.49
		grad.addColorStop(1, rgbaStringWithMultiplier(SPARKLE_COLOR, 0));
		ctx.globalCompositeOperation = compositeMode;
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, width, height);

		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
})();


