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
app.use(express.static("public"));
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
app.get("/video", (req, res) => {
  res.render("video");
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

  socket.on("message", ({ username, roomId, message }) => {
    socket.to(roomId).emit("message", { by: username, message, a: "a" });
  });

  // Listen for 'offer' from client (initial offer for video connection)
  socket.on("offer", (data) => {
    console.log("Offer received from " + data.from);
    // Broadcast the offer to the room (or to a specific user)
    // socket.to(data.roomId).emit("offer", {
    //   offer: data.offer,
    //   from: data.from,
    //   roomId: data.roomId,
    // });
    console.log("offer", data);

    socket.broadcast.emit("offer", {
      offer: data.offer,
      from: data.from,
      roomId: data.roomId,
    });
  });

  // Listen for 'answer' from client (the response to an offer)
  socket.on("answer", (data) => {
    console.log("Answer received from " + data.from);
    // Broadcast the answer to the specific user who made the offer
    // socket.to(data.roomId).emit("answer", {
    //   answer: data.answer,
    //   from: data.from,
    //   roomId: data.roomId,
    // });
    console.log("answer", data);

    socket.broadcast.emit("answer", {
      answer: data.answer,
      from: data.from,
      roomId: data.roomId,
    });
  });

  // Listen for ICE candidates (for NAT traversal)
  socket.on("candidate", (data) => {
    console.log("candidate", data);
    console.log("Candidate received from " + data.from);
    // Forward the candidate to the appropriate user
    // socket.to(data.roomId).emit("candidate", {
    //   candidate: data.candidate,
    //   from: data.from,
    //   roomId: data.roomId,
    // });
    socket.broadcast.emit("candidate", {
      candidate: data.candidate,
      from: data.from,
      roomId: data.roomId,
    });
  });

  // Handle room creation (user joining a specific room)
  socket.on("joinRoom", (roomId) => {
    console.log("User joining room: " + roomId);
    socket.join(roomId); // Add the user to the specified room
    socket.emit("joinedRoom", roomId); // Let the user know they've joined the room
  });
});

const PORT = process.env.PORT;
if (!PORT) throw new Error("PORT not provided");
server.listen(PORT, () => console.log(`server listening on ${PORT}`));
