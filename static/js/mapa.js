document.addEventListener('DOMContentLoaded', function () {
    const mapImage = document.getElementById('mapImage');
    const mapViewport = document.getElementById('mapViewport');
    const mapContainer = document.getElementById('mapContainer');
    const pinsLayer = document.getElementById('pinsLayer');
    const pinModal = document.getElementById('pinModal');
    const viewModal = document.getElementById('viewModal');

    let pins = window.MAP_PINS || [];
    const isAdmin = window.IS_ADMIN;

    let pendingX = 0;
    let pendingY = 0;
    let currentViewPinId = null;
    let editingPinId = null;

    // ================================
    // ZOOM / PAN
    // ================================
    let scale = 1;
    const minScale = 0.5;
    const maxScale = 4;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;
    let isDraggingPin = false;

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

    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnReset = document.getElementById('btnReset');

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
        const rect = mapViewport.getBoundingClientRect();
        setScale(scale * 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
        const rect = mapViewport.getBoundingClientRect();
        setScale(scale / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    if (btnReset) btnReset.addEventListener('click', () => {
        scale = 1; translateX = 0; translateY = 0;
        aplicarTransform();
    });

    if (mapViewport) {
        mapViewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            setScale(scale * delta, e.clientX, e.clientY);
        }, { passive: false });

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
    // TIPOS DE PINO
    // ================================
    const tipoLabels = {
        qr: 'QR Code',
        pesquisador: 'Pesquisador',
        evento: 'Evento',
        info: 'Informação'
    };

    const tipoIcons = {
        qr: '📱',
        pesquisador: '🧑‍🔬',
        evento: '📅',
        info: '📍'
    };

    const statusLabels = {
        online: '🟢 Online',
        ocupado: '🟡 Ocupado',
        offline: '⚫ Offline'
    };

    // ================================
    // RENDER DOS PINOS
    // ================================
    function renderPins() {
        pinsLayer.innerHTML = '';
        pins.forEach(pin => {
            const el = document.createElement('div');
            el.className = 'map-pin pin-' + (pin.tipo || 'info');
            el.style.left = pin.x_percent + '%';
            el.style.top = pin.y_percent + '%';
            el.title = pin.titulo;
            el.dataset.pinId = pin.id;

            // Emoji do tipo
            el.textContent = tipoIcons[pin.tipo] || '📍';

            // Para pesquisadores, adiciona bolinha de status
            if (pin.tipo === 'pesquisador') {
                const statusDot = document.createElement('span');
                statusDot.className = 'pin-status-dot status-' + (pin.status || 'offline');
                el.appendChild(statusDot);
            }

            if (isAdmin) {
                el.classList.add('draggable');
                habilitarArrastar(el, pin);
            } else {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    abrirViewModal(pin);
                });
            }

            pinsLayer.appendChild(el);
        });
    }

    // ================================
    // ARRASTAR PINO (SOMENTE ADMIN)
    // ================================
    function habilitarArrastar(el, pin) {
        let arrastando = false;
        let moveu = false;

        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            arrastando = true;
            moveu = false;
            isDraggingPin = true;
            el.classList.add('arrastando');

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        function onMove(e) {
            if (!arrastando) return;
            moveu = true;

            const rect = mapImage.getBoundingClientRect();
            let novoX = ((e.clientX - rect.left) / rect.width) * 100;
            let novoY = ((e.clientY - rect.top) / rect.height) * 100;

            novoX = Math.max(0, Math.min(100, novoX));
            novoY = Math.max(0, Math.min(100, novoY));

            el.style.left = novoX + '%';
            el.style.top = novoY + '%';

            pin._tempX = novoX;
            pin._tempY = novoY;
        }

        async function onUp() {
            arrastando = false;
            isDraggingPin = false;
            el.classList.remove('arrastando');

            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            if (!moveu) {
                abrirViewModal(pin);
                return;
            }

            const novoX = pin._tempX;
            const novoY = pin._tempY;

            try {
                const resp = await fetch(`/mapa/pin/move/${pin.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: novoX, y: novoY })
                });
                const data = await resp.json();
                if (data.success) {
                    pin.x_percent = novoX;
                    pin.y_percent = novoY;
                    el.classList.add('pin-salvo');
                    setTimeout(() => el.classList.remove('pin-salvo'), 800);
                } else {
                    alert('Erro ao salvar posição.');
                    el.style.left = pin.x_percent + '%';
                    el.style.top = pin.y_percent + '%';
                }
            } catch (err) {
                alert('Erro de conexão.');
                el.style.left = pin.x_percent + '%';
                el.style.top = pin.y_percent + '%';
            }
        }

        // TOQUE (celular/tablet)
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            arrastando = true;
            moveu = false;
            isDraggingPin = true;
            el.classList.add('arrastando');

            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
        });

        function onTouchMove(e) {
            if (!arrastando) return;
            e.preventDefault();
            moveu = true;

            const touch = e.touches[0];
            const rect = mapImage.getBoundingClientRect();
            let novoX = ((touch.clientX - rect.left) / rect.width) * 100;
            let novoY = ((touch.clientY - rect.top) / rect.height) * 100;

            novoX = Math.max(0, Math.min(100, novoX));
            novoY = Math.max(0, Math.min(100, novoY));

            el.style.left = novoX + '%';
            el.style.top = novoY + '%';

            pin._tempX = novoX;
            pin._tempY = novoY;
        }

        async function onTouchEnd() {
            arrastando = false;
            isDraggingPin = false;
            el.classList.remove('arrastando');

            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);

            if (!moveu) {
                abrirViewModal(pin);
                return;
            }

            const novoX = pin._tempX;
            const novoY = pin._tempY;

            try {
                const resp = await fetch(`/mapa/pin/move/${pin.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: novoX, y: novoY })
                });
                const data = await resp.json();
                if (data.success) {
                    pin.x_percent = novoX;
                    pin.y_percent = novoY;
                    el.classList.add('pin-salvo');
                    setTimeout(() => el.classList.remove('pin-salvo'), 800);
                }
            } catch (err) {
                alert('Erro de conexão.');
            }
        }
    }

    // ================================
    // MODAIS
    // ================================
    function abrirViewModal(pin) {
        currentViewPinId = pin.id;
        document.getElementById('viewTitulo').textContent = pin.titulo;
        document.getElementById('viewDescricao').textContent = pin.descricao || 'Sem descrição.';
        document.getElementById('viewTipo').textContent = tipoLabels[pin.tipo] || 'Informação';

        const viewStatus = document.getElementById('viewStatus');
        if (pin.tipo === 'pesquisador' && pin.status) {
            viewStatus.textContent = 'Status: ' + (statusLabels[pin.status] || pin.status);
            viewStatus.style.display = 'block';
        } else {
            viewStatus.style.display = 'none';
        }

        const viewContato = document.getElementById('viewContato');
        if (pin.tipo === 'pesquisador' && pin.contato) {
            viewContato.textContent = '📞 Contato: ' + pin.contato;
            viewContato.style.display = 'block';
        } else {
            viewContato.style.display = 'none';
        }

        viewModal.classList.add('active');
    }

    window.fecharViewModal = function () {
        viewModal.classList.remove('active');
        currentViewPinId = null;
    };

    window.fecharModal = function () {
        pinModal.classList.remove('active');
        editingPinId = null;
    };

    // ================================
    // CLICAR NO MAPA PARA CRIAR PINO (ADMIN)
    // ================================
    if (isAdmin && mapImage) {
        mapImage.style.cursor = 'crosshair';
        mapImage.addEventListener('click', function (e) {
            if (dragMoved) return;
            if (isDraggingPin) return;
            const rect = mapImage.getBoundingClientRect();
            pendingX = (e.clientX - rect.left) / rect.width * 100;
            pendingY = (e.clientY - rect.top) / rect.height * 100;

            // Reset do modal
            document.getElementById('pinModalTitle').textContent = 'Nova Marcação';
            document.getElementById('pinForm').reset();
            document.getElementById('pinEditId').value = '';
            editingPinId = null;
            atualizarCamposEspeciais();

            pinModal.classList.add('active');
        });
    }

    // ================================
    // MOSTRAR/ESCONDER CAMPOS ESPECIAIS
    // ================================
    const pinTipo = document.getElementById('pinTipo');
    const statusGroup = document.getElementById('statusGroup');
    const contatoGroup = document.getElementById('contatoGroup');

    function atualizarCamposEspeciais() {
        if (!pinTipo) return;
        const isPesquisador = pinTipo.value === 'pesquisador';
        if (statusGroup) statusGroup.style.display = isPesquisador ? 'flex' : 'none';
        if (contatoGroup) contatoGroup.style.display = isPesquisador ? 'flex' : 'none';
    }

    if (pinTipo) {
        pinTipo.addEventListener('change', atualizarCamposEspeciais);
    }

    // ================================
    // SUBMIT DO FORM (CRIAR OU EDITAR)
    // ================================
    const pinForm = document.getElementById('pinForm');
    if (pinForm) {
        pinForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const titulo = document.getElementById('pinTitulo').value.trim();
            const tipo = document.getElementById('pinTipo').value;
            const descricao = document.getElementById('pinDescricao').value.trim();
            const status = tipo === 'pesquisador' ? document.getElementById('pinStatus').value : null;
            const contato = tipo === 'pesquisador' ? document.getElementById('pinContato').value.trim() : null;

            if (!titulo) return;

            try {
                let url, body;
                if (editingPinId) {
                    // EDITAR
                    url = `/mapa/pin/update/${editingPinId}`;
                    body = { titulo, tipo, descricao, status, contato };
                } else {
                    // CRIAR
                    url = '/mapa/pin';
                    body = { x: pendingX, y: pendingY, titulo, tipo, descricao, status, contato };
                }

                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();

                if (data.success) {
                    if (editingPinId) {
                        // Atualiza o pin existente
                        const idx = pins.findIndex(p => p.id === editingPinId);
                        if (idx > -1) {
                            pins[idx].titulo = titulo;
                            pins[idx].tipo = tipo;
                            pins[idx].descricao = descricao;
                            pins[idx].status = status;
                            pins[idx].contato = contato;
                        }
                    } else {
                        // Adiciona novo pin
                        pins.push({
                            id: data.id,
                            x_percent: pendingX,
                            y_percent: pendingY,
                            titulo, tipo, descricao,
                            status: status || '',
                            contato: contato || ''
                        });
                    }
                    renderPins();
                    window.fecharModal();
                    pinForm.reset();
                    editingPinId = null;
                } else {
                    alert('Erro: ' + (data.error || 'Não foi possível salvar.'));
                }
            } catch (err) {
                alert('Erro de conexão.');
            }
        });
    }

    // ================================
    // BOTÃO EDITAR
    // ================================
    const btnEdit = document.getElementById('btnEditPin');
    if (btnEdit) {
        btnEdit.addEventListener('click', function () {
            const pin = pins.find(p => p.id === currentViewPinId);
            if (!pin) return;

            editingPinId = pin.id;
            document.getElementById('pinModalTitle').textContent = 'Editar Marcação';
            document.getElementById('pinEditId').value = pin.id;
            document.getElementById('pinTitulo').value = pin.titulo;
            document.getElementById('pinTipo').value = pin.tipo;
            document.getElementById('pinDescricao').value = pin.descricao || '';
            document.getElementById('pinStatus').value = pin.status || 'online';
            document.getElementById('pinContato').value = pin.contato || '';

            atualizarCamposEspeciais();

            window.fecharViewModal();
            pinModal.classList.add('active');
        });
    }

    // ================================
    // BOTÃO DELETAR
    // ================================
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