const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');


dotenv.config();
const app = express();
const port = 3001;
app.use(express.json());

app.use(session({
  secret: 'your-secret-key', 
  resave: false, 
  saveUninitialized: false, 
  cookie: { secure: false } 
}));

// Konfiguracja CORS
const corsOptions = {
  origin: 'http://localhost:3000', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

// Użycie middleware CORS
app.use(cors(corsOptions));

// pool dla serwera PostgreSQL
const poolDefault = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});



(async () => {
  try {
    console.log('Connecting to PostgreSQL...');
    
    // Łączenie z bazą
    await poolDefault.connect();

    // Nazwa pożądanej bazy danych
    const dbName = 'ChitChat';

    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    const result = await poolDefault.query(checkDbQuery, [dbName]);
    
    if (result.rows.length === 0) {
      
      // Tworzenie bazy danych jeśli nie istnieje
      const createDbQuery = `CREATE DATABASE ${dbName}`;
      await poolDefault.query(createDbQuery);
      console.log(`Database '${dbName}' created successfully.`);

      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'chitchat',
      });

      await pool.query(`
      CREATE TABLE IF NOT EXISTS public.users
      (
          id integer NOT NULL,
          name varchar(32) COLLATE pg_catalog."default" NOT NULL,
          login varchar(24) COLLATE pg_catalog."default" NOT NULL,
          password text COLLATE pg_catalog."default" NOT NULL,
          description varchar(255) COLLATE pg_catalog."default" DEFAULT,
          CONSTRAINT users_pkey PRIMARY KEY (id),
          CONSTRAINT users_id_login_key UNIQUE (id, login)
      );
          
      CREATE TABLE IF NOT EXISTS public.room
      (
          id integer NOT NULL,
          name varchar(32) COLLATE pg_catalog."default" NOT NULL,
          code varchar(8) COLLATE pg_catalog."default" NOT NULL,
          owner integer NOT NULL,
          CONSTRAINT room_pkey PRIMARY KEY (id),
          CONSTRAINT room_code_key UNIQUE (code),
          CONSTRAINT room_owner_fkey FOREIGN KEY (owner)
             REFERENCES public."users" (id) MATCH SIMPLE
             ON UPDATE NO ACTION
             ON DELETE NO ACTION
      );
      
      CREATE TABLE IF NOT EXISTS public.user_room
      (
          id_user integer NOT NULL,
          id_room integer NOT NULL,
          CONSTRAINT user_room_id_room_fkey FOREIGN KEY (id_room)
              REFERENCES public.room (id) MATCH SIMPLE
              ON UPDATE NO ACTION
              ON DELETE NO ACTION,
          CONSTRAINT user_room_id_user_fkey FOREIGN KEY (id_user)
              REFERENCES public."users" (id) MATCH SIMPLE
              ON UPDATE NO ACTION
              ON DELETE NO ACTION
      );
      
      CREATE TABLE IF NOT EXISTS public.message
      (
          id integer NOT NULL,
          id_room integer NOT NULL,
          date timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP(2),
          message varchar(1000) COLLATE pg_catalog."default" NOT NULL,
          owner integer NOT NULL,
          CONSTRAINT message_pkey PRIMARY KEY (id),
          CONSTRAINT message_id_room_fkey FOREIGN KEY (id_room)
              REFERENCES public.room (id) MATCH SIMPLE
              ON UPDATE NO ACTION
              ON DELETE NO ACTION,
          CONSTRAINT message_owner_fkey FOREIGN KEY (owner)
              REFERENCES public."users" (id) MATCH SIMPLE
              ON UPDATE NO ACTION
              ON DELETE NO ACTION
      );
      
      `);
      console.log('Tables created successfully');


    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  } catch (error) {
    console.error('Error creating the database:', error.message);
  } finally {
    await poolDefault.end();
    console.log('Disconnected from PostgreSQL.');
  }
})();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'chitchat',
});

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




//metody GET

//Weryfikacja sesji
app.get('/session', async (req, res) => {

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }
  try {
    const result = await pool.query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
    const name = result.rows[0].name;
    const userId = req.session.userId;
    return res.status(200).json({userId: userId, name: name});
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Dane profilu
app.get('/profile', async  (req, res) => {
  const { userId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID is missing' });
  }

  const usersSameRoom = await pool.query(`SELECT id_room FROM user_room WHERE id_user = $1 and id_room in (
  SELECT id_room FROM user_room WHERE id_user = $2)`, [userId, req.session.userId]);

  if (usersSameRoom.rows.length == 0)
  {
    return res.status(400).json({ error: 'Users are not connected' });
  }

  try {
    const result = await pool.query('SELECT name, description FROM users WHERE id = $1', [userId]);

    if (result.rows.length == 0)
    {
      return res.status(400).json({ error: 'No user with such ID' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Dane pokoju (lista użytkowników)
app.get('/room', async (req, res) => {
  const { roomId } = req.query;
  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  try {
    const result = await pool.query('SELECT users.id, users.name FROM users INNER JOIN user_room on users.id = user_room.id_user WHERE user_room.id_room = $1', [roomId]);
    const resultOwner = await pool.query('SELECT owner FROM room WHERE id = $1', [roomId]);

    if (resultOwner.rows.length == 0)
    {
      return res.status(400).json({ error: 'This room does not exist' });
    }

    const users = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    return res.status(200).json( {ownerId: resultOwner.rows[0].owner ,users: users});
  } catch (error) {
    console.error('Error getting data of a room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Lista pokoi użytkownika
app.get('/rooms', async (req, res) => {

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  // if (!req.session.userId) {
  //   return res.status(400).json({ error: 'User ID is missing' });
  // }

  try {
    const result = await pool.query('SELECT id, name FROM room INNER JOIN user_room on room.id = user_room.id_room WHERE user_room.id_user = $1', [req.session.userId]);

    return res.status(200).json({rooms: result.rows});
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Kod zaproszenia
app.get('/invite', async (req, res) => {
  const { roomId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is missing' });
  }

  const isInRoom = await pool.query('SELECT * FROM user_room WHERE id_user = $1 AND id_room = $2', [req.session.userId, roomId])

  if (isInRoom.rows.length == 0)
  {
    return res.status(400).json({ error: 'User not in the room' });
  }

  try {
    const result = await pool.query('SELECT code FROM room WHERE id = $1', [roomId]);

    if (result.rows.length == 0){
      return res.status(400).json({ error: 'This room does not exist' });
    }

    return res.status(200).json({code: result.rows[0].code});
  } catch (error) {
    console.error('Error getting room code:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Odbieranie wiadomości
app.get('/read', async (req, res) => {
  const { roomId, lastMessageId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is missing' });
  }

  const isInRoom = await pool.query('SELECT * FROM user_room WHERE id_user = $1 AND id_room = $2', [req.session.userId, roomId])

  if (isInRoom.rows.length == 0)
  {
    return res.status(400).json({ error: 'User not in the room' });
  }

  try {

    let result;
    if (lastMessageId != null) {
      result = await pool.query('SELECT message.id, message.message, message.date, message.owner, users.name FROM message INNER JOIN users ON message.owner = users.id WHERE message.id_room = $1 AND message.id > $2', [roomId, lastMessageId]);
    } else {
      result = await pool.query('SELECT message.id, message.message, message.date, message.owner, users.name FROM message INNER JOIN users ON message.owner = users.id WHERE message.id_room = $1', [roomId]);
    }

    const messages = result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      message: row.message,
      owner: {
        id: row.owner,
        name: row.name,
      },
    }));


    return res.status(200).json({messages: messages});
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Wylogowywanie
app.get('/logout', async (req, res) => {

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is already logged out' });
  }
  try {
    
    req.session.userId = null;
    req.session.save(async(err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      } 
      return res.status(200).json();
    });
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



//metody POST

// Logowanie
app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Incorrect login' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    req.session.userId = user.id;
    req.session.save(async(err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      } 
      return res.status(200).json({ userId: user.id, name: user.name});
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Rejestracja
app.post('/register', async (req, res) => {
  const { name, login, password } = req.body;

  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const saltRounds = 10;
    const passwordHashed = await bcrypt.hash(password, saltRounds);

    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);

    if (result.rows.length > 0) {
      return res.status(400).json({ error: 'Login already in use' });
    }

    const currUsers = await pool.query('SELECT MAX(id) FROM users')
    const maxId = currUsers.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
    const newDesc = '';

    await pool.query('INSERT INTO users (id, name, login, password, description) VALUES ($1, $2, $3, $4, $5)', [newId, name, login, passwordHashed, newDesc]);

    req.session.userId = newId;

    req.session.save(async(err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      } 
      return res.status(200).json({ userId: newId, name: name});
      
    });
  } catch (error) {
    console.error('Error during sign-up:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Tworzenie pokoju
app.post('/room', async (req, res) => {
  const { name } = req.body;
  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }
  const length = 8;
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  try {
    const currRoom = await pool.query('SELECT MAX(id) FROM room')
    const maxId = currRoom.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO room (id, name, code, owner) VALUES ($1, $2, $3, $4)', [newId, name, code, req.session.userId]);
    await pool.query('INSERT INTO user_room (id_user, id_room) VALUES ($1, $2)', [req.session.userId, newId]);

    return res.status(200).json({ roomId: newId });
  } catch (error) {
    console.error('Could not create room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generowanie kodu zaproszenia
app.post('/invite', async (req, res) => {
  const { roomId } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID missing' });
  }

  try {
    const result = await pool.query('SELECT code, owner FROM room WHERE id = $1', [roomId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Room not found' });
    }

    if (result.rows[0].owner != req.session.userId) {
      return res.status(400).json({ error: 'Not owner of the room' });
    }

    const length = 8;
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    pool.query( 'UPDATE room SET code = $1 WHERE id = $2', [code, roomId])

    return res.status(200).json({ code: code });
  } catch (error) {
    console.error('Error retrieving room code:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dołączanie do pokoju
app.post('/join', async (req, res) => {
  const { code } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!code) {
    return res.status(400).json({ error: 'Room code missing' });
  }

  try { 
    const roomResult = await pool.query('SELECT id FROM room WHERE code = $1', [code])

    if (roomResult.rows.length == 0) {
      return res.status(400).json({ error: 'Incorrect room code' });
    }

    const roomId = roomResult.rows[0].id;
    await pool.query('INSERT INTO user_room (id_user, id_room) VALUES ($1, $2)', [req.session.userId, roomId]);

    return res.status(200).json({ roomId: roomId });
  } catch (error) {
    console.error('Error during joining a room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wysyłanie wiadomości
app.post('/send', async (req, res) => {
  const { roomId, message } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

  if (!roomId || !message) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const result = await pool.query('SELECT * FROM user_room WHERE id_user = $1 AND id_room = $2', [req.session.userId, roomId])
  if (result.rows.length == 0)
  {
    return res.status(400).json({ error: 'User not in the room' });
  }

  try {

    const currMess = await pool.query('SELECT MAX(id) FROM message');
    const maxId = currMess.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO message (id, id_room, message, owner) VALUES ($1, $2, $3, $4)', [newId, roomId, message, req.session.userId]);

    const newMessageInfo = await pool.query('SELECT message.id, message.date, message.message, message.owner, users.name FROM message INNER JOIN users ON users.id = message.owner WHERE message.id = $1', [newId]);

    const messageNew = newMessageInfo.rows.map((row) => ({
      id: row.id,
      date: row.date,
      message: row.message,
      owner: {
        id: row.owner,
        name: row.name,
      },
    }));

    return res.status(200).json( messageNew[0] );
  } catch (error) {
    console.error('Could not send the message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



//metody PUT

//edycja profilu
app.put('/profile', async (req, res) => {
  const { name, description } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ error: 'User is not logged in' });
  }

   if (!name) {
     return res.status(400).json({ error: 'Must have a name' });
   }

  try {
    const result = await pool.query( 'UPDATE users SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description, req.session.userId]);

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'No user with such ID' });
    }

    return res.status(200).json({ name: name, description: description });
  } catch (error) {
    console.error('Error during user update:', error);
    res.status(500).json({ error: 'Server error' });
  }
});




// Rozpocznij serwer
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
