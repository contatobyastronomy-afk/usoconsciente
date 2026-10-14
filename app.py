import os
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "troque-essa-chave-secreta-2026")

# ========================================================
# 👑 LISTA DE ADMINISTRADORES
# ========================================================
ADMIN_EMAILS = [
    "thierry@ifs.edu.br",
    "admin@usoconsciente.com",
]

# ========================================================
# 🗄️ CONEXÃO COM O BANCO (PostgreSQL do Supabase)
# ========================================================
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL não configurada.")
    return psycopg2.connect(DATABASE_URL, sslmode='require')

# ========================================================
# 📍 PINS PADRÃO DO MAPA
# ========================================================
DEFAULT_PINS = [
    {"x": 24.0, "y": 22.0, "titulo": "⚽ Ginásio Esportivo", "descricao": "Ginásio Esportivo do Campus Lagarto.", "tipo": "info", "status": None, "contato": None},
    {"x": 43.0, "y": 11.0, "titulo": "🎾 Garagem de Jogos", "descricao": "Espaço de jogos ao ar livre.", "tipo": "info", "status": None, "contato": None},
    {"x": 49.0, "y": 19.0, "titulo": "🖥 COINF / COIRC", "descricao": "Coordenação de Informática e Coordenação de Infraestrutura.", "tipo": "info", "status": None, "contato": None},
    {"x": 38.0, "y": 27.0, "titulo": "🍽 Refeitório", "descricao": "Espaço para refeições. Também abriga a Vivência e o CLF.", "tipo": "info", "status": None, "contato": None},
    {"x": 52.0, "y": 37.0, "titulo": "📗 Bloco 1 — Administração", "descricao": "Direção Geral (GADM), Direção de Ensino, NAPNE, CRE, Biblioteca e NUSE.", "tipo": "info", "status": None, "contato": None},
    {"x": 61.0, "y": 40.0, "titulo": "🧧 Bloco 2 — Salas de Aula", "descricao": "Salas de Aula 01 a 07. Laboratórios de CAD, Química, Física, Biologia, Desenho de Edificações e Eletromecânica.", "tipo": "info", "status": None, "contato": None},
    {"x": 40.0, "y": 46.0, "titulo": "📘 Bloco 3 — Miniauditório e Labs", "descricao": "Miniauditório, Lab. de Física Aplicada, EAD, CCHS, Salas 08 a 10, Lab. de Matemática Aplicada, Refrigeração, Instalações Elétricas, Ensaios, Eletricidade e Eletrônica.", "tipo": "info", "status": None, "contato": None},
    {"x": 55.0, "y": 32.0, "titulo": "⬛ Bloco 4 — Laboratórios Gerais", "descricao": "Lab. de Metrologia, EMEC, Eletrônica de Potência, Automação, Pneumática, Mat. de Construção, Empreendedorismo, Solos, Inst. Hidráulicas, Instalações Elétricas Residenciais.", "tipo": "info", "status": None, "contato": None},
    {"x": 71.0, "y": 29.0, "titulo": "🏠 COED / COAU", "descricao": "Ateliê de Desenho 1 e 2, Sala de Plástica, Lab. de Desenho Digital 1 e 2, coordenações COED/COAU.", "tipo": "info", "status": None, "contato": None},
    {"x": 22.0, "y": 68.0, "titulo": "📺 Auditório", "descricao": "Auditório principal do campus. Apresentações, palestras e eventos.", "tipo": "evento", "status": None, "contato": None},
    {"x": 49.0, "y": 80.0, "titulo": "👮 Guarita", "descricao": "Entrada principal e controle de acesso. Também abriga a Torre.", "tipo": "info", "status": None, "contato": None},
]

# ========================================================
# 🖼️ BUSCADOR DE IMAGENS
# ========================================================
EXTENSOES = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP']

def find_image(basename):
    for ext in EXTENSOES:
        filename = basename + ext
        path = os.path.join('static', 'img', filename)
        if os.path.exists(path):
            return 'img/' + filename
    return None

# ========================================================
# 🗄️ INICIALIZAÇÃO DO BANCO
# ========================================================
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            data TEXT NOT NULL,
            hora TEXT,
            local TEXT,
            descricao TEXT,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS map_pins (
            id SERIAL PRIMARY KEY,
            x_percent REAL NOT NULL,
            y_percent REAL NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT,
            tipo TEXT DEFAULT 'info',
            status TEXT,
            contato TEXT,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migração: adiciona colunas status e contato se a tabela já existia
    try:
        cursor.execute("ALTER TABLE map_pins ADD COLUMN status TEXT")
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()
    try:
        cursor.execute("ALTER TABLE map_pins ADD COLUMN contato TEXT")
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tips (
            id SERIAL PRIMARY KEY,
            categoria TEXT NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT,
            icone TEXT DEFAULT '💡',
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("UPDATE users SET is_admin = 0")
    for email in ADMIN_EMAILS:
        cursor.execute("UPDATE users SET is_admin = 1 WHERE email = %s", (email.lower(),))

    cursor.execute("SELECT COUNT(*) FROM map_pins")
    if cursor.fetchone()[0] == 0:
        for pin in DEFAULT_PINS:
            cursor.execute(
                "INSERT INTO map_pins (x_percent, y_percent, titulo, descricao, tipo, status, contato) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (pin['x'], pin['y'], pin['titulo'], pin['descricao'], pin['tipo'], pin.get('status'), pin.get('contato'))
            )

    conn.commit()
    cursor.close()
    conn.close()

# ========================================================
# 👤 HELPERS DE USUÁRIO
# ========================================================
def get_user_by_email(email):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, nome, email, senha, is_admin FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user

def create_user(nome, email, senha_hash, is_admin=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (nome, email, senha, is_admin) VALUES (%s, %s, %s, %s)",
            (nome, email, senha_hash, is_admin)
        )
        conn.commit()
        return True
    except psycopg2.IntegrityError:
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ========================================================
# 🔒 DECORATORS
# ========================================================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Você precisa fazer login para acessar essa página.", "erro")
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Você precisa fazer login.", "erro")
            return redirect(url_for("login", next=request.path))
        if not session.get("is_admin"):
            flash("Acesso restrito a administradores.", "erro")
            return redirect(url_for("home"))
        return f(*args, **kwargs)
    return decorated_function

# ========================================================
# 🌐 CONTEXT PROCESSOR
# ========================================================
@app.context_processor
def inject_globals():
    return dict(
        current_user=session.get("user_nome"),
        current_is_admin=session.get("is_admin", 0),
        img_celular=find_image('celular'),
        img_dardo=find_image('dardo'),
        img_mapa=find_image('mapa'),
    )

# ========================================================
# 🔐 AUTENTICAÇÃO
# ========================================================
@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("home"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")

        user = get_user_by_email(email)
        if user and check_password_hash(user['senha'], senha):
            session["user_id"] = user['id']
            session["user_nome"] = user['nome']
            session["user_email"] = user['email']
            session["is_admin"] = user['is_admin']
            flash(f"Bem-vindo(a), {user['nome']}!", "sucesso")
            next_page = request.args.get("next") or url_for("home")
            return redirect(next_page)
        else:
            flash("E-mail ou senha inválidos.", "erro")

    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if session.get("user_id"):
        return redirect(url_for("home"))

    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")
        confirmar = request.form.get("confirmar", "")

        if not nome or not email or not senha:
            flash("Preencha todos os campos.", "erro")
        elif senha != confirmar:
            flash("As senhas não coincidem.", "erro")
        elif len(senha) < 6:
            flash("A senha deve ter pelo menos 6 caracteres.", "erro")
        elif get_user_by_email(email):
            flash("Esse e-mail já está cadastrado.", "erro")
        else:
            is_admin = 1 if email in [e.lower() for e in ADMIN_EMAILS] else 0
            senha_hash = generate_password_hash(senha)
            if create_user(nome, email, senha_hash, is_admin):
                if is_admin:
                    flash("Conta de ADMINISTRADOR criada! Faça login para continuar.", "sucesso")
                else:
                    flash("Conta criada com sucesso! Faça login para continuar.", "sucesso")
                return redirect(url_for("login"))
            else:
                flash("Erro ao criar conta. Tente novamente.", "erro")

    return render_template("register.html")

@app.route("/logout")
def logout():
    session.clear()
    flash("Você saiu da sua conta.", "sucesso")
    return redirect(url_for("home"))

# ========================================================
# 📄 PÁGINAS PRINCIPAIS
# ========================================================
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/objetivos')
@login_required
def objetivos():
    return render_template('objetivos.html')

@app.route('/dados')
@login_required
def dados():
    return render_template('dados.html')

@app.route('/sobre')
@login_required
def sobre():
    return render_template('sobre.html')

@app.route('/quiz')
@login_required
def quiz():
    return render_template('quiz.html')

# ========================================================
# 💡 DICAS
# ========================================================
@app.route('/dicas', methods=['GET', 'POST'])
@login_required
def dicas():
    if request.method == 'POST':
        if not session.get('is_admin'):
            flash("Apenas administradores podem criar dicas.", "erro")
            return redirect(url_for('dicas'))

        categoria = request.form.get('categoria', '').strip()
        titulo = request.form.get('titulo', '').strip()
        descricao = request.form.get('descricao', '').strip()
        icone = request.form.get('icone', '💡').strip() or '💡'

        if not titulo or not categoria:
            flash("Categoria e título são obrigatórios.", "erro")
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO tips (categoria, titulo, descricao, icone) VALUES (%s, %s, %s, %s)",
                (categoria, titulo, descricao, icone)
            )
            conn.commit()
            cursor.close()
            conn.close()
            flash("Dica publicada com sucesso!", "sucesso")
        return redirect(url_for('dicas'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, categoria, titulo, descricao, icone FROM tips ORDER BY categoria ASC, id DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    tips = [{
        'id': r[0], 'categoria': r[1], 'titulo': r[2],
        'descricao': r[3] or '', 'icone': r[4] or '💡'
    } for r in rows]

    return render_template('dicas.html', tips=tips)

@app.route('/dicas/delete/<int:tip_id>', methods=['POST'])
@admin_required
def delete_tip(tip_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tips WHERE id = %s", (tip_id,))
    conn.commit()
    cursor.close()
    conn.close()
    flash("Dica removida.", "sucesso")
    return redirect(url_for('dicas'))

# ========================================================
# 📅 EVENTOS
# ========================================================
@app.route('/evento', methods=['GET', 'POST'])
@login_required
def evento():
    if request.method == 'POST':
        if not session.get('is_admin'):
            flash("Apenas administradores podem criar eventos.", "erro")
            return redirect(url_for('evento'))

        titulo = request.form.get('titulo', '').strip()
        data = request.form.get('data', '').strip()
        hora = request.form.get('hora', '').strip()
        local = request.form.get('local', '').strip()
        descricao = request.form.get('descricao', '').strip()

        if not titulo or not data:
            flash("Título e data são obrigatórios.", "erro")
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO events (titulo, data, hora, local, descricao) VALUES (%s, %s, %s, %s, %s)",
                (titulo, data, hora, local, descricao)
            )
            conn.commit()
            cursor.close()
            conn.close()
            flash("Evento publicado com sucesso!", "sucesso")
        return redirect(url_for('evento'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, titulo, data, hora, local, descricao FROM events ORDER BY data ASC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
    events = []
    for r in rows:
        try:
            dt = datetime.strptime(r[2], '%Y-%m-%d')
            dia = dt.strftime('%d')
            mes = meses[dt.month - 1]
            data_fmt = dt.strftime('%d/%m/%Y')
        except Exception:
            dia, mes, data_fmt = '?', '???', r[2]
        events.append({
            'id': r[0], 'titulo': r[1], 'data': data_fmt, 'dia': dia, 'mes': mes,
            'hora': r[3] or '', 'local': r[4] or '', 'descricao': r[5] or ''
        })

    return render_template('evento.html', events=events)

@app.route('/evento/delete/<int:event_id>', methods=['POST'])
@admin_required
def delete_event(event_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
    conn.commit()
    cursor.close()
    conn.close()
    flash("Evento removido.", "sucesso")
    return redirect(url_for('evento'))

# ========================================================
# 🗺️ MAPA
# ========================================================
@app.route('/mapa')
@login_required
def mapa():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, x_percent, y_percent, titulo, descricao, tipo, status, contato FROM map_pins")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    pins = [{
        'id': r[0], 'x_percent': r[1], 'y_percent': r[2],
        'titulo': r[3], 'descricao': r[4] or '', 'tipo': r[5] or 'info',
        'status': r[6] or '', 'contato': r[7] or ''
    } for r in rows]

    return render_template('mapa.html', pins=pins)

@app.route('/mapa/pin', methods=['POST'])
@admin_required
def create_pin():
    data = request.get_json() or {}
    try:
        x = float(data.get('x'))
        y = float(data.get('y'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Posição inválida"}), 400

    titulo = (data.get('titulo') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    tipo = data.get('tipo', 'info')
    status = (data.get('status') or '').strip() or None
    contato = (data.get('contato') or '').strip() or None

    if not titulo:
        return jsonify({"success": False, "error": "Título obrigatório"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO map_pins (x_percent, y_percent, titulo, descricao, tipo, status, contato) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (x, y, titulo, descricao, tipo, status, contato)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True, "id": new_id})

@app.route('/mapa/pin/move/<int:pin_id>', methods=['POST'])
@admin_required
def move_pin(pin_id):
    data = request.get_json() or {}
    try:
        x = float(data.get('x'))
        y = float(data.get('y'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Posição inválida"}), 400

    x = max(0, min(100, x))
    y = max(0, min(100, y))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE map_pins SET x_percent = %s, y_percent = %s WHERE id = %s",
        (x, y, pin_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True})

@app.route('/mapa/pin/update/<int:pin_id>', methods=['POST'])
@admin_required
def update_pin(pin_id):
    data = request.get_json() or {}
    titulo = (data.get('titulo') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    tipo = data.get('tipo', 'info')
    status = (data.get('status') or '').strip() or None
    contato = (data.get('contato') or '').strip() or None

    if not titulo:
        return jsonify({"success": False, "error": "Título obrigatório"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE map_pins SET titulo = %s, descricao = %s, tipo = %s, status = %s, contato = %s WHERE id = %s",
        (titulo, descricao, tipo, status, contato, pin_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True})

@app.route('/mapa/pin/delete/<int:pin_id>', methods=['POST'])
@admin_required
def delete_pin(pin_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM map_pins WHERE id = %s", (pin_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"success": True})

# ========================================================
# 🚀 INICIALIZAÇÃO
# ========================================================
with app.app_context():
    try:
        init_db()
    except Exception as e:
        print(f"Erro ao inicializar banco: {e}")

if __name__ == '__main__':
    app.run(debug=True)