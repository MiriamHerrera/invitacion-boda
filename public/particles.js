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

	// Modo rendimiento: por defecto ACTIVADO, se puede controlar con ?perf=1|0
	const perfOverride = qs.get('perf');
	if (perfOverride === '1') localStorage.setItem('PERF_MODE', '1');
	if (perfOverride === '0') localStorage.setItem('PERF_MODE', '0');
	const perfStored = localStorage.getItem('PERF_MODE');
	const PERF_MODE = perfStored ? (perfStored === '1') : true;

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
	// Random sesgado: exp>1 sesga hacia valores pequeños, exp<1 hacia grandes
	function srb(min, max, exp = 1) {
		const u = Math.max(0, Math.min(1, seeded()));
		const t = Math.pow(u, exp);
		return t * (max - min) + min;
	}

	const canvas = document.getElementById('bg-canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');

	let dpr = Math.min(window.devicePixelRatio || 1, PERF_MODE ? 1.25 : 2);
	let width = 0;
	let height = 0;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, PERF_MODE ? 1.25 : 2);
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
	const PRIMARY = (css.getPropertyValue('--primary') || '#a48729').trim(); // para chispazos de click
	const ORANGE = (css.getPropertyValue('--sparkle-orange') || '#ffff00').trim(); // puntos naranja
	const BLACK = '#a48729'; // puntos blancos

	// Zona de exclusión sobre el título (no dibujar cortina encima)
	let exclusionRect = null; // {left, top, right, bottom}
	function computeExclusionRect() {
		try {
			const el = document.querySelector('.couple');
			if (!el) { exclusionRect = null; return; }
			const r = el.getBoundingClientRect();
			// Menos padding en móvil para no comer los costados
			const isMobile = window.innerWidth <= 640;
			const padX = isMobile ? Math.max(4, Math.min(16, r.width * 0.02)) : Math.max(8, Math.min(28, r.width * 0.03));
			const padY = isMobile ? Math.max(8, Math.min(28, r.height * 0.14)) : Math.max(10, Math.min(40, r.height * 0.18));
			exclusionRect = {
				left: r.left - padX,
				right: r.right + padX,
				top: r.top - padY,
				bottom: r.bottom + padY,
				width: r.width + padX * 2,
				height: r.height + padY * 2
			};
		} catch (_) {
			exclusionRect = null;
		}
	}
	window.addEventListener('resize', computeExclusionRect, { passive: true });
	window.addEventListener('scroll', computeExclusionRect, { passive: true });
	computeExclusionRect();

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

	// Partículas doradas (cortina en arco)
	function detectCols() { return (window.innerWidth <= 640 ? 12 : 50); }
	let COLS = detectCols(); // móvil: 10, desktop: 20
	const EDGE_BIAS_ALPHA = 0.6; // <1 => más densidad hacia orillas
	// Sin hueco central: columnas también pasan por el medio
	function detectGap() { return 0; }
	let CURTAIN_GAP = detectGap();
	// "Cuentas" discretas por columna (look de puntos de luz)
	const BEAD_STEP_BASE = 12;
	const BEAD_STEP = PERF_MODE ? 12 : Math.max(10, BEAD_STEP_BASE - 2); // más denso incluso en perf
	const BEAD_POWER = 14;     // nitidez (mayor = más definido)
	// Movimiento cilíndrico hacia afuera (sin ondular la línea):
	// la columna completa se desplaza lateralmente según el tiempo.
	const ROT_TIME_SPEED = 0.9;      // velocidad temporal del giro
	const ROT_AMP_BASE = 2.0;        // amplitud mínima (px)
	const ROT_AMP_EDGE = 6.0;        // amplitud adicional hacia orillas (px)
	const ROT_PHASE_PER_COL = 0.25;  // desfase por columna (para evitar sincronía total)
	function columnCenter(col) {
		// Distribuir columnas solo en las orillas, dejando un gap central
		const leftCols = Math.floor(COLS / 2);
		const rightCols = COLS - leftCols;
		const halfRegion = Math.max(0, (1 - CURTAIN_GAP) / 2); // fracción asignada a cada cortina lateral
		let u = 0.5;
		if (col < leftCols) {
			// lado izquierdo
			const localU = (col + 0.5) / Math.max(1, leftCols); // 0..1
			const t = localU * 2 - 1; // -1..1
			const v = (t === 0) ? 0 : Math.sign(t) * Math.pow(Math.abs(t), EDGE_BIAS_ALPHA);
			const ub = (v + 1) * 0.5; // 0..1
			u = ub * halfRegion; // 0 .. halfRegion
		} else {
			// lado derecho
			const localU = ((col - leftCols) + 0.5) / Math.max(1, rightCols); // 0..1
			const t = localU * 2 - 1; // -1..1
			const v = (t === 0) ? 0 : Math.sign(t) * Math.pow(Math.abs(t), EDGE_BIAS_ALPHA);
			const ub = (v + 1) * 0.5;
			u = (1 - halfRegion) + ub * halfRegion; // (1-halfRegion) .. 1
		}
		return u * width;
	}
	function archEndYForX(x) {
		// Perfil CURVADO tipo arco: centro corto, orillas largas con suavizado
		const cx = width * 0.5;
		const norm = width > 0 ? Math.min(1, Math.abs((x - cx) / (width * 0.5))) : 0; // 0..1
		// Curva suave (ease-out) para dar forma de arco (no recta)
		const eased = 1 - Math.cos(norm * Math.PI * 0.5); // 0 en centro, 1 en orillas
		// Potenciar un poco la curva para evitar look cuadrado
		const curve = Math.pow(eased, 1.15);
		// Alturas
		const minH = height * 0.18; // aún más corto en el centro
		const maxH = height * 0.98; // más largo en las esquinas para “envolver” el borde
		// Bonus extra en las esquinas más externas para remarcar el arco
		const cornerBoost = Math.max(0, norm - 0.86) / 0.14; // 0..1 desde 0.86 a 1.0
		const boostedMax = maxH * (1 + 0.06 * Math.min(1, cornerBoost)); // hasta +6%
		return minH + (boostedMax - minH) * curve;
	}
	// Columnas móviles estilo "carrusel" hacia afuera
	const columns = [];
	function updateColsForViewport() {
		const next = detectCols();
		const nextGap = detectGap();
		if (next !== COLS) {
			COLS = next;
			rebuildColumns();
			rebuildParticles();
		}
		if (nextGap !== CURTAIN_GAP) {
			CURTAIN_GAP = nextGap;
			rebuildColumns();
			rebuildParticles();
		}
	}
	function rebuildColumns() {
		columns.length = 0;
		const halfRegion = Math.max(0, (1 - CURTAIN_GAP) / 2);
		const leftCols = Math.floor(COLS / 2);
		const rightCols = COLS - leftCols;
		const leftRegionW = width * halfRegion;
		const rightRegionW = width * halfRegion;
		const leftInnerX = leftRegionW;           // límite interno junto al gap
		const rightInnerX = width - rightRegionW; // límite interno del lado derecho
		// velocidades más lentas para una transición elegante
		const SPEED_MIN = PERF_MODE ? 8 : 10;
		const SPEED_MAX = PERF_MODE ? 14 : 16;
		for (let i = 0; i < leftCols; i++) {
			columns.push({
				side: -1, // izquierda
				regionWidth: Math.max(1, leftRegionW),
				innerX: leftInnerX,
				u: i / Math.max(1, leftCols), // espaciado uniforme
				speed: sr(SPEED_MIN, SPEED_MAX), // px/s
				irregular: sr(-height * 0.06, height * 0.12) // irregularidad de longitud
			});
		}
		for (let i = 0; i < rightCols; i++) {
			columns.push({
				side: 1, // derecha
				regionWidth: Math.max(1, rightRegionW),
				innerX: rightInnerX,
				u: i / Math.max(1, rightCols),
				speed: sr(SPEED_MIN, SPEED_MAX), // px/s
				irregular: sr(-height * 0.06, height * 0.12) // irregularidad de longitud
			});
		}
	}
	function columnXByIndex(colIndex) {
		const c = columns[colIndex];
		if (!c) return columnCenter(colIndex); // fallback
		return c.side < 0
			? c.innerX - c.u * c.regionWidth
			: c.innerX + c.u * c.regionWidth;
	}
	function columnEndY(colIndex, cx) {
		const base = archEndYForX(cx);
		const c = columns[colIndex];
		const offs = c ? c.irregular : 0;
		const minH = height * 0.16;
		const maxH = height * 0.96;
		return Math.max(minH, Math.min(maxH, base + offs));
	}
	// Generación estructurada: cuentas fijas por columna
	const particles = [];
	function rebuildParticles() {
		particles.length = 0;
		// sobre-proveer cuentas hasta la altura máxima posible
		const maxH = height * 0.92;
		const beads = Math.ceil(maxH / BEAD_STEP) + 2;
		for (let col = 0; col < COLS; col++) {
			for (let i = 0; i < beads; i++) {
				// distribuir de arriba (0) a abajo (endY)
				const y = i * BEAD_STEP; // alineado para definir mejor las líneas
				particles.push({
					col,
					y,
					r: srb(0.8, 3.0, 2.2), // sesgo a tamaños pequeños, algunos grandes
					alpha: sr(0.85, 1.0),
					blinkSpeed: sr(0.55, 1.0),
					// parámetros de luciérnaga: tasa/duración/ fase
					ffRate: sr(0.18, 0.42),   // Hz (más lento)
					ffDuty: sr(0.20, 0.40),   // parte encendida del ciclo un poco mayor
					ffPhase: sr(0, 1),
					beadPhase: 0,             // fase para realce de cuentas
					// tono del destello: mayormente dorado, algunos naranja y algunos negros
					hue: (() => {
						const u = seeded();
						return u < 0.02 ? 'black' : (u < 0.18 ? 'orange' : 'gold');
					})(),
					jitter: 0 // sin oscilación lateral
				});
				// micro-bead intercalado para aumentar abundancia (a medio paso)
				if ((!PERF_MODE && (i % 2) === 0) || (PERF_MODE && (i % 3) === 0)) {
					const y2 = y + BEAD_STEP * 0.5;
					particles.push({
						col,
						y: y2,
						r: PERF_MODE ? srb(0.25, 0.8, 1.4) : srb(0.4, 1.2, 1.3),
						alpha: PERF_MODE ? sr(0.55, 0.85) : sr(0.6, 0.95),
						blinkSpeed: PERF_MODE ? sr(0.7, 1.0) : sr(0.7, 1.3),
						ffRate: PERF_MODE ? sr(0.18, 0.46) : sr(0.22, 0.56),
						ffDuty: PERF_MODE ? sr(0.16, 0.30) : sr(0.18, 0.34),
						ffPhase: sr(0, 1),
						beadPhase: 0.5,
						hue: (() => {
							const u = seeded();
							return u < 0.02 ? 'black' : (u < 0.25 ? 'orange' : 'gold');
						})(),
						jitter: 0
					});
				}
			}
		}
	}
	// construir inicialmente tras conocer ancho/alto actuales
	updateColsForViewport();
	rebuildColumns();
	rebuildParticles();
	// reconstruir al cambiar tamaño de ventana
	window.addEventListener('resize', () => { updateColsForViewport(); });

	// Chispazos al tocar/click: partículas efímeras con trazo
	const sparks = [];
	function spawnBurst(x, y) {
		const N = (PERF_MODE ? 12 : 28) + Math.floor(Math.random() * (PERF_MODE ? 6 : 18));
		for (let i = 0; i < N; i++) {
			const ang = Math.random() * Math.PI * 2;
			const speed = rand(80, 200); // px/s (más lento)
			const life = PERF_MODE ? rand(2.6, 3.2) : rand(3.8, 4.6); // s
			sparks.push({
				x, y,
				px: x, py: y, // posición previa para trazo
				vx: Math.cos(ang) * speed,
				vy: Math.sin(ang) * speed,
				life: 0,
				max: life,
				size: rand(0.6, 1.6)
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
		// Relleno con gradiente horizontal solicitado
		const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
		bgGrad.addColorStop(0.00, 'rgba(1, 18, 41, 1)');
		bgGrad.addColorStop(0.64, 'rgba(1, 18, 41, 1)');
		bgGrad.addColorStop(1.00, 'rgb(4, 24, 53)');
		ctx.fillStyle = bgGrad;
		ctx.fillRect(0, 0, width, height);

		// Partículas
		ctx.globalCompositeOperation = compositeMode;
		// Actualizar columnas (carrusel hacia afuera)
		for (let c = 0; c < columns.length; c++) {
			const col = columns[c];
			const du = (col.speed / Math.max(1, col.regionWidth)) * dt;
			col.u += du;
			// envolver cuando sale por el borde exterior
			if (col.u >= 1) col.u -= 1;
		}
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			const cx = columnXByIndex(p.col);
			// Ajuste de altura por columna y recorte por zona de exclusión
			let endY = columnEndY(p.col, cx);
			const ex = exclusionRect;
			if (ex && cx >= ex.left && cx <= ex.right) {
				// Curva de arco por encima del título: corta más en el centro y
				// deja caer gradualmente hacia las esquinas
				const mid = (ex.left + ex.right) * 0.5;
				const half = Math.max(1, (ex.right - ex.left) * 0.5);
				const u = Math.min(1, Math.abs(cx - mid) / half); // 0..1
				// Ease-out circular para un borde suavemente curvado
				const eased = 1 - Math.sqrt(1 - u * u); // 0 en centro, 1 en orillas
				const depthCalc = Math.min((ex.height || 120) * 0.9, 140); // profundidad máx del arco
				const depth = Number.isFinite(depthCalc) ? depthCalc : 120;
				const rec = ex.top - 6 + depth * eased;
				endY = Math.min(endY, rec);
			}

			// recorte para formar el triángulo: no dibujar beads bajo la altura de su columna
			if (p.y > endY) continue;
			// No bloquear toda el área interna; el recorte curvado ya define el hueco

			// brillo/centelleo
			// Luciérnaga: pulso intermitente con envolvente on/off y leve afterglow
			const rate = p.ffRate;
			const duty = p.ffDuty;
			const cyc = (ts * 0.001 * rate + p.ffPhase) % 1;
			let ff;
			if (cyc < duty) {
				const u = cyc / Math.max(1e-4, duty); // 0..1
				// pulso suave (elevar seno para borde redondeado tipo luciérnaga)
				ff = Math.pow(Math.sin(u * Math.PI), 2.2);
			} else {
				// afterglow corto que cae rápido
				const v = (cyc - duty) / Math.max(1e-4, 1 - duty);
				ff = Math.pow(Math.max(0, 1 - v), 2.6) * 0.25;
			}
			// micro-flicker sutil
			ff *= 0.9 + 0.1 * Math.sin(ts * 0.006 + i * 1.17);
			// factor de "cuentas" discretas a lo largo de Y (puntos de luz)
			const bead = Math.pow(
				Math.max(0, Math.cos(2 * Math.PI * ((p.y / Math.max(1, BEAD_STEP)) - (p.beadPhase || 0)))),
				BEAD_POWER
			);
			// más brillo cerca de la parte alta de la columna
			const topFactor = Math.max(0, 1 - Math.max(0, p.y) / Math.max(1, endY));
			let a = Math.max(0.4, Math.min(1,
				p.alpha
				* ff
				* (0.90 + 0.10 * topFactor)
				* (0.80 + 0.20 * bead)
			));

			// Posición horizontal actual de su columna (carrusel hacia afuera)
			const rx = cx + p.jitter;

			// Render según tono: oro/naranja con halo, negro sin halo pronunciado
			if (p.hue === 'black') {
				ctx.fillStyle = rgbaStringWithMultiplier(BLACK, Math.min(1, a * 0.9));
				ctx.beginPath();
				ctx.arc(rx, p.y, Math.max(0.35, p.r * 0.55), 0, Math.PI * 2);
				ctx.fill();
			} else if (p.hue === 'orange') {
				// Render tipo destello de click (cruz) para los naranja
				const crossLen = Math.max(1.6, p.r * 3.0 * a);
				if (crossLen > 0.05) {
					ctx.save();
					ctx.translate(rx, p.y);
					ctx.lineCap = 'round';
					// halo suave de la cruz
					ctx.strokeStyle = rgbaStringWithMultiplier(ORANGE, a * 0.32);
					ctx.lineWidth = Math.max(0.6, 1.1 * a);
					// horizontal
					ctx.beginPath();
					ctx.moveTo(-crossLen, 0);
					ctx.lineTo(crossLen, 0);
					ctx.stroke();
					// vertical
					ctx.beginPath();
					ctx.moveTo(0, -crossLen);
					ctx.lineTo(0, crossLen);
					ctx.stroke();
					// núcleo más brillante y corto
					ctx.strokeStyle = rgbaStringWithMultiplier(ORANGE, Math.min(1, a * 0.7));
					ctx.lineWidth = Math.max(0.5, 0.9 * a);
					const core = crossLen * 0.7;
					ctx.beginPath();
					ctx.moveTo(-core, 0);
					ctx.lineTo(core, 0);
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(0, -core);
					ctx.lineTo(0, core);
					ctx.stroke();
					ctx.restore();
					// pequeño punto central
					ctx.fillStyle = `${hexToRgba('#ffffff', a * 0.5)}`;
					ctx.beginPath();
					ctx.arc(rx, p.y, Math.max(0.32, p.r * 0.35), 0, Math.PI * 2);
					ctx.fill();
				}
			} else {
				const base = p.hue === 'orange' ? ORANGE : SPARKLE_COLOR;
				const beadRadius = p.r * 1.8; // un poco más grande
				const outerR = beadRadius * (PERF_MODE ? 1.4 : 1.6); // halo más estrecho para menos blur
				const grad = ctx.createRadialGradient(rx, p.y, 0, rx, p.y, outerR);
				grad.addColorStop(0, rgbaStringWithMultiplier(base, a * 1.00));
				grad.addColorStop(0.18, rgbaStringWithMultiplier(base, a * 0.95));
				grad.addColorStop(0.40, rgbaStringWithMultiplier(base, a * 0.60));
				grad.addColorStop(0.80, rgbaStringWithMultiplier(base, a * 0.10));
				grad.addColorStop(1, rgbaStringWithMultiplier(base, 0));
				ctx.fillStyle = grad;
				// leve blur por sombra para reforzar el halo (barato y efectivo)
				ctx.shadowColor = rgbaStringWithMultiplier(base, a * 0.20);
				ctx.shadowBlur = 0;
				ctx.beginPath();
				ctx.arc(rx, p.y, beadRadius, 0, Math.PI * 2);
				ctx.fill();
				ctx.shadowBlur = 0;

				// núcleo
				ctx.fillStyle = `${hexToRgba('#ffffff', a * 0.85)}`;
				ctx.beginPath();
				ctx.arc(rx, p.y, Math.max(0.4, p.r * 0.4), 0, Math.PI * 2);
				ctx.fill();
			}
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
			s.vx *= Math.pow(0.95, dt * 60); // un poco más de arrastre
			s.vy *= Math.pow(0.95, dt * 60);
			s.vy += 40 * dt; // menos gravedad para caída más lenta

			s.x += s.vx * dt;
			s.y += s.vy * dt;

			// Alpha según vida
			const a = Math.max(0, 1 - s.life / s.max);
			ctx.strokeStyle = rgbaStringWithMultiplier(PRIMARY, a * 0.9);
			ctx.lineWidth = Math.max(0.4, s.size * a);
			ctx.beginPath();
			ctx.moveTo(s.px, s.py);
			ctx.lineTo(s.x, s.y);
			ctx.stroke();

			// pequeño núcleo en el extremo
			ctx.fillStyle = hexToRgba('#ffffff', a * 0.6);
			ctx.beginPath();
			ctx.arc(s.x, s.y, Math.max(0.4, s.size * 0.45 * a), 0, Math.PI * 2);
			ctx.fill();

			// mini estrella en cruz en el extremo (en perf, sólo con alfa alto)
			const crossLen = Math.max(2, s.size * 2.8 * a);
			if (crossLen > 0.1 && (!PERF_MODE || a > 0.55)) {
				ctx.save();
				ctx.translate(s.x, s.y);
				ctx.lineCap = 'round';
				// halo suave de la cruz
				ctx.strokeStyle = rgbaStringWithMultiplier(PRIMARY, a * 0.24);
				ctx.lineWidth = Math.max(0.6, 1.1 * a);
				// horizontal
				ctx.beginPath();
				ctx.moveTo(-crossLen, 0);
				ctx.lineTo(crossLen, 0);
				ctx.stroke();
				// vertical
				ctx.beginPath();
				ctx.moveTo(0, -crossLen);
				ctx.lineTo(0, crossLen);
				ctx.stroke();
				// núcleo más brillante y corto
				ctx.strokeStyle = rgbaStringWithMultiplier(PRIMARY, Math.min(1, a * 0.6));
				ctx.lineWidth = Math.max(0.5, 0.9 * a);
				const core = crossLen * 0.7;
				ctx.beginPath();
				ctx.moveTo(-core, 0);
				ctx.lineTo(core, 0);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(0, -core);
				ctx.lineTo(0, core);
				ctx.stroke();
				ctx.restore();
			}
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


