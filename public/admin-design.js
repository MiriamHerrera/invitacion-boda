(() => {
	// Utilidades compartidas con admin.js
	function getKey() {
		const qs = new URLSearchParams(window.location.search);
		const fromUrl = (qs.get('key') || '').trim();
		if (fromUrl) {
			localStorage.setItem('ADMIN_KEY', fromUrl);
			return fromUrl;
		}
		return localStorage.getItem('ADMIN_KEY') || '';
	}

	// Tabs
	const tabRsvp = document.getElementById('tabRsvp');
	const tabDesign = document.getElementById('tabDesign');
	const secRsvp = document.getElementById('secRsvp');
	const secDesign = document.getElementById('secDesign');
	function showTab(which) {
		if (!tabRsvp || !tabDesign || !secRsvp || !secDesign) return;
		if (which === 'design') {
			secRsvp.classList.remove('active');
			secDesign.classList.add('active');
			tabRsvp.classList.add('secondary');
			tabDesign.classList.remove('secondary');
		} else {
			secDesign.classList.remove('active');
			secRsvp.classList.add('active');
			tabDesign.classList.add('secondary');
			tabRsvp.classList.remove('secondary');
		}
	}
	tabRsvp && tabRsvp.addEventListener('click', () => showTab('rsvp'));
	tabDesign && tabDesign.addEventListener('click', () => showTab('design'));

	// Controles
	const els = {
		cBg: document.getElementById('cBg'),
		cBgText: document.getElementById('cBgText'),
		cCard: document.getElementById('cCard'),
		cCardText: document.getElementById('cCardText'),
		cInk: document.getElementById('cInk'),
		cInkText: document.getElementById('cInkText'),
		cMuted: document.getElementById('cMuted'),
		cMutedText: document.getElementById('cMutedText'),
		cPrimary: document.getElementById('cPrimary'),
		cPrimaryText: document.getElementById('cPrimaryText'),
		cPrimaryInk: document.getElementById('cPrimaryInk'),
		cPrimaryInkText: document.getElementById('cPrimaryInkText'),
		fontBody: document.getElementById('fontBody'),
		fontHead: document.getElementById('fontHead'),
		fontBase: document.getElementById('fontBase'),
		cardMode: document.getElementById('cardMode'),
		cardColor: document.getElementById('cardColor'),
		cardImage: document.getElementById('cardImage'),
		cardSize: document.getElementById('cardSize'),
		cardRepeat: document.getElementById('cardRepeat'),
		cardPosition: document.getElementById('cardPosition'),
		fxDefault: document.getElementById('fxDefault'),
		fxHl: document.getElementById('fxHl'),
		fxAnim: document.getElementById('fxAnim'),
		fxCardTex: document.getElementById('fxCardTex'),
		fxTexSize: document.getElementById('fxTexSize'),
		btnPreview: document.getElementById('previewDesign'),
		btnSave: document.getElementById('saveDesign'),
		msg: document.getElementById('designMsg'),
		err: document.getElementById('designErr')
	};

	function setMsg(ok, text) {
		if (!els.msg || !els.err) return;
		els.msg.hidden = !ok;
		els.err.hidden = ok;
		(ok ? els.msg : els.err).textContent = text || '';
	}

	// Sincroniza color input <-> texto
	function bindColorPair(colorEl, textEl) {
		if (!colorEl || !textEl) return;
		colorEl.addEventListener('input', () => { textEl.value = colorEl.value; });
		textEl.addEventListener('input', () => { colorEl.value = textEl.value; });
	}
	bindColorPair(els.cBg, els.cBgText);
	bindColorPair(els.cCard, els.cCardText);
	bindColorPair(els.cInk, els.cInkText);
	bindColorPair(els.cMuted, els.cMutedText);
	bindColorPair(els.cPrimary, els.cPrimaryText);
	bindColorPair(els.cPrimaryInk, els.cPrimaryInkText);

	async function loadCurrent() {
		try {
			const res = await fetch('/api/config', { headers: { 'cache-control': 'no-cache' } });
			const cfg = await res.json().catch(() => ({}));
			const colors = cfg?.theme?.colors || {};
			const typo = cfg?.theme?.typography || {};
			const cards = cfg?.theme?.cards || {};
			const bg = cards.background || {};
			const fx = cfg?.effects || {};
			if (els.cBg) { els.cBg.value = colors.bg || '#ffffff'; els.cBgText.value = colors.bg || '#ffffff'; }
			if (els.cCard) { els.cCard.value = colors.card || '#efeee9'; els.cCardText.value = colors.card || '#efeee9'; }
			if (els.cInk) { els.cInk.value = colors.ink || '#a48729'; els.cInkText.value = colors.ink || '#a48729'; }
			if (els.cMuted) { els.cMuted.value = colors.muted || '#6b6866'; els.cMutedText.value = colors.muted || '#6b6866'; }
			if (els.cPrimary) { els.cPrimary.value = colors.primary || '#a48729'; els.cPrimaryText.value = colors.primary || '#a48729'; }
			if (els.cPrimaryInk) { els.cPrimaryInk.value = colors.primaryInk || '#e6c873'; els.cPrimaryInkText.value = colors.primaryInk || '#e6c873'; }
			if (els.fontBody) els.fontBody.value = typo.fontFamilyBody || '';
			if (els.fontHead) els.fontHead.value = typo.fontFamilyHeadings || '';
			if (els.fontBase) els.fontBase.value = typo.baseSize || '17px';
			if (els.cardMode) els.cardMode.value = bg.mode || 'color';
			if (els.cardColor) els.cardColor.value = bg.color || '#a48729e0';
			if (els.cardImage) els.cardImage.value = bg.image || '';
			if (els.cardSize) els.cardSize.value = bg.size || 'cover';
			if (els.cardRepeat) els.cardRepeat.value = bg.repeat || 'no-repeat';
			if (els.cardPosition) els.cardPosition.value = bg.position || 'center';
			if (els.fxDefault) els.fxDefault.value = fx.defaultEffect || 'petalos';
			if (els.fxHl) els.fxHl.value = typeof fx.hl === 'number' ? String(fx.hl) : '1';
			if (els.fxAnim) els.fxAnim.checked = String(fx.animDefault || 1) === '1';
			if (els.fxCardTex) els.fxCardTex.checked = !!fx.cardTextureEnabled;
			if (els.fxTexSize) els.fxTexSize.value = fx.textureSize || '200px';
		} catch (e) {
			setMsg(false, 'No se pudo cargar configuración');
		}
	}

	function previewApply() {
		// Aplica tokens en vivo (sin persistir)
		const root = document.documentElement;
		const colors = {
			bg: els.cBgText?.value, card: els.cCardText?.value, ink: els.cInkText?.value,
			muted: els.cMutedText?.value, primary: els.cPrimaryText?.value, primaryInk: els.cPrimaryInkText?.value
		};
		for (const [k,v] of Object.entries(colors)) { if (v) root.style.setProperty(`--${k}`, v); }
		if (els.fontBase?.value) root.style.setProperty('--font-base-size', els.fontBase.value);
		if (els.fontBody?.value) root.style.setProperty('--font-body', els.fontBody.value);
		if (els.fontHead?.value) root.style.setProperty('--font-headings', els.fontHead.value);
		// Cards
		if (els.cardColor?.value) root.style.setProperty('--card-bg-color', els.cardColor.value);
		if (els.cardImage?.value) root.style.setProperty('--card-bg-image', els.cardImage.value ? `url('${els.cardImage.value}')` : 'none');
		if (els.cardSize?.value) root.style.setProperty('--card-bg-size', els.cardSize.value);
		if (els.cardRepeat?.value) root.style.setProperty('--card-bg-repeat', els.cardRepeat.value);
		if (els.cardPosition?.value) root.style.setProperty('--card-bg-position', els.cardPosition.value);
		// Efectos
		if (els.fxTexSize?.value) root.style.setProperty('--texture-size', els.fxTexSize.value);
		// Anim on/off por defecto se guarda en localStorage para vista actual
		localStorage.setItem('ANIM_BG', els.fxAnim?.checked ? '1' : '0');
		setMsg(true, 'Vista previa aplicada (no guardada)');
	}

	async function saveDesign() {
		const key = getKey();
		if (!key) { setMsg(false, 'Falta clave ADMIN_KEY'); return; }
		const payload = {
			theme: {
				colors: {
					bg: els.cBgText?.value,
					card: els.cCardText?.value,
					ink: els.cInkText?.value,
					muted: els.cMutedText?.value,
					primary: els.cPrimaryText?.value,
					primaryInk: els.cPrimaryInkText?.value
				},
				typography: {
					fontFamilyBody: els.fontBody?.value,
					fontFamilyHeadings: els.fontHead?.value,
					baseSize: els.fontBase?.value
				},
				cards: {
					background: {
						mode: els.cardMode?.value,
						color: els.cardColor?.value,
						image: els.cardImage?.value,
						size: els.cardSize?.value,
						repeat: els.cardRepeat?.value,
						position: els.cardPosition?.value
					}
				}
			},
			effects: {
				defaultEffect: els.fxDefault?.value,
				hl: Number(els.fxHl?.value || 1),
				animDefault: els.fxAnim?.checked ? 1 : 0,
				cardTextureEnabled: !!els.fxCardTex?.checked,
				textureSize: els.fxTexSize?.value
			}
		};
		try {
			const res = await fetch(`/api/admin/config?key=${encodeURIComponent(key)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
			setMsg(true, 'Configuración guardada');
		} catch (e) {
			setMsg(false, e.message);
		}
	}

	function init() {
		loadCurrent();
		els.btnPreview && els.btnPreview.addEventListener('click', previewApply);
		els.btnSave && els.btnSave.addEventListener('click', saveDesign);
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();


