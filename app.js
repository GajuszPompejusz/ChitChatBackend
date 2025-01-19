const express = require('express');
//const bcrypt = require('bcryptjs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
const port = 3001;
app.use(express.json());

// Konfiguracja CORS
const corsOptions = {
  origin: 'http://localhost:3000', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

// Użycie middleware CORS
app.use(cors(corsOptions));

// pool dla PostgreSQL
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
    
    // Check connection
    await poolDefault.connect();

    // Database name
    const dbName = 'ChitChat'; // Replace with your desired database name

    // Check if the database already exists
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    const result = await poolDefault.query(checkDbQuery, [dbName]);
    
    if (result.rows.length === 0) {
      
      // Database does not exist, create it
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
          password varchar(32) COLLATE pg_catalog."default" NOT NULL,
          description varchar(255) COLLATE pg_catalog."default" DEFAULT 'desc.'::text,
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

      // //I may put some inserts here, maybe
      // await pool.query(`
      //   `)

    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  } catch (error) {
    console.error('Error creating the database:', error.message);
  } finally {
    // Close the connection
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



//metody GET dla całych tabel

// //tabela users
// app.get('/users_all', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM users');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching data:', error.stack);
//     res.status(500).send('Internal Server Error');
//   }
// });

// //tabela rooms
// app.get('/rooms_all', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM rooms');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching data:', error.stack);
//     res.status(500).send('Internal Server Error');
//   }
// });

// //tabela user_room
// app.get('/user_room_all', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM user_room');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching data:', error.stack);
//     res.status(500).send('Internal Server Error');
//   }
// });

// //tabela message
// app.get('/message_all', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM message');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching data:', error.stack);
//     res.status(500).send('Internal Server Error');
//   }
// });


//metody GET

//Weryfikacja sesji
app.get('/session', async (req, res) => {

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  try {
    res.status(200).json(req.session.userId);
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Dane profilu
app.get('/profile', async (req, res) => {
  const { userId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'User ID is missing' });
  }

  try {
    const result = await pool.query('SELECT name, description FROM users WHERE id = $1', [userId]);

    if (result.rows.length == 0)
    {
      return res.status(400).json({ message: 'No user with such ID' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Dane pokoju (lista użytkowników)
app.get('/room', async (req, res) => {
  const { roomId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'Room ID is required' });
  }

  try {
    const result = await pool.query('SELECT users.id, users.name FROM users INNER JOIN user_room on users.id = user_room.id_user WHERE user_room.id_room = $1', [roomId]);
    const resultOwner = await pool.query('SELECT owner FROM room WHERE id = $1', [roomId]);

    if (resultOwner.rows.length == 0)
    {
      return res.status(400).json({ message: 'This room does not exist' });
    }

    res.status(200).json( resultOwner.rows[0].owner, result.rows );
  } catch (error) {
    console.error('Error getting data of a room:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Lista pokoi użytkownika
app.get('/rooms', async (req, res) => {

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  // if (!req.session.userId) {
  //   return res.status(400).json({ message: 'User ID is missing' });
  // }

  try {
    const result = await pool.query('SELECT id, name FROM rooms INNER JOIN user_room on rooms.id = user_room.id_room WHERE user_room.id_user = $1', [req.session.userId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Kod zaproszenia
app.get('/invite', async (req, res) => {
  const { roomId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'Room ID is missing' });
  }

  try {
    const result = await pool.query('SELECT code FROM rooms WHERE id = $1', [roomId]);

    if (result.rows.length == 0){
      return res.status(400).json({ message: 'This room does not exist' });
    }

    res.status(200).json(result.rows[0].code);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//Odbieranie wiadomości
app.get('/read', async (req, res) => {
  const { roomId, lastMessageId } = req.query;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'Room ID is missing' });
  }

  try {
    if (lastMessageId != null) {
      const result = await pool.query('SELECT message.message, message.date, message.owner, users.name FROM message INNER JOIN users ON message.owner = users.id WHERE message.id_room = $1 AND message.id > $2', [roomId, lastMessageId]);
    } else {
      const result = await pool.query('SELECT message.message, message.date, message.owner, users.name FROM message INNER JOIN users ON message.owner = users.id WHERE message.id_room = $1', [roomId]);
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



//metody POST

// Logowanie
app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ message: 'Missing login or password' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Incorrect login' });
    }

    const user = result.rows[0];
    const isPasswordValid = await password.localeCompare(user.password);

    if (isPasswordValid) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    req.session.userId = user.id;
    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rejestracja
app.post('/register', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ message: 'Missing login or password' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);

    if (result.rows.length > 0) {
      return res.status(400).json({ message: 'Login already in use' });
    }

    const currUsers = await pool.query('SELECT MAX(id) FROM users')
    const maxId = currUsers.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO users (id, name, password) VALUES ($1, $2, $3)', [newId, login, password]);

    req.session.userId = newId;
    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during sign-up:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Tworzenie pokoju
app.post('/room', async (req, res) => {
  const { name } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!name) {
    return res.status(400).json({ message: 'Missing name' });
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

    res.status(200).json({ message: 'Room created' });
  } catch (error) {
    console.error('Could not create room:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generowanie kodu zaproszenia
app.post('/invite', async (req, res) => {
  const { roomId } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'Room ID missing' });
  }

  try {
    const result = await pool.query('SELECT code FROM room WHERE id = $1', [roomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (result.rows[0].owner != req.session.userId) {
      return res.status(400).json({ message: 'Not owner of the room' });
    }

    const length = 8;
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    pool.query( 'UPDATE room SET code = $1 WHERE id = $2', [code, roomId])

    res.status(200).json({ code });
  } catch (error) {
    console.error('Error retrieving room code:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dołączanie do pokoju
app.post('/join', async (req, res) => {
  const { code } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!code) {
    return res.status(400).json({ message: 'Room code missing' });
  }

  try { 
    const roomResult = await pool.query('SELECT id FROM room WHERE code = $1', [code])

    if (roomResult.rows.length == 0) {
      return res.status(400).json({ message: 'Incorrect room code' });
    }

    const roomId = roomResult.rows[0].id;
    await pool.query('INSERT INTO user_room (id_user, id_room) VALUES ($1, $2)', [req.session.userId, room_id]);

    res.status(200).json({ roomId });
  } catch (error) {
    console.error('Error during joining a room:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Wysyłanie wiadomości
app.post('/send', async (req, res) => {
  const { roomId, message } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

  if (!roomId || !message) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const result = await pool.query('SELECT * FROM user_room WHERE id_user = $1 AND id_room = $2', [req.session.userId, roomId])
  if (result.rows.length == 0)
  {
    return res.status(400).json({ message: 'User not in the room' });
  }

  try {

    const currMess = await pool.query('SELECT MAX(id) FROM message');
    const maxId = currMess.rows[0].max; 
    const newId = maxId !== null ? maxId + 1 : 1;
   
    await pool.query('INSERT INTO message (id, id_room, message, owner) VALUES ($1, $2, $3, $4)', [newId, roomId, message, req.session.userId]);

    const newMessageInfo = await pool.query('SELECT message.id, message.date, message.message, message.owner, users.name FROM message INNER JOIN users ON users.id = message.owner WHERE message.id = $1', [newId]);

    const id = newMessageInfo.rows[0].id;
    const date = newMessageInfo.rows[0].date;
    const message = newMessageInfo.rows[0].message;
    const owner = newMessageInfo.rows[0].owner;
    const name = newMessageInfo.rows[0].name;
    res.status(202).json({ id, date, message, owner, name });
  } catch (error) {
    console.error('Nie udało się wysłać wiadomości:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



//metody PUT

//edycja profilu
app.put('/editprofile', async (req, res) => {
  const { name, description } = req.body;

  if (req.session.userId == null) {
    return res.status(401).json({ message: 'User is not logged in' });
  }

   if (!name) {
     return res.status(400).json({ message: 'Must have a name' });
   }

  try {
    const result = await pool.query( 'UPDATE users SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description, req.session.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No user with such ID' });
    }

    res.status(200).json({ message: 'User updated', user: result.rows[0] });
  } catch (error) {
    console.error('Error during user update:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




// Rozpocznij serwer
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
