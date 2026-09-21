from flask import Flask, jsonify, request
import time

app = Flask(__name__)

@app.before_request
def log_request():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {request.method} {request.path}")

@app.route('/')
def home():
    return 'Добро пожаловать на сервер товаров!'

@app.route('/api/products')
def products():
    return jsonify({"products": [
            {"id": 1, "name": "Ноутбук"},
            {"id": 2, "name": "Смартфон"},
            {"id": 3, "name": "Наушники"}
          ]
        })

@app.route('/api/brands')
def brands():
    return jsonify({
        "brands": [
            "Apple",
            "Samsung",
            "Sony"
        ]
    })

@app.route('/api/products/<int:product_id>')
def product(product_id):
    return jsonify({"message": product_id, "status": "success"})

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Маршрут не найден"}), 404

if __name__ == '__main__':
    app.run(port=3000, debug=True)