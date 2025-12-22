(() => {
	const qs = new URLSearchParams(window.location.search);
	const codeFromUrl = (qs.get('i') || '').trim();

	// Elements
	const greetEl = document.getElementById('greet');
	const guestNameTextEl = document.getElementById('guestNameText');
	const codeBox = document.getElementById('codeBox');
	const inviteCodeInput = document.getElementById('inviteCode');
	const loadGuestBtn = document.getElementById('loadGuest');
	const form = document.getElementById('rsvpForm');
	const displayNameInput = document.getElementById('displayName');
	const displayField = displayNameInput ? displayNameInput.closest('.field') : null;
	const attendeesSelect = document.getElementById('attendees');
	const attendeesField = document.getElementById('attendeesField');
	const attendeesHelp = document.getElementById('attendeesHelp');
	const inviteesWrap = document.getElementById('inviteesWrap');
	const inviteesList = document.getElementById('inviteesList');
	const tableInfoWrap = document.getElementById('tableInfoWrap');
	const tableInfo = document.getElementById('tableInfo');
	const contactInput = document.getElementById('contact');
	const messageInput = document.getElementById('message');
	const submitBtn = document.getElementById('submitBtn');
	const formError = document.getElementById('formError');
	const formOk = document.getElementById('formOk');
	const formNote = document.getElementById('formNote');
	const uberLink = document.getElementById('uberLink');
	const didiLink = document.getElementById('didiLink');
	const countdownEl = document.getElementById('countdown');

	let currentGuest = null;
	let currentCode = '';

	// Simple gate: require passphrase before viewing invitation
	const PASS_KEY = 'INVITACION_PASS_OK';
	const REQUIRED_PASS = 'RubenYMiriam';
	function createPassOverlay() {
		const wrap = document.createElement('div');
		wrap.className = 'pass-overlay';
		wrap.innerHTML = `
			<div class="pass-card">
				<h3>Acceso</h3>
				<p class="muted small">Introduce la frase para ver la invitación</p>
				<div class="field">
					<input type="password" id="passphraseInput" placeholder="Frase de acceso" autocomplete="off" />
				</div>
				<div class="actions">
					<button class="btn primary" id="passOkBtn">Entrar</button>
				</div>
				<p class="error" id="passErr" hidden>Frase incorrecta</p>
			</div>
		`;
		document.body.appendChild(wrap);
		const inp = wrap.querySelector('#passphraseInput');
		const btn = wrap.querySelector('#passOkBtn');
		const err = wrap.querySelector('#passErr');
		function submit() {
			const v = (inp.value || '').trim();
			if (v === REQUIRED_PASS) {
				sessionStorage.setItem(PASS_KEY, '1');
				wrap.remove();
			} else {
				err.hidden = false;
			}
		}
		btn.addEventListener('click', submit);
		inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
		setTimeout(() => inp.focus(), 0);
	}

	function setLoading(isLoading) {
		submitBtn.disabled = isLoading;
		[inviteCodeInput, loadGuestBtn].forEach((el) => el && (el.disabled = isLoading));
	}

	function showError(msg) {
		formOk.hidden = true;
		formError.hidden = false;
		formError.textContent = msg;
	}
	function showOk(msg) {
		formError.hidden = true;
		formOk.hidden = false;
		formOk.textContent = msg || '¡Gracias! Tu respuesta ha sido registrada.';
	}
	function clearAlerts() {
		formError.hidden = true;
		formOk.hidden = true;
	}

	function updateMaxGuests(max) {
		if (max === 1) {
			attendeesField.style.display = 'none';
			attendeesHelp.textContent = 'Invitación personal';
			attendeesSelect.value = '1';
			if (displayField) displayField.classList.add('span-all');
		} else {
			attendeesField.style.display = '';
			attendeesHelp.textContent = `Máximo permitido: ${max}`;
			if (displayField) displayField.classList.remove('span-all');
			// Deshabilitar opciones por encima del máximo
			Array.from(attendeesSelect.options).forEach((opt) => {
				const v = Number(opt.value);
				if (Number.isFinite(v)) {
					opt.disabled = v > max;
				}
			});
			// si valor actual supera máximo, corrígelo
			const current = Number(attendeesSelect.value);
			if (!Number.isFinite(current) || current > max) {
				attendeesSelect.value = String(Math.min(max, 1));
			}
		}
	}

	async function fetchGuestByCode(code) {
		const res = await fetch(`/api/guest?code=${encodeURIComponent(code)}`);
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || 'No se pudo cargar el invitado');
		}
		return res.json();
	}

	function personalize(guest, code) {
		currentGuest = guest;
		currentCode = code;
		try { sessionStorage.setItem(PASS_KEY, '1'); } catch {}
		displayNameInput.value = guest.displayName;
		guestNameTextEl.textContent = `Hola ${guest.displayName}, esta invitación es para ti.`;
		greetEl.textContent = `¡${guest.displayName}, nos hará ilusión verte!`;
		updateMaxGuests(guest.maxGuests);
		// Mostrar detalles del evento cuando se valida el código
		const detailsSec = document.querySelector('.details');
		if (detailsSec) detailsSec.hidden = false;
		// Mostrar personas dirigidas si existen
		if (Array.isArray(guest.invitees) && guest.invitees.length > 0) {
			inviteesWrap.style.display = '';
			inviteesList.innerHTML = '';
			guest.invitees.forEach((name) => {
				const li = document.createElement('li');
				li.textContent = String(name);
				inviteesList.appendChild(li);
			});
			attendeesHelp.textContent = `Esta invitación es para ${guest.invitees.length} persona(s). Máximo permitido: ${guest.maxGuests}`;
		} else {
			inviteesWrap.style.display = 'none';
			inviteesList.innerHTML = '';
		}
		// Mostrar mesa asignada si existe (acepta números o strings numéricos).
		// Cadenas como "No asignada", "pendiente", etc., se consideran no asignadas.
		let hasAssignedTable = false;
		if (guest.table !== undefined && guest.table !== null) {
			if (typeof guest.table === 'number' && Number.isFinite(guest.table)) {
				hasAssignedTable = true;
			} else if (typeof guest.table === 'string') {
				const sv = guest.table.trim().toLowerCase();
				if (sv && /^\d+$/.test(sv)) hasAssignedTable = true;
			}
		}
		if (hasAssignedTable) {
			tableInfoWrap.style.display = '';
			tableInfo.textContent = String(guest.table);
		} else {
			// Mostrar leyenda cuando aún no hay mesa asignada
			tableInfoWrap.style.display = '';
			tableInfo.textContent = 'La asignación de tu mesa se mostrará acercándose la fecha del evento.';
		}
		// Hide manual code box after successful load
		codeBox.style.display = 'none';
		// Update URL to include code
		const url = new URL(window.location.href);
		url.searchParams.set('i', code);
		window.history.replaceState({}, '', url.toString());
	}

	async function handleLoadGuest(code) {
		try {
			setLoading(true);
			clearAlerts();
			const guest = await fetchGuestByCode(code);
			personalize(guest, code);
		} catch (err) {
			showError(err.message);
		} finally {
			setLoading(false);
		}
	}

	loadGuestBtn.addEventListener('click', () => {
		const code = (inviteCodeInput.value || '').trim();
		if (!code) {
			showError('Introduce tu código de invitación');
			return;
		}
		handleLoadGuest(code);
	});

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		clearAlerts();
		if (!currentCode) {
			showError('Primero introduce tu código y cárgalo.');
			return;
		}
		// Validar que el usuario haya elegido asistentes (no placeholder vacío)
		const attendeesRaw = attendeesSelect.value;
		if (attendeesRaw === '' || attendeesRaw === null || attendeesRaw === undefined) {
			showError('Selecciona el número de asistentes.');
			attendeesSelect.focus();
			return;
		}
		const body = {
			code: currentCode,
			attendees: Number(attendeesSelect.value),
			message: messageInput.value.trim(),
			contact: contactInput.value.trim()
		};
		try {
			setLoading(true);
			const res = await fetch('/api/rsvp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo guardar tu respuesta');
			showOk('¡Gracias! Tu respuesta ha sido registrada.');
			formNote.textContent = 'Puedes modificar tu respuesta más adelante con este mismo enlace.';
		} catch (err) {
			showError(err.message);
		} finally {
			setLoading(false);
		}
	});

	// Init
	(function init() {
		// Gate: ocultar detalles hasta tener código válido
		const detailsSec = document.querySelector('.details');
		if (detailsSec) detailsSec.hidden = true;
		const passOk = sessionStorage.getItem(PASS_KEY) === '1';
		// Prefill ride links using venue/address from page
		const venue = (document.querySelector('.details .venue')?.textContent || 'ARCANGELES EVENTOS').trim();
		const addr = (document.querySelector('.details .address')?.textContent || '').trim();
		const detailsSection = document.querySelector('.details');
		const latFromAttr = detailsSection?.getAttribute('data-lat');
		const lngFromAttr = detailsSection?.getAttribute('data-lng');
		const dropoffLat = latFromAttr !== null && latFromAttr !== undefined && String(latFromAttr).trim() !== '' ? Number(latFromAttr) : NaN;
		const dropoffLng = lngFromAttr !== null && lngFromAttr !== undefined && String(lngFromAttr).trim() !== '' ? Number(lngFromAttr) : NaN;
		if (uberLink) {
			if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
				uberLink.href = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dropoffLat}&dropoff[longitude]=${dropoffLng}&dropoff[nickname]=${encodeURIComponent(venue)}&dropoff[formatted_address]=${encodeURIComponent(addr || venue)}`;
			} else {
				uberLink.href = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(addr || venue)}&dropoff[nickname]=${encodeURIComponent(venue)}`;
			}
		}
		if (didiLink) {
			// Fallback web route for DiDi
			if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
				didiLink.href = `https://page.didiglobal.com/mobility-os/route?to=${encodeURIComponent(venue)}&to_addr=${encodeURIComponent(addr)}&to_lat=${dropoffLat}&to_lng=${dropoffLng}`;
			} else {
				didiLink.href = `https://page.didiglobal.com/mobility-os/route?to=${encodeURIComponent(venue)}&to_addr=${encodeURIComponent(addr)}`;
			}
		}
		// Countdown (oculto hasta 16 días antes del evento)
		if (countdownEl) {
			const countdownCard = document.querySelector('.countdown.card');
			const eventDate = new Date(document.querySelector('.details .datetime time')?.getAttribute('datetime') || '2026-03-15T20:00:00');
			const nowForCheck = new Date();
			const daysUntil = Math.ceil((eventDate - nowForCheck) / (1000 * 60 * 60 * 24));
			if (daysUntil > 16) {
				if (countdownCard) countdownCard.style.display = 'none';
			} else {
				if (countdownCard) countdownCard.style.display = '';
				function updateCountdown() {
					const now = new Date();
					let diff = Math.max(0, eventDate - now);
					const sec = Math.floor(diff / 1000) % 60;
					const min = Math.floor(diff / (1000 * 60)) % 60;
					const hr = Math.floor(diff / (1000 * 60 * 60)) % 24;
					const day = Math.floor(diff / (1000 * 60 * 60 * 24));
					countdownEl.textContent = `${day} días · ${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
				}
				updateCountdown();
				setInterval(updateCountdown, 1000);
			}
		}
		if (codeFromUrl) {
			inviteCodeInput.value = codeFromUrl;
			handleLoadGuest(codeFromUrl)
				.then(() => {
					// Código válido: no mostrar overlay
				})
				.catch(() => {
					// Código inválido → pedir frase si no la han pasado
					if (!passOk) createPassOverlay();
				});
		} else {
			// Sin código en URL → si no tiene pase, pedir frase
			if (!passOk) createPassOverlay();
			guestNameTextEl.textContent = 'Introduce tu código para personalizar tu invitación.';
		}
	})();
})();


