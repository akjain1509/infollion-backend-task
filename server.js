const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const cache = require("memory-cache");
const dotenv = require("dotenv");
const morgan = require("morgan");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  morgan(
    ":date[iso] :remote-addr :method :url :status :res[content-length] - :response-time ms"
  )
);

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["weather"];

  if (apiKey === process.env.API_KEY) {
    next(); // Proceed if the API key matches
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.RATE_LIMIT || 5,
  message: "Too many requests from this IP, please try again after a minute",
  statusCode: 429,
});
app.use(limiter);

// Cache Middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      return res.send(cachedResponse);
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        cache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      next();
    }
  };
};

// Proxy route - Weather API endpoint
app.get(
  "/api/weather",
  authMiddleware,
  cacheMiddleware(process.env.CACHE_DURATION || 300),
  async (req, res) => {
    const city = req.query.city || "London"; // default to London if no city is provided
    const apiKey = process.env.WEATHER_API_KEY;
    const weatherApiUrl = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;

    try {
      const response = await axios.get(weatherApiUrl);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching data from Weather API:", error.message);
      res.status(500).json({ error: "Failed to fetch data from Weather API" });
    }
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
