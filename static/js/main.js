document.addEventListener('DOMContentLoaded', function() {
    function criarGraficoVazio(idCanvas, titulo) {
        const ctx = document.getElementById(idCanvas);
        if (!ctx) return;

        const pluginDadosPendentes = {
            id: 'dadosPendentes',
            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 20px Inter';
                ctx.fillStyle = '#6B7280'; // Cinza para o fundo escuro
                ctx.fillText('Dados Pendentes', width / 2, height / 2);
                ctx.restore();
            }
        };

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: titulo,
                    data: [],
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, display: false },
                    x: { display: false }
                }
            },
            plugins: [pluginDadosPendentes]
        });
    }

    criarGraficoVazio('chartTempoUso', 'Tempo de Uso');
    criarGraficoVazio('chartSalaAula', 'Sala de Aula');
    criarGraficoVazio('chartSaudeMental', 'Saúde Mental');
    criarGraficoVazio('chartAtividades', 'Atividades');
});