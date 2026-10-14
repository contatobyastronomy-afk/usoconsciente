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
    // PINOS
    // ================================
    const tipoLabels = {
       