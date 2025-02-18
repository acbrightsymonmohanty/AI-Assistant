const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Configure CORS
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept']
}));

// Parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyATf6-RvvATG9zWYBngspUgbSAXMeqqPtA");

app.post('/api/chat', async (req, res) => {
    try {
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        console.log('Received chat request:', req.body); // Debug log

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: req.body.messages,
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenAI API error:', errorData);
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('OpenAI response:', data); // Debug log
        res.json(data);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.message 
        });
    }
});

// Proxy endpoint for ERP API
app.post('/api/erp', async (req, res) => {
    try {
        console.log('Received ERP request:', req.body);

        // Create form data exactly like Postman
        const formData = new FormData();
        formData.append('question', req.body.question);
        formData.append('DBName', req.body.DBName);
        formData.append('Version', req.body.Version);
        formData.append('outputformat', 'json');  // Add this line to match Postman

        console.log('Sending form data:', formData);

        const response = await axios({
            method: 'POST',
            //url: 'http://127.0.0.1:5000/api/AskQuestion',
            url: 'http://dileepllm.bestmarginfotech.com/api/AskQuestion',
            headers: {
                ...formData.getHeaders(),
                'Accept': '*/*'
            },
            data: formData,
            maxBodyLength: Infinity
        });

        console.log('ERP API Response:', response.data);
        res.json(response.data);

    } catch (error) {
        console.error('ERP API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({
            status: 'error',
            error: 'Failed to fetch from ERP API',
            details: error.response?.data || error.message
        });
    }
});

// Add Gemini endpoint
app.post('/api/gemini', async (req, res) => {
    try {
        // Get the model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = req.body.message;
        console.log('Gemini request:', prompt);

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('Gemini response:', text);
        res.json({ 
            message: text,
            status: 'success' 
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({
            error: 'Failed to get Gemini response',
            details: error.message
        });
    }
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Static files served from:', __dirname);
    console.log('API Key configured:', OPENAI_API_KEY ? 'Yes' : 'No');
});

// Global error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
}); 