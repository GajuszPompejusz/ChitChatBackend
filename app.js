const express = require('express');
//const bcrypt = require('bcryptjs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');


dotenv.config();

const app = express();
const port = 3000;

// pool dla PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(express.json());

// Sprawdzanie połączenia z bazą danych
pool.connect((err, client, release) => {
  if (err) {
    console.error('Błąd podczas łączenia się z bazą danych:', err.stack);
  } else {
    console.log('Połączono z bazą danych.');
  }
  release();
});

app.use(express.static(path.join(__dirname)));



//metody GET dla całych tabel

//tabela users
app.get('/users_all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

//tabela rooms
app.get('/rooms_all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

//tabela user_room
app.get('/user_room_all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_room');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

//tabela message
app.get('/message_all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM message');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});


//metody GET z ograniczeniami

//Dane profilu
app.get('/profile', async (req, res) => {
  const { viewedProfileId } = req.query;

  if (!viewedProfileId) {
    return res.status(400).json({ message: 'Owner ID is required' });
  }

  try {
    const result = await pool.query('SELECT name, description FROM users WHERE id = $1', [viewedProfileId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Odbieranie wiadomości
app.get('/read', async (req, res) => {
  const { roomId } = req.query;

  if (!roomId) {
    return res.status(400).json({ message: 'Owner ID is required' });
  }

  try {
    const result = await pool.query('SELECT message.message, message.date, message.owner, users.name FROM message INNER JOIN users ON message.owner = users.id WHERE message.id_room = $1', [roomId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//lista użytkowników w pokoju
app.get('/room', async (req, res) => {
  const { roomId } = req.query;

  if (!roomId) {
    return res.status(400).json({ message: 'Owner ID is required' });
  }

  try {
    const result = await pool.query('SELECT users.id, users.name FROM users INNER JOIN user_room on users.id = user_room.id_user WHERE user_room.id_room = $1', [roomId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Lista dostępnych pokoi
app.get('/rooms', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'Owner ID is required' });
  }

  try {
    const result = await pool.query('SELECT name FROM rooms INNER JOIN user_room on rooms.id = user_room.id_room WHERE user_room.id_user = $1', [userId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


//metody POST

// werufikacja logowania
app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ message: 'Brakuje wprowadzanych danych' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [login]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Nieprawidłowy login' });
    }

    const user = result.rows[0];
    const isPasswordValid = await password.localeCompare(user.password);

    if (isPasswordValid) {
      return res.status(401).json({ message: 'Nieprawidłowe hasło' });
    }

    res.status(200).json({ message: 'Pomyślnie się zalogowano' });
  } catch (error) {
    console.error('Błąd podczas logowania:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/register', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ message: 'Brakuje wprowadzanych danych' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [login]);

    if (result.rows.length > 0) {
      return res.status(400).json({ message: 'Login already in use' });
    }

    const currUsers = await pool.query('SELECT MAX(id) FROM users')
    const maxId = currUsers.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO users (id, name, password) VALUES ($1, $2, $3)', [newId, login, password]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during sign-up:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Wysyłanie wiadomości
app.post('/send', async (req, res) => {
  const { roomId, messageSent, ownerId } = req.body;

  if (!roomId || !messageSent || !ownerId) {
    return res.status(400).json({ message: 'Brakuje wprowadzanych danych' });
  }

  try {

    const currMess = await pool.query('SELECT MAX(id) FROM message')
    const maxId = currMess.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO message (id, id_room, message, owner) VALUES ($1, $2, $3, $4)', [newId, roomId, messageSent, ownerId]);

    res.status(202).json({ message: 'Wiadomość wysłana' });
  } catch (error) {
    console.error('Nie udało się wysłać wiadomości:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Tworzenie pokoju
app.post('/room', async (req, res) => {
  const { roomName, roomCode, ownerId } = req.body;

  if (!roomName || !roomCode || !ownerId) {
    return res.status(400).json({ message: 'Brakuje wprowadzanych danych' });
  }

  try {
    const currRoom = await pool.query('SELECT MAX(id) FROM rooms')
    const maxId = currRoom.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO rooms (id, name, code, owner) VALUES ($1, $2, $3, $4)', [newId, roomName, roomCode, ownerId]);
    await pool.query('INSERT INTO user_room (id_user, id_room) VALUES ($1, $2)', [ownerId, newId]);
    res.status(203).json({ message: 'Pokój utworzony' });
  } catch (error) {
    console.error('Nie udało się utworzyć pokoju:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Generowanie zaproszenia
app.post('/invite', async (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({ message: 'Brakuje ID pokoju' });
  }

  try {
    const result = await pool.query('SELECT code FROM rooms WHERE id = $1', [roomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const roomCode = result.rows[0].code;
    res.status(200).json({ roomCode });
  } catch (error) {
    console.error('Error retrieving room code:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dołączanie do pokoju
app.post('/join', async (req, res) => {
  const { user_id, roomCode } = req.body;

  if (!roomCode) {
    return res.status(400).json({ message: 'Brakuje kodu pokoju' });
  }

  try { 
    const roomResult = await pool.query('SELECT id FROM rooms WHERE code = $1', [roomCode])

    if (roomResult.rows.length == 0) {
      return res.status(400).json({ message: 'Nie ma pokoju o takim kodzie' });
    }

    const room_id = roomResult.rows[0].id;
    await pool.query('INSERT INTO user_room (id_user, id_room) VALUES ($1, $2)', [user_id, room_id]);

    res.status(202).json({ message: 'Dołączono do pokoju' });
  } catch (error) {
    console.error('Nie udało się dołączyć do pokoju:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//metody UPDATE (PUT)

//edycja profilu
app.put('/editprofile', async (req, res) => {
  const { userId, name, description } = req.body;

   if (!userId || !name || !description) {
     return res.status(400).json({ message: 'Brakuje wprowadzanych danych' });
   }

  try {
    const result = await pool.query( 'UPDATE users SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    res.status(200).json({ message: 'Użytkownik zaktualizowany pomyślnie', user: result.rows[0] });
  } catch (error) {
    console.error('Błąd podczas aktualizowania użytkownika:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




// Rozpocznij serwer
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
