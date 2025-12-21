(() => {
	// Mapea versiones legibles a parámetros
	const PRESETS = {
		'petalos-suave': { effect: 'petalos', hl: '0.7' },
		'petalos-intenso': { effect: 'petalos', hl: '1' },
		'confetti-dorado': { effect: 'confetti', hl: '1' },
		'confetti-sin-destello': { effect: 'confetti', hl: '0' },
		'anim-off': { anim: '0' },
		'anim-on': { anim: '1' },
		'fondo-azul': { bg: '#011229' },
		'fondo-noche': { bg: '#0b1522' }
	};
	const ORDER = [
		'petalos-suave',
		'petalos-intenso',
		'confetti-dorado',
		'confetti-sin-destello',
		'anim-on',
		'anim-off',
		'fondo-azul',
		'fondo-noche'
	];

	// Expande ?v=... a parámetros reales ANTES de que corran otros scripts
	try {
		const url = new URL(window.location.href);
		const v = (url.searchParams.get('v') || '').trim();
		if (v && PRESETS[v]) {
			// Limpia claves conocidas para evitar arrastrar valores de otras versiones
			const KNOWN = ['effect', 'hl', 'anim', 'bg', 'wind'];
			KNOWN.forEach((k) => url.searchParams.delete(k));
			// Mezcla parámetros del preset, conservando solo i
			Object.entries(PRESETS[v]).forEach(([k, val]) => {
				url.searchParams.set(k, String(val));
			});
			// Sincroniza animación con localStorage si el preset la define
			if ('anim' in PRESETS[v]) {
				const val = String(PRESETS[v].anim);
				if (val === '1') localStorage.setItem('ANIM_BG', '1');
				if (val === '0') localStorage.setItem('ANIM_BG', '0');
			} else {
				// Si el preset no define anim, restablece a comportamiento por defecto
				localStorage.removeItem('ANIM_BG');
			}
			url.searchParams.delete('v');
			// Actualiza la URL sin recargar para que los demás scripts vean los params
			window.history.replaceState({}, '', url.toString());
		}
		// Si hay ?anim explícito en la URL (sin usar v), respétalo y sincroniza storage
		const animParam = (new URLSearchParams(window.location.search).get('anim') || '').trim();
		if (animParam === '1') localStorage.setItem('ANIM_BG', '1');
		if (animParam === '0') localStorage.setItem('ANIM_BG', '0');
		// Aplica bg si viene por query para que particles.js lo tome con el valor correcto
		const bg = (new URLSearchParams(window.location.search).get('bg') || '').trim();
		if (bg) {
			document.documentElement.style.setProperty('--bg', bg);
		}
		// Permite ajustar el tamaño de la textura (?tex=600 o ?tex=600px)
		const tex = (new URLSearchParams(window.location.search).get('tex') || '').trim();
		if (tex) {
			const val = /^\d+$/.test(tex) ? `${tex}px` : tex;
			document.documentElement.style.setProperty('--texture-size', val);
		}
		// Marca textura si anim está OFF (para usar fondo de imagen en vez de canvas)
		const finalParams = new URLSearchParams(window.location.search);
		const useTexture = finalParams.get('anim') === '0';
		const noCardTex = (finalParams.get('cardtex') || '') === '0';
		const applyClasses = () => {
			if (useTexture) document.body.classList.add('texture-bg');
			else document.body.classList.remove('texture-bg');
			if (noCardTex) document.body.classList.add('no-card-texture');
			else document.body.classList.remove('no-card-texture');
		};
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', applyClasses);
		} else {
			applyClasses();
		}
	} catch {}

	// Construye un menú flotante con accesos a versiones
	function buildMenu() {
		const wrap = document.createElement('div');
		wrap.className = 'versions-wrap';
		wrap.innerHTML = `
<button class="versions-fab" type="button" aria-expanded="false" aria-controls="versions-panel" title="Versiones">Versiones</button>
<div id="versions-panel" class="versions-panel" hidden>
	<div class="versions-head">
		<strong>Versiones</strong>
		<button class="versions-close" type="button" aria-label="Cerrar">×</button>
	</div>
	<ul class="versions-list"></ul>
</div>`;
		document.body.appendChild(wrap);

		const fab = wrap.querySelector('.versions-fab');
		const panel = wrap.querySelector('#versions-panel');
		const list = wrap.querySelector('.versions-list');
		const closeBtn = wrap.querySelector('.versions-close');

		// Construye los enlaces conservando SOLO el código de invitación (?i=)
		const currentI = new URL(window.location.href).searchParams.get('i') || '';
		ORDER.forEach((key) => {
			// URL base sin query para evitar arrastrar parámetros viejos
			const linkUrl = new URL(window.location.origin + window.location.pathname);
			// Usaremos v=<key>; este script expandirá los parámetros
			linkUrl.searchParams.set('v', key);
			if (currentI) linkUrl.searchParams.set('i', currentI);
			const li = document.createElement('li');
			const a = document.createElement('a');
			a.href = linkUrl.toString();
			a.textContent = labelFor(key);
			a.addEventListener('click', (e) => {
				e.preventDefault();
				// Navega en la misma pestaña
				window.location.href = a.href;
			});
			li.appendChild(a);
			list.appendChild(li);
		});

		function openPanel() {
			panel.hidden = false;
			fab.setAttribute('aria-expanded', 'true');
		}
		function closePanel() {
			panel.hidden = true;
			fab.setAttribute('aria-expanded', 'false');
		}
		fab.addEventListener('click', () => {
			if (panel.hidden) openPanel(); else closePanel();
		});
		closeBtn.addEventListener('click', closePanel);
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closePanel();
		});
	}

	function labelFor(key) {
		switch (key) {
			case 'petalos-suave': return 'Pétalos (suave)';
			case 'petalos-intenso': return 'Pétalos (intenso)';
			case 'confetti-dorado': return 'Confetti dorado';
			case 'confetti-sin-destello': return 'Confetti sin destello';
			case 'anim-on': return 'Animación ON';
			case 'anim-off': return 'Animación OFF';
			case 'fondo-azul': return 'Fondo azul';
			case 'fondo-noche': return 'Fondo noche';
			default: return key;
		}
	}

	// Espera a que el DOM esté disponible para inyectar el menú
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', buildMenu);
	} else {
		buildMenu();
	}
})();


