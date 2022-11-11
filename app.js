const express = require("express");
const path = require("path");

// Start a server
const app = express();
const port = process.env.PORT || "5500";

// Open the server
app.listen(port, () => {
    console.log(`Listening to requests on http://localhost:${port}`);
});

app.use(express.urlencoded());
app.use(express.json());  

const indexRouter = require('./routes/indexRouter')
app.use('/', indexRouter)

// Set the view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Send the view to the server
app.get("/", (req, res) => {
  res.render("index");
});

