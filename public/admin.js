(() => {
	const keyInput = document.getElementById('adminKey');
	const saveBtn = document.getElementById('saveKey');
	const refreshBtn = document.getElementById('refresh');
	const rsvpCountEl = document.getElementById('rsvpCount');
	const totalAttendeesEl = document.getElementById('totalAttendees');
	const lastUpdatedEl = document.getElementById('lastUpdated');
	const errEl = document.getElementById('err');

	let timer = null;

	function setError(msg) {
		errEl.hidden = !msg;
		errEl.textContent = msg || '';
	}

	function getKey() {
		const qs = new URLSearchParams(window.location.search);
		const fromUrl = (qs.get('key') || '').trim();
		if (fromUrl) {
			localStorage.setItem('ADMIN_KEY', fromUrl);
			return fromUrl;
		}
		return localStorage.getItem('ADMIN_KEY') || '';
	}

	async function fetchSummary() {
		const key = getKey();
		if (!key) {
			setError('Introduce tu clave de administrador.');
			return;
		}
		try {
			setError('');
			const res = await fetch(`/api/admin/summary?key=${encodeURIComponent(key)}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'Error al obtener el resumen');
			rsvpCountEl.textContent = data.rsvpCount ?? '0';
			totalAttendeesEl.textContent = data.totalAttendees ?? '0';
			lastUpdatedEl.textContent = `Actualizado: ${new Date().toLocaleString()}`;
		} catch (e) {
			setError(e.message);
		}
	}

	function startAutoRefresh() {
		if (timer) clearInterval(timer);
		timer = setInterval(fetchSummary, 15000); // cada 15s
	}

	// Init
	(function init() {
		const currentKey = getKey();
		keyInput.value = currentKey;
		fetchSummary();
		startAutoRefresh();
	})();

	saveBtn.addEventListener('click', () => {
		const val = (keyInput.value || '').trim();
		localStorage.setItem('ADMIN_KEY', val);
		fetchSummary();
	});
	refreshBtn.addEventListener('click', () => {
		fetchSummary();
	});
})();


