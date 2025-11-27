(() => {
	const overlay = document.getElementById('intro-envelope');
	if (!overlay) return;

	// Respeta reduce motion: oculta intro si el usuario lo prefiere
	const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduce) {
		overlay.hidden = true;
		return;
	}

	let opened = false;
	function openEnvelope() {
		if (opened) return;
		opened = true;
		overlay.classList.add('open');
		// Tras un pequeño tiempo, desvanecemos el overlay
		setTimeout(() => {
			overlay.classList.add('is-hidden');
			// Y finalmente lo retiramos del flujo
			setTimeout(() => {
				overlay.hidden = true;
			}, 650);
		}, 800);
	}

	// Abrir al clicar/tocar en cualquier sitio del overlay
	overlay.addEventListener('click', openEnvelope);
	overlay.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') openEnvelope();
	});

	// Foco accesible para lectores de pantalla
	overlay.tabIndex = 0;
})(); 


