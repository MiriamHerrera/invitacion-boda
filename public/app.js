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

	let currentGuest = null;
	let currentCode = '';

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
		} else {
			attendeesField.style.display = '';
			attendeesHelp.textContent = `Máximo permitido: ${max}`;
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
		displayNameInput.value = guest.displayName;
		guestNameTextEl.textContent = `Hola ${guest.displayName}, esta invitación es para ti.`;
		greetEl.textContent = `¡${guest.displayName}, nos hará ilusión verte!`;
		updateMaxGuests(guest.maxGuests);
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
		// Mostrar mesa asignada si existe
		if (guest.table !== undefined && guest.table !== null && String(guest.table).trim() !== '') {
			tableInfoWrap.style.display = '';
			tableInfo.textContent = String(guest.table);
		} else {
			tableInfoWrap.style.display = 'none';
			tableInfo.textContent = '';
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
		if (codeFromUrl) {
			inviteCodeInput.value = codeFromUrl;
			handleLoadGuest(codeFromUrl);
		} else {
			guestNameTextEl.textContent = 'Introduce tu código para personalizar tu invitación.';
		}
	})();
})();


