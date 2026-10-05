const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let messages = [];

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const newMessage = { id: Date.now(), ...req.body };
  messages.push(newMessage);
  res.status(201).json(newMessage);
});

app.get('/', (req, res) => {
  res.send('Подвальная Федерация - сервер работает');
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});