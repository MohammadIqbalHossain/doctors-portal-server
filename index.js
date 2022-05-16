const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, FindCursor } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express()

app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s2vmm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" })
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.USER_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next()
  });



}


async function run() {
  try {
    await client.connect();

    const servicesCollections = client.db("doctors_portal").collection("services");
    const bookingCollections = client.db("doctors_portal").collection("booking");
    const userCollections = client.db("doctors_portal").collection("users");

    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = servicesCollections.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollections.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollections.insertOne(booking);
      return res.send({ success: true, result });
    })

    app.get('/booking', verifyToken, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const patient = req.query.patient;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const result = await bookingCollections.find(query).toArray();
        return res.send(result);
      }
      else {
        return res.status(403).send({ message: "Forbidden access" });
      }

    })

    app.get('/users', verifyToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    })

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollections.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    })

    app.put('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const initatorAccount = await userCollections.find({ email: requester });
      if (initatorAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollections.updateOne(filter, updateDoc);
        return res.send({ result });
      }
      else {
        return res.status(403).send("Forbidden access");
      }

    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.USER_SECRET, {
        expiresIn: '1d',
      })
      res.send({ result, token });
    })

    app.get('/available', async (req, res) => {
      const date = req.query.date;

      const services = await servicesCollections.find().toArray();
      const query = { date: date }
      const bookings = await bookingCollections.find(query).toArray();

      services.map(service => {
        const serviceBookings = bookings.filter(b => b.treatment === service.name);
        const booked = serviceBookings.map(s => s.slot);
        const available = service.slots.filter(s => !booked.includes(s))

        service.slots = available
      })
      res.send(services)
    })


  }
  finally {

  }

}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send("doctors portal runnning")
})

app.listen(port, () => {
  console.log("Listenning from doctors posrtal", port);
});
