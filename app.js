const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv').config();
const MongoDBStore = require('connect-mongodb-session')(session);
const nodemailer = require('nodemailer');

const { requests, validator } = require('./validator');

const port = process.env.PORT;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME;

const store = new MongoDBStore({
  uri: MONGODB_URI,
  databaseName: DB_NAME,
  collection: 'sessions',
  expires: 1000 * 60 * 60 * 24,
});

store.on('error', function (error) {
  console.error('Session store error:', error);
});

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      status: false,
      message: 'email and password are required',
    });

    return;
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const userCollection = db.collection('users');
    const user = await userCollection.findOne({ email });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(404).json({
        status: false,
        message: 'invalid email or password',
      });
    }

    const sessionsCollection = db.collection('sessions');
    await sessionsCollection.insertOne({ user_id: 1, is_valid: true });

    await logActivity('login');

    req.session.userId = user._id;

    res.status(200).json({
      status: true,
      message: 'logged in',
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: false,
      message: 'internal server error',
    });
  } finally {
    await client.close();
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(async (err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.status(500).send('Internal Server Error');
    } else {
      await logActivity('logout');
      res.send('Logged out successfully');
    }
  });
});

router.get('/subscribers', isAuthenticated, async (req, res) => {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const subsCollection = db.collection('subscribers');
    const subscribers = await subsCollection.find({}).toArray();

    res.status(200).json({ status: true, data: subscribers });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

router.get('/subscribers/:id', isAuthenticated, async (req, res) => {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const subssCollection = db.collection('subscribers');
    const subscriber = await subssCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    res.status(200).json({ status: true, data: subscriber });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

router.post(
  '/subscribers',
  [isAuthenticated, requests['subscribers'], validator],
  async (req, res) => {
    const body = req.body;
    const client = new MongoClient(MONGODB_URI);

    try {
      await client.connect();

      const db = client.db(DB_NAME);
      const subsCollection = db.collection('subscribers');
      const subscriber = await subsCollection.insertOne({ ...body });

      sendEmail(body.email);

      res.status(200).json({ status: true, data: subscriber });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send('Internal Server Error');
    } finally {
      await client.close();
    }
  }
);

router.patch('/subscribers/:id', [isAuthenticated], async (req, res) => {
  const body = req.body;
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const subsCollection = db.collection('subscribers');
    const subscriber = await subsCollection.updateOne(
      { _id: new ObjectId(String(req.params.id)) },
      {
        $set: { ...body },
      }
    );

    res.status(200).json({ status: true, data: subscriber });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

router.delete('/subscribers/:id', [isAuthenticated], async (req, res) => {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const subsCollection = db.collection('subscribers');
    const subscriber = await subsCollection.deleteOne({
      _id: new ObjectId(String(req.params.id)),
    });

    res.status(200).json({ status: true, data: subscriber });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

async function logActivity(action) {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const logsCollection = db.collection('logs');
    await logsCollection.insertOne({ action, timestamp: new Date() });
  } catch (error) {
    console.error('Error logging action:', error);
  } finally {
    await client.close();
  }
}

function sendEmail(email) {
  const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE,
    auth: {
      user: process.env.MAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: 'no-reply@gmail.com',
    to: email,
    subject: 'Hi, Salam Kenal!',
    text: 'Hi, Salam Kenal!',
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).send('Unauthorized');
  }
}

const app = express();

app.use(
  session({
    secret: process.env.APP_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(express.json());
app.use('/api', router);

app.all('*', (req, res, next) => {
  res.status(404).json({ status: 404, message: 'Where are we?' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
