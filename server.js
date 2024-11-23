const path = require("path");
const express = require("express");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");

const usernameSet = new Set();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "your_secret_key",
    saveUninitialized: false,
    resave: false,
  })
);

app.get("/", (req, res) => {
  res.render("create-room");
});

app.post("/create-room", (req, res) => {
  const { username } = req.body;
  req.session.username = username;
  usernameSet.add(username);

  const roomId = uuidv4();
  res.redirect(`/room/${roomId}`);
});

app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const username = req.session.username;
  if (!username) {
    res.redirect(`/join-room/${roomId}`);
  }

  res.render("room", {
    username,
    roomId,
  });
});

app.get("/join-room/:roomId", (req, res) => {
  const { roomId } = req.params;
  res.render("join-room", {
    roomId,
  });
});

app.post("/join-room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const { username } = req.body;

  req.session.username = username;
  res.redirect(`/room/${roomId}`);
});

const PORT = process.env.PORT;
if (!PORT) throw new Error("PORT not provided");
app.listen(PORT, () => console.log(`server listening on ${PORT}`));
