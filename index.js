require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dns = require('dns');
const cors = require('cors');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

const urlSchema = mongoose.Schema({
  original_url: {
    type: String,
    required: true,
    unique: true,
  },
  short_url: {
    type: Number,
    unique: true,
  },
});

urlSchema.pre('save', async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Find the document with the highest short_url
    const latestUrl = await URLModel.findOne({}, {}, { sort: { short_url: -1 } });

    // Calculate the next short_url
    const nextShortUrl = latestUrl && latestUrl.short_url !== undefined ? latestUrl.short_url + 1 : 1;

    // Assign the next short_url to the document
    this.short_url = nextShortUrl;
    next();
  } catch (err) {
    next(err);
  }
});

const URLModel = mongoose.model('URL', urlSchema);

// Connect DB
mongoose.connect(mongoURI, { useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Express Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));

// Render Pages
app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API Routes
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  const urlParts = new URL(originalUrl);
  dns.lookup(urlParts.hostname, async (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }

    try {
      const existingURL = await URLModel.findOne({ original_url: originalUrl });

      if (existingURL) {
        // URL already exists, return the existing URL object
        res.json({ original_url: existingURL.original_url, short_url: existingURL.short_url });
      } else {
        // URL doesn't exist, create a new one
        const result = await URLModel.create({ original_url: originalUrl });
        res.json({ original_url: originalUrl, short_url: result.short_url });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'internal server error' });
    }
  });
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
