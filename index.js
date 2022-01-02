const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const ObjectId = require("mongodb").ObjectId;
require ('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const serviceAccount = {
  type: process.env.FIREBASE_SERVICE_ACCOUNT_TYPE,
  project_id: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID ,
  private_key_id: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID ,
  private_key: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL ,
  client_id: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_ID ,
  auth_uri: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_URI ,
  token_uri: process.env.FIREBASE_SERVICE_ACCOUNT_TOKEN_URI ,
  auth_provider_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL ,
  client_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL ,
};


// console.log(serviceAccount);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Db connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lcafd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// console.log(uri);

// token verification
async function verifyToken (req, res, next) {
  if(req.headers.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
      try{
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.decodedEmail = decodedUser.email;
      }
      catch{}
  }
  next();
}

async function run () {
    try{
        // database conncetion
        await client.connect();
        // console.log('database connected succesfully!!');
        // database name
        const database = client.db('BikersHub');
        // collections
        const productsCollection = database.collection('products');
        const reviewsCollection = database.collection('reviews');
        const orderCollection = database.collection('order');
        const usersCollection = database.collection('users');

        // api
        // GET API

        app.get('/products', async function (req, res) {
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.json(products);
          })
          
        // getting single bike data
        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.json(product);
          });

        app.get('/reviews', async function (req, res) {
            const cursor = reviewsCollection.find({});
            const reviews = await cursor.toArray();
            res.json(reviews);
          });
          
          // user api
        app.get('/users', async(req, res) => {
              const users = usersCollection.find({});
              const result = await users.toArray();
              res.json(result);
        })

        app.get('/users/:email', async(req, res) => {
            const email = req.params.email;
            const query =  { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
              isAdmin= true;
            }
            res.json({ admin: isAdmin })
        })

          // / orders get api
        app.get('/allOrders', async function (req, res) {
            const cursor = orderCollection.find({});
            const orders = await cursor.toArray();
            res.json(orders);
        })
        app.get('/orders', async function (req, res) {
            const email = req.query.email;
            const query = { email: email };
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        })
        
        // booking post api
        app.post("/booking", verifyToken, async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.json(result);
          });

          // review post api
        app.post("/review", async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
          });

          // product post api
        app.post("/products", async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.json(result);
          });

          // users post api
        app.post('/users', async function (req, res) {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            // console.log(result);
            res.json(result);
        })
        // update user
        app.put('/users', async(req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const option = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, option);
            res.json(result);
        })
        // admin api
        app.put('/users/admin', verifyToken, async(req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if(requester){
              const requesterAccount = await usersCollection.findOne({ email: requester });
              if(requesterAccount.role === 'admin') {
                const filter = { email: user.email };
                const updateDoc = { $set: { role: 'admin'} };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.json(result);
              }
            }
            else {
              res.status(403).json({ message: "you don't have access to make an admin!!"});
            }
          })
          // delete Order api
        app.delete('/order/:id', async(req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            // console.log('deleting the user with id: ', result);
            res.json(result);
        })

    }
    finally {
      // await client.close();
    }
}
run().catch(console.dir)

app.get('/', (req, res) => res.send('Bikers Hub'))
app.listen(port, () => console.log(`Bikers Hub app listening on port ${port}!`))