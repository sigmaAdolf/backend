from flask import Flask, jsonify, request
import time
app = Flask(__name__)
# Консольное логирование запроса(для продвинутого уровня)
@app.before_request
def log_request(): print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {request.method}{request.path}")
# 1. Текстовый эндпоинт
@app.route('/')
def home():return 'Добро пожаловать на базовый сервер!'
# 2. JSON эндпоинт 1
@app.route('/api/status')
def status():return jsonify({ "status": "ok", "framework": "Flask" })
# 3. JSON эндпоинт 2(для среднего уровня)
@app.route('/api/info')
def info():return jsonify({ "author": "Student", "version": "1.0.0" })
# 4. JSON эндпоинт с параметром(для продвинутого уровня)
@app.route('/api/users/<int:user_id>')
def get_user(user_id):return jsonify({ "message": "Информация о пользователе", "userId": user_id })
# Обработка 404
@app.errorhandler(404)
def not_found(error):return jsonify({ "error": "Маршрут не найден" }), 404
if __name__ == '__main__':app.run(port = 3000, debug = True)