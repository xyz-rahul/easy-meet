const path = require("path");
const express = require("express");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const socketIO = require("socket.io");

const usernameSet = new Set();

const usersInRooms = {};

const app = express();
const server = http.createServer(app);
const socket = new socketIO.Server(server, {
  pingInterval: 6000,
});

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
  usersInRooms[roomId] = [username]; // Add user to the room

  res.redirect(`/room/${roomId}`);
});

app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const username = req.session.username;
  if (!username) {
    res.redirect(`/join-room/${roomId}`);
  }

  res.render("room", { username, roomId, users: usersInRooms[roomId] || [] });

  //   res.render("room", {
  //     username,
  //     roomId,
  //   });
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
  // Add the user to the room
  if (!usersInRooms[roomId]) {
    usersInRooms[roomId] = [];
  }
  usersInRooms[roomId].push(username);

  res.redirect(`/room/${roomId}`);
});

socket.on("connection", (socket) => {
  const { roomId } = socket.handshake.query;
  socket.join(roomId);

  socket.on("disconnect", () => {
    console.log("User disconnected with socketID: ", socket.id);
  });

  socket.on("message", ({ username, roomId, message }) => {
    console.log("message", { username, roomId, message });
    socket.to(roomId).emit("message", { by: username, message, a: "a" });
    // socket.emit("message", { by: username, message });
  });
});

const PORT = process.env.PORT;
if (!PORT) throw new Error("PORT not provided");
server.listen(PORT, () => console.log(`server listening on ${PORT}`));
