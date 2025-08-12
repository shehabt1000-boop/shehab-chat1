const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

let users = [];
let messages = [];

function genId() { return Math.random().toString(36).slice(2,10); }
function now() { return new Date().toLocaleTimeString(); }

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('register', data => {
    if(!data.username) return;

    // ابحث عن مستخدم بنفس الجلسة
    let user = users.find(u => u.sessionId === data.sessionId);

    if(!user){
      user = {
        sessionId: data.sessionId || genId(),
        socketId: socket.id,
        username: data.username,
        gender: data.gender || 'male',
        pic: data.gender === 'female' ?
          'https://randomuser.me/api/portraits/women/1.jpg' :
          'https://randomuser.me/api/portraits/men/1.jpg',
        connected: true,
      };
      users.push(user);
    } else {
      user.socketId = socket.id;
      user.connected = true;
    }

    // ارسل للمستخدم معلوماته
    socket.emit('loggedIn', {
      sessionId: user.sessionId,
      username: user.username,
      gender: user.gender,
      pic: user.pic,
    });

    // ارسل تاريخ الشات القديم
    socket.emit('chatHistory', messages);

    // حدث قائمة المستخدمين المتصلين
    io.emit('usersUpdate', users.filter(u => u.connected));

    console.log('User registered:', user.username);
  });

  socket.on('chatMessage', data => {
    let user = users.find(u => u.socketId === socket.id);
    if(!user) return;

    const message = {
      id: genId(),
      userSessionId: user.sessionId,
      username: user.username,
      pic: user.pic,
      gender: user.gender,
      message: data.message,
      time: now(),
      type: 'text',
      replyTo: null,
      edited: false,
      deleted: false,
      readBy: []
    };

    messages.push(message);
    if(messages.length > 500) messages.shift();

    io.emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    let user = users.find(u => u.socketId === socket.id);
    if(user){
      user.connected = false;
      user.socketId = null;
      io.emit('usersUpdate', users.filter(u => u.connected));
    }
    console.log('User disconnected:', socket.id);
  });
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
