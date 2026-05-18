import dotenv from 'dotenv';
dotenv.config();

import express from 'express';

const app = express();

app.use(express.json());


app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(), 
    })
});


const PORT  = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})