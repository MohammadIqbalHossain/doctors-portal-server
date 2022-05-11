const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express()

app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send("doctors portal runnning")
})

app.listen(port = () => {
   console.log("Listenning from doctors posrtal", port);
});
