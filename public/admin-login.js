(() => {
	const form = document.getElementById('loginForm');
	const errEl = document.getElementById('loginErr');
	function setErr(msg) {
		if (!errEl) return;
		errEl.hidden = !msg;
		errEl.textContent = msg || '';
	}
	async function doLogin(e) {
		e.preventDefault();
		setErr('');
		const pwd = document.getElementById('password')?.value || '';
		if (!pwd) {
			setErr('Introduce tu contraseña');
			return;
		}
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: pwd })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
			// Redirigir a admin
			window.location.href = '/admin.html';
		} catch (e) {
			setErr(e.message);
		}
	}
	form && form.addEventListener('submit', doLogin);
})();


