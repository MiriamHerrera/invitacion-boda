(() => {
	async function loadConfig() {
		try {
			const res = await fetch('/api/config', { headers: { 'cache-control': 'no-cache' } });
			if (!res.ok) return;
			const cfg = await res.json();
			applyTheme(cfg?.theme);
			applyEffects(cfg?.effects);
		} catch {}
	}

	function applyTheme(theme) {
		if (!theme || !theme.colors) return;
		const c = theme.colors;
		const root = document.documentElement;
		if (c.bg) root.style.setProperty('--bg', c.bg);
		if (c.card) root.style.setProperty('--card', c.card);
		if (c.ink) root.style.setProperty('--ink', c.ink);
		if (c.muted) root.style.setProperty('--muted', c.muted);
		if (c.primary) root.style.setProperty('--primary', c.primary);
		if (c.primaryInk) root.style.setProperty('--primary-ink', c.primaryInk);

		// Tipografías
		const t = theme.typography || {};
		if (t.baseSize) root.style.setProperty('--font-base-size', String(t.baseSize));
		if (t.fontFamilyBody) root.style.setProperty('--font-body', String(t.fontFamilyBody));
		if (t.fontFamilyHeadings) root.style.setProperty('--font-headings', String(t.fontFamilyHeadings));
		ensureGoogleFontLoaded(t.fontFamilyBody);
		ensureGoogleFontLoaded(t.fontFamilyHeadings);

		// Cards
		const cards = theme.cards || {};
		const bg = cards.background || {};
		if (bg.color) root.style.setProperty('--card-bg-color', String(bg.color));
		if (bg.image) root.style.setProperty('--card-bg-image', `url('${String(bg.image)}')`);
		else root.style.setProperty('--card-bg-image', 'none');
		if (bg.size) root.style.setProperty('--card-bg-size', String(bg.size));
		if (bg.repeat) root.style.setProperty('--card-bg-repeat', String(bg.repeat));
		if (bg.position) root.style.setProperty('--card-bg-position', String(bg.position));
		if (cards.shadow) root.style.setProperty('--card-shadow', String(cards.shadow));
		if (cards.border) root.style.setProperty('--card-border', String(cards.border));
	}

	function applyEffects(effects) {
		if (!effects) return;
		const url = new URL(window.location.href);
		// effect por defecto si no está definido ni v
		if (!url.searchParams.get('effect') && !url.searchParams.get('v') && effects.defaultEffect) {
			url.searchParams.set('effect', String(effects.defaultEffect));
			window.history.replaceState({}, '', url.toString());
		}
		// hl por defecto si no viene en la URL
		if (!url.searchParams.get('hl') && typeof effects.hl === 'number') {
			url.searchParams.set('hl', String(effects.hl));
			window.history.replaceState({}, '', url.toString());
		}
		// animación por defecto si no se pide explícita en URL
		const animParam = url.searchParams.get('anim');
		if (animParam === null && (effects.animDefault === 0 || effects.animDefault === 1)) {
			localStorage.setItem('ANIM_BG', effects.animDefault ? '1' : '0');
		}
		// textura en cards
		if (effects.cardTextureEnabled === false) {
			document.body.classList.add('no-card-texture');
		}
		// tamaño de textura
		if (effects.textureSize) {
			document.documentElement.style.setProperty('--texture-size', String(effects.textureSize));
		}
	}

	// Carga Google Fonts si el nombre parece ser una familia de Google (heurística simple)
	function ensureGoogleFontLoaded(family) {
		if (!family) return;
		const primary = String(family).split(',')[0].trim().replace(/['"]/g, '');
		if (!primary || /serif|sans-serif|monospace/i.test(primary)) return;
		// Evita duplicados por id
		const id = `gf-${encodeURIComponent(primary)}`;
		if (document.getElementById(id)) return;
		const link = document.createElement('link');
		link.id = id;
		link.rel = 'stylesheet';
		link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(primary)}:wght@300;400;500;600&display=swap`;
		document.head.appendChild(link);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', loadConfig);
	} else {
		loadConfig();
	}
})();


