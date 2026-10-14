document.addEventListener('DOMContentLoaded', function () {
    const mapImage = document.getElementById('mapImage');
    const mapViewport = document.getElementById('mapViewport');
    const mapContainer = document.getElementById('mapContainer');
    const pinsLayer = document.getElementById('pinsLayer');
    const pinModal = document.getElementById('pinModal');
    const viewModal = document.getElementById('viewModal');

    const pins = window.MAP_PINS || [];
    const isAdmin = window.IS_ADMIN;
    const hasMap = window.HAS_MAP;

    let pendingX = 0;
    let pendingY = 0;
    let currentViewPinId = null;

    // ================================
    // ZOOM / PAN
    // ================================
    let scale = 1;
    let minScale = 0.5;
    let maxScale = 4;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;

    function aplicarTransform() {
        if (!mapContainer) return;
        mapContainer.style.transform =
            `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        mapContainer.style.transformOrigin = '0 0';
    }

    function setScale(newScale, centerX, centerY) {
        const oldScale = scale;
        scale = Math.max(minScale, Math.min(maxScale, newScale));

        if (centerX !== undefined && centerY !== undefined) {
            const rect = mapViewport.getBoundingClientRect();
            const x = centerX - rect.left;
            const y = centerY - rect.top;
            translateX = x - (x - translateX) * (scale / oldScale);
            translateY = y - (y - translateY) * (scale / oldScale);
        }
        aplicarTransform();
    }

    // Zoom com botões
    document.getElementById('btnZoomIn').addEventListener('click', () => {
        const rect = mapViewport.getBoundingClientRect();
        setScale(scale * 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    document.getElementById('btnZoomOut').addEventListener('click', () => {
        const rect = mapViewport.getBoundingClientRect();
        setScale(scale / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        aplicarTransform();
    });

    // Zoom com scroll
    if (mapViewport) {
        mapViewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.deltaY) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
                setScale(scale * delta, e.clientX, e.clientY);
            }
        }, { passive: false });

        // Pan com arrastar
        mapViewport.addEventListener('mousedown', (e) => {
            if (e.target.closest('.map-pin')) return;
            if (e.button !== 0) return;
            isDragging = true;
            dragMoved = false;
            dragStartX = e.clientX - translateX;
            dragStartY = e.clientY - translateY;
            mapViewport.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            translateX = e.clientX - dragStartX;
            translateY = e.clientY - dragStartY;
            dragMoved = true;
            aplicarTransform();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            mapViewport.style.cursor = 'grab';
        });
    }

    // ================================
    // PINOS
    // ================================
    const tipoLabels = { qr: 'QR Code', pessoa: 'Integrante', evento: 'Evento', info: 'Informação' };
    const tipoIcons = { qr: '📱', pessoa: '👤', evento: '📅', info: '📍' };

    function renderPins() {
        pinsLayer.innerHTML = '';
        pins.forEach(pin => {
            const el = document.createElement('div');
            el.className = 'map-pin pin-' + (pin.tipo || 'info');
            el.style.left = pin.x_percent + '%';
            el.style.top = pin.y_percent + '%';
            el.title = pin.titulo;
            el.textContent = tipoIcons[pin.tipo] || '📍';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                abrirViewModal(pin);
            });
            el.addEventListener('mousedown', (e) => e.stopPropagation());
            pinsLayer.appendChild(el);
        });
    }

    function abrirViewModal(pin) {
        currentViewPinId = pin.id;
        document.getElementById('viewTitulo').textContent = pin.titulo;
        document.getElementById('viewDescricao').textContent = pin.descricao || 'Sem descrição.';
        document.getElementById('viewTipo').textContent = tipoLabels[pin.tipo] || 'Informação';
        viewModal.classList.add('active');
    }

    window.fecharViewModal = function () {
        viewModal.classList.remove('active');
        currentViewPinId = null;
    };

    window.fecharModal = function () {
        pinModal.classList.remove('active');
    };

    // Admin: clicar no mapa (sem arrastar) abre modal para adicionar pin
    if (isAdmin && mapImage) {
        mapImage.style.cursor = 'crosshair';
        mapImage.addEventListener('click', function (e) {
            if (dragMoved) return; // estava arrastando, não cria pin
            const rect = mapImage.getBoundingClientRect();
            const naturalX = (e.clientX - rect.left) / rect.width * 100;
            const naturalY = (e.clientY - rect.top) / rect.height * 100;
            pendingX = naturalX;
            pendingY = naturalY;
            pinModal.classList.add('active');
        });
    }

    const pinForm = document.getElementById('pinForm');
    if (pinForm) {
        pinForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const titulo = document.getElementById('pinTitulo').value.trim();
            const tipo = document.getElementById('pinTipo').value;
            const descricao = document.getElementById('pinDescricao').value.trim();

            if (!titulo) return;

            try {
                const resp = await fetch('/mapa/pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: pendingX, y: pendingY, titulo, tipo, descricao })
                });
                const data = await resp.json();
                if (data.success) {
                    pins.push({ id: data.id, x_percent: pendingX, y_percent: pendingY, titulo, tipo, descricao });
                    renderPins();
                    window.fecharModal();
                    pinForm.reset();
                } else {
                    alert('Erro: ' + (data.error || 'Não foi possível adicionar.'));
                }
            } catch (err) {
                alert('Erro de conexão.');
            }
        });
    }

    const btnDelete = document.getElementById('btnDeletePin');
    if (btnDelete) {
        btnDelete.addEventListener('click', async function () {
            if (!currentViewPinId || !confirm('Remover esta marcação?')) return;
            try {
                const resp = await fetch('/mapa/pin/delete/' + currentViewPinId, { method: 'POST' });
                const data = await resp.json();
                if (data.success) {
                    const idx = pins.findIndex(p => p.id === currentViewPinId);
                    if (idx > -1) pins.splice(idx, 1);
                    renderPins();
                    window.fecharViewModal();
                }
            } catch (err) {
                alert('Erro ao remover.');
            }
        });
    }

    [pinModal, viewModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    renderPins();
});