import { config } from './config';
import { logger } from './logger';
import { connectDb } from './db';
import './redis';

import express from 'express';

const app = express();

app.use(express.json());


connectDb();

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(), 
    })
});


const PORT  = config.port || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})