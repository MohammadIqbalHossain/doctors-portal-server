const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, FindCursor } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express()

app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s2vmm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();
    
    const servicesCollections = client.db("doctors_portal").collection("services");
    
    app.get('/service', async(req, res) => {
      const query = {};
      const cursor = servicesCollections.find(query);
      const result = await cursor.toArray();
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
