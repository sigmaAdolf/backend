const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json({ limit: '100kb' }));

// Логирование каждого запроса в файл access.log.
const logPath = path.join(__dirname, 'access.log');

app.use((req, res, next) => {
  const startedAt = new Date().toISOString();

  res.on('finish', () => {
    const line = `${startedAt} ${req.method} ${req.originalUrl} ${res.statusCode}\n`;
    fs.appendFile(logPath, line, (err) => {
      if (err) console.error('Не удалось записать access.log:', err.message);
    });
  });

  next();
});

// Хранилище товаров в памяти.
let products = [
  { id: 1, name: 'Клавиатура', price: 2500, category: 'Периферия', stock: 12 },
  { id: 2, name: 'Мышь', price: 1200, category: 'Периферия', stock: 25 },
  { id: 3, name: 'Монитор', price: 18000, category: 'Электроника', stock: 7 },
  { id: 4, name: 'Наушники', price: 4500, category: 'Аудио', stock: 10 },
  { id: 5, name: 'Колонки', price: 3200, category: 'Аудио', stock: 8 }
];

let nextId = Math.max(...products.map((product) => product.id)) + 1;

function isValidProduct(data, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Тело запроса должно быть JSON-объектом';
  }

  if (!partial || Object.hasOwn(data, 'name')) {
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      return 'Поле name должно быть непустой строкой';
    }
  }

  if (!partial || Object.hasOwn(data, 'price')) {
    if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0) {
      return 'Поле price должно быть неотрицательным числом';
    }
  }

  if (!partial || Object.hasOwn(data, 'category')) {
    if (typeof data.category !== 'string' || data.category.trim() === '') {
      return 'Поле category должно быть непустой строкой';
    }
  }

  if (Object.hasOwn(data, 'stock')) {
    if (!Number.isInteger(data.stock) || data.stock < 0) {
      return 'Поле stock должно быть неотрицательным целым числом';
    }
  } else if (!partial) {
    return 'Поле stock обязательно';
  }

  const allowedFields = ['name', 'price', 'category', 'stock'];
  const unknownFields = Object.keys(data).filter((key) => !allowedFields.includes(key));
  if (unknownFields.length > 0) {
    return `Неизвестные поля: ${unknownFields.join(', ')}`;
  }

  return null;
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /items — список товаров с поиском, сортировкой и пагинацией.
app.get('/items', (req, res, next) => {
  try {
    let result = [...products];

    if (req.query.search !== undefined) {
      const search = String(req.query.search).trim().toLowerCase();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(search)
      );
    }

    if (req.query.category !== undefined) {
      result = result.filter(
        (product) => product.category.toLowerCase() === String(req.query.category).toLowerCase()
      );
    }

    const allowedSortFields = ['id', 'name', 'price', 'category', 'stock'];
    if (req.query.sort !== undefined) {
      const field = String(req.query.sort);
      if (!allowedSortFields.includes(field)) {
        return res.status(400).json({
          error: `Сортировка по полю ${field} не поддерживается`
        });
      }

      const order = String(req.query.order || 'asc').toLowerCase();
      if (!['asc', 'desc'].includes(order)) {
        return res.status(400).json({ error: 'Параметр order должен быть asc или desc' });
      }

      result.sort((a, b) => {
        const comparison = typeof a[field] === 'string'
          ? a[field].localeCompare(b[field], 'ru')
          : a[field] - b[field];
        return order === 'asc' ? comparison : -comparison;
      });
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'page должен быть положительным целым числом, limit — от 1 до 100'
      });
    }

    const total = result.length;
    const start = (page - 1) * limit;
    result = result.slice(start, start + limit);

    res.status(200).json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      items: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /items/stats — статистика. Маршрут объявлен до /items/:id.
app.get('/items/stats', (req, res, next) => {
  try {
    const count = products.length;
    const averagePrice = count
      ? Number((products.reduce((sum, product) => sum + product.price, 0) / count).toFixed(2))
      : 0;

    res.status(200).json({ count, averagePrice });
  } catch (err) {
    next(err);
  }
});

// POST /items/bulk — массовое создание товаров.
app.post('/items/bulk', (req, res, next) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Поле items должно быть непустым массивом' });
    }

    if (items.length > 100) {
      return res.status(400).json({ error: 'За один запрос можно создать не более 100 товаров' });
    }

    for (let i = 0; i < items.length; i++) {
      const validationError = isValidProduct(items[i]);
      if (validationError) {
        return res.status(400).json({
          error: `Ошибка в элементе с индексом ${i}: ${validationError}`
        });
      }
    }

    const created = items.map((item) => ({
      id: nextId++,
      name: item.name.trim(),
      price: item.price,
      category: item.category.trim(),
      stock: item.stock
    }));

    products.push(...created);
    res.status(201).json({ createdCount: created.length, items: created });
  } catch (err) {
    next(err);
  }
});

// GET /items/:id/related — товары той же категории.
app.get('/items/:id/related', (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'ID должен быть положительным целым числом' });
    }

    const product = products.find((item) => item.id === id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const related = products.filter(
      (item) => item.id !== id && item.category === product.category
    );

    res.status(200).json({
      productId: id,
      category: product.category,
      count: related.length,
      items: related
    });
  } catch (err) {
    next(err);
  }
});

// GET /items/:id — получение одного товара.
app.get('/items/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'ID должен быть положительным целым числом' });
    }

    const product = products.find((item) => item.id === id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
});

// POST /items — создание товара.
app.post('/items', (req, res, next) => {
  try {
    const validationError = isValidProduct(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const product = {
      id: nextId++,
      name: req.body.name.trim(),
      price: req.body.price,
      category: req.body.category.trim(),
      stock: req.body.stock
    };

    products.push(product);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PUT /items/:id — обновление полей товара с проверкой полного объекта.
app.put('/items/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'ID должен быть положительным целым числом' });
    }

    const index = products.findIndex((item) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const validationError = isValidProduct(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    products[index] = {
      id,
      name: req.body.name.trim(),
      price: req.body.price,
      category: req.body.category.trim(),
      stock: req.body.stock
    };

    res.status(200).json(products[index]);
  } catch (err) {
    next(err);
  }
});

// PATCH /items/:id — частичное обновление переданных полей.
app.patch('/items/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'ID должен быть положительным целым числом' });
    }

    const index = products.findIndex((item) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Передайте объект с полями для изменения' });
    }

    const validationError = isValidProduct(data, true);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    products[index] = {
      ...products[index],
      ...(Object.hasOwn(data, 'name') ? { name: data.name.trim() } : {}),
      ...(Object.hasOwn(data, 'category') ? { category: data.category.trim() } : {}),
      ...(Object.hasOwn(data, 'price') ? { price: data.price } : {}),
      ...(Object.hasOwn(data, 'stock') ? { stock: data.stock } : {})
    };

    res.status(200).json(products[index]);
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id — удаление одного товара.
app.delete('/items/:id', (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'ID должен быть положительным целым числом' });
    }

    const index = products.findIndex((item) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    products.splice(index, 1);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// DELETE /items — массовое удаление всех товаров.
app.delete('/items', (req, res, next) => {
  try {
    const deletedCount = products.length;
    products = [];
    res.status(200).json({ message: 'Все товары удалены', deletedCount });
  } catch (err) {
    next(err);
  }
});

// Обработка несуществующих маршрутов.
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок Express (должен идти после маршрутов).
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
