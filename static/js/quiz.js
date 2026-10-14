document.addEventListener('DOMContentLoaded', function () {
    // ==========================================
    // BANCO DE PERGUNTAS
    // ==========================================
    const perguntas = [
        {
            pergunta: "Quantas horas por dia você passa no celular?",
            opcoes: [
                { texto: "Menos de 2 horas", pontos: 0 },
                { texto: "Entre 2 e 4 horas", pontos: 1 },
                { texto: "Entre 4 e 6 horas", pontos: 3 },
                { texto: "Mais de 6 horas", pontos: 4 }
            ]
        },
        {
            pergunta: "Você usa o celular durante as aulas?",
            opcoes: [
                { texto: "Nunca", pontos: 0 },
                { texto: "Raramente", pontos: 1 },
                { texto: "Frequentemente", pontos: 3 },
                { texto: "Sempre", pontos: 4 }
            ]
        },
        {
            pergunta: "Você checa o celular nos primeiros 30 minutos após acordar?",
            opcoes: [
                { texto: "Não", pontos: 0 },
                { texto: "Às vezes", pontos: 1 },
                { texto: "Sim, quase sempre", pontos: 3 },
                { texto: "Sim, é a primeira coisa que faço", pontos: 4 }
            ]
        },
        {
            pergunta: "Você usa o celular na hora de dormir (última hora antes de deitar)?",
            opcoes: [
                { texto: "Não", pontos: 0 },
                { texto: "Às vezes", pontos: 1 },
                { texto: "Quase toda noite", pontos: 3 },
                { texto: "Sempre", pontos: 4 }
            ]
        },
        {
            pergunta: "Você já deixou de fazer algo importante por estar no celular?",
            opcoes: [
                { texto: "Nunca", pontos: 0 },
                { texto: "Raramente", pontos: 1 },
                { texto: "Algumas vezes", pontos: 3 },
                { texto: "Muitas vezes", pontos: 4 }
            ]
        },
        {
            pergunta: "Como você se sente quando fica sem o celular por algumas horas?",
            opcoes: [
                { texto: "Tranquilo(a)", pontos: 0 },
                { texto: "Um pouco incomodado(a)", pontos: 1 },
                { texto: "Ansioso(a)", pontos: 3 },
                { texto: "Muito ansioso(a), preciso checar", pontos: 4 }
            ]
        }
    ];

    // ==========================================
    // PERFIS DE RESULTADO
    // ==========================================
    const perfis = [
        {
            maxPontos: 8,
            emoji: "🌿",
            titulo: "Perfil Equilibrado",
            classe: "perfil-verde",
            descricao: "Parabéns! Você tem uma relação saudável com a tecnologia. Continue assim e sirva de exemplo para colegas e amigos.",
            dicas: [
                "Continue mantendo momentos offline no seu dia",
                "Compartilhe seus hábitos com amigos que precisam de ajuda",
                "Aproveite o tempo livre para praticar esportes ou leitura"
            ]
        },
        {
            maxPontos: 16,
            emoji: "⚡",
            titulo: "Perfil Moderado",
            classe: "perfil-amarelo",
            descricao: "Você já demonstra sinais de uso excessivo. Pequenos ajustes na rotina podem fazer uma grande diferença na sua atenção e bem-estar.",
            dicas: [
                "Ative o modo silencioso durante as aulas e estudos",
                "Estabeleça uma hora do dia sem celular (ex: durante as refeições)",
                "Use o recurso de 'tempo de tela' do seu celular para se monitorar",
                "Tente não pegar o celular nos primeiros 30 min após acordar"
            ]
        },
        {
            maxPontos: 999,
            emoji: "🚨",
            titulo: "Perfil Crítico",
            classe: "perfil-vermelho",
            descricao: "Seu uso do celular está prejudicando sua atenção, sono e possivelmente suas relações. Mudar agora é essencial para sua saúde e desempenho escolar.",
            dicas: [
                "Procure deixar o celular em outro ambiente na hora de estudar",
                "Desative notificações de redes sociais por 7 dias e observe a diferença",
                "Estabeleça um horário fixo para usar redes sociais (ex: 30 min à noite)",
                "Não leve o celular para a cama — carregue-o longe do quarto",
                "Converse com um professor ou orientador sobre o assunto",
                "Busque atividades alternativas: esportes, música, leitura, jogos analógicos"
            ]
        }
    ];

    // ==========================================
    // ESTADO
    // ==========================================
    let indiceAtual = 0;
    let pontuacao = 0;
    let respostas = [];

    // ==========================================
    // ELEMENTOS
    // ==========================================
    const quizArea = document.getElementById('quizArea');
    const resultArea = document.getElementById('resultArea');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');
    const progressBar = document.getElementById('progressBar');
    const stepLabel = document.getElementById('stepLabel');
    const quizCard = document.getElementById('quizCard');

    // ==========================================
    // FUNÇÕES
    // ==========================================
    function carregarPergunta() {
        const p = perguntas[indiceAtual];

        // Atualiza progresso
        const progresso = ((indiceAtual) / perguntas.length) * 100;
        progressBar.style.width = progresso + '%';
        stepLabel.textContent = `Pergunta ${indiceAtual + 1} de ${perguntas.length}`;

        // Anima a entrada
        quizCard.classList.remove('anim-slide-in');
        void quizCard.offsetWidth;
        quizCard.classList.add('anim-slide-in');

        quizQuestion.textContent = p.pergunta;
        quizOptions.innerHTML = '';

        p.opcoes.forEach((op, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quiz-option';
            btn.innerHTML = `<span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span> ${op.texto}`;
            btn.addEventListener('click', () => selecionarOpcao(btn, op.pontos));
            quizOptions.appendChild(btn);
        });
    }

    function selecionarOpcao(btn, pontos) {
        // Desabilita todos para evitar duplo clique
        document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
        btn.classList.add('selecionado');

        pontuacao += pontos;
        respostas.push(pontos);

        setTimeout(() => {
            indiceAtual++;
            if (indiceAtual < perguntas.length) {
                carregarPergunta();
            } else {
                mostrarResultado();
            }
        }, 400);
    }

    function mostrarResultado() {
        quizArea.style.display = 'none';
        progressBar.style.width = '100%';

        // Encontra o perfil
        const perfil = perfis.find(p => pontuacao <= p.maxPontos);

        const resultCard = document.getElementById('resultCard');
        resultCard.className = 'result-card ' + perfil.classe;

        document.getElementById('resultEmoji').textContent = perfil.emoji;
        document.getElementById('resultTitle').textContent = 'Seu Perfil de Uso';
        document.getElementById('resultProfile').textContent = perfil.titulo;
        document.getElementById('resultScore').textContent = `${pontuacao} pontos`;
        document.getElementById('resultDesc').textContent = perfil.descricao;

        const tipsList = document.getElementById('resultTips');
        tipsList.innerHTML = '';
        perfil.dicas.forEach(d => {
            const li = document.createElement('li');
            li.textContent = d;
            tipsList.appendChild(li);
        });

        resultArea.style.display = 'block';
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    carregarPergunta();
});

// Função global para reiniciar
function reiniciarQuiz() {
    location.reload();
}