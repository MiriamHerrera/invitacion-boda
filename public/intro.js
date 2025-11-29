(() => {
	const overlay = document.getElementById('intro-envelope');
	if (!overlay) return;

	// Respeta reduce motion: oculta intro si el usuario lo prefiere
	const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduce) {
		overlay.hidden = true;
		return;
	}

	const body = document.body;
	const wrapper = document.getElementById('envWrapper');
	const contentEls = [document.querySelector('header'), document.querySelector('main'), document.querySelector('footer')];
	// Mientras el sobre está activo, ocultamos el contenido y bloqueamos scroll
	body.classList.add('intro-open');
	const prevOverflow = body.style.overflow;
	body.style.overflow = 'hidden';
	contentEls.forEach(el => el && el.setAttribute('aria-hidden', 'true'));

	let opened = false;
	function openEnvelope() {
		if (opened) return;
		opened = true;
		overlay.classList.add('open');
		if (wrapper) wrapper.classList.add('opened');
		// Tras un pequeño tiempo, desvanecemos el overlay
		setTimeout(() => {
			overlay.classList.add('is-hidden');
			// Y finalmente lo retiramos del flujo
			setTimeout(() => {
				overlay.hidden = true;
				// Restaurar contenido y scroll
				body.classList.remove('intro-open');
				body.style.overflow = prevOverflow || '';
				contentEls.forEach(el => el && el.removeAttribute('aria-hidden'));
			}, 650);
		}, 1600);
	}

	// Abrir al clicar/tocar en cualquier sitio del overlay
	overlay.addEventListener('click', openEnvelope);
	overlay.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') openEnvelope();
	});

	// Foco accesible para lectores de pantalla
	overlay.tabIndex = 0;
})(); 


