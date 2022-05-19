const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, FindCursor , ObjectId} = require('mongodb');
const res = require('express/lib/response');
const { send } = require('express/lib/response');
const stripe = require('stripe')(process.env.STRIPR_SECRET_KEY);
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

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  next();
}) 


async function run() {
  try {
    await client.connect();

    const servicesCollections = client.db("doctors_portal").collection("services");
    const bookingCollections = client.db("doctors_portal").collection("booking");
    const userCollections = client.db("doctors_portal").collection("users");
    const doctorCollections = client.db("doctors_portal").collection("doctors");
    const paymentsCollections = client.db("doctors_portal").collection("payments");
    
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const initatorAccount = await userCollections.find({ email: requester });
      if (initatorAccount.role === "admin") {
        next();
      }
      else {
        return res.status(403).send("Forbidden access");
      }

    }

    app.post('/create-payment-intent',  async(req, res) => {
      const service = req.body;
      console.log(service);
      const price = service.price;
      const amount = price * 100;
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "USD",
        payment_method_types:["card"]
      })
      res.send({clientSecret: paymentIntent.client_secret})
    })

    app.patch("/booking/:id", async(req, res) => {
      const id = req.params.id;
      const payment = req.body;
      console.log(payment);
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const result = await paymentsCollections.insertOne(payment)
      const updatedBooking = await bookingCollections.updateOne(filter, updateDoc)
      res.send(updateDoc)
    })

    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = servicesCollections.find(query).project({ name: 1 });
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
      const user = await userCollections.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    app.put('/users/admin/:email', verifyToken, verifyAdmin, async(req, res) => {
      const email = req.params.email;
      console.log(email);
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollections.updateOne(filter, updateDoc);
        return res.send({ result });

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

    app.get("/booking/:id",  async(req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await bookingCollections.findOne(query);
      res.send(result);
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

    app.get("/doctor", async(req, res) => {
      const result = await doctorCollections.find().toArray();
      res.send(result);
    });

    app.post("/doctor", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await doctorCollections.insertOne(data);
      res.send(result);
    });

    app.delete("/doctor/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {email:email};
      const result = await doctorCollections.deleteOne(filter);
      res.send(result);
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
