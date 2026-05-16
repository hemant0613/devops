const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const mongoURL = 'mongodb://mongodb-service:27017';
const client = new MongoClient(mongoURL);

let collection;

async function start() {
    await client.connect();

    const db = client.db('demoapp');
    collection = db.collection('messages');

    console.log('Connected to MongoDB');
}

start();

app.get('/messages', async (req, res) => {
    const data = await collection.find().toArray();
    res.json(data);
});

app.post('/messages', async (req, res) => {
    await collection.insertOne({
        text: req.body.text
    });

    res.json({
        status: 'saved'
    });
});

app.listen(3000, () => {
    console.log('Backend running on port 3000');
});