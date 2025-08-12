const socket = io();

let currentUser = null;
let messages = [];
let replyTo = null;
let typingUsers = new Set();

// DOM Elements
const notifySound = document.getElementById("notifySound");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const messageInput = document.getElementById("messageInput");
const loginDiv = document.getElementById("login");
const chatDiv = document.getElementById("chat");
const usersDiv = document.getElementById("users");
const usersCountSpan = document.getElementById("usersCount");
const usersListSpan = document.getElementById("usersList");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");

const replyBox = document.getElementById("replyBox");
const replyUsername = document.getElementById("replyUsername");
const replyText = document.getElementById("replyText");
const cancelReplyBtn = document.getElementById("cancelReply");

const loginBtn = document.getElementById("loginBtn");
const usernameInput = document.getElementById("username");
const genderInputs = document.querySelectorAll('input[name="gender"]');
const adminPassInput = document.getElementById("adminPass");

const sendBtn = document.getElementById("sendBtn");

const openSettingsBtn = document.getElementById("openSettingsBtn");
const adminSettingsDiv = document.getElementById("adminSettings");
const bannedUsersList = document.getElementById("bannedUsersList");
const banUsernameInput = document.getElementById("banUsernameInput");
const banUserBtn = document.getElementById("banUserBtn");
const unbanUsernameInput = document.getElementById("unbanUsernameInput");
const unbanUserBtn = document.getElementById("unbanUserBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

function showError(msg) {
  const loginError = document.getElementById("loginError");
  loginError.textContent = msg;
  setTimeout(() => { loginError.textContent = ""; }, 3000);
}

loginBtn.onclick = () => {
  const username = usernameInput.value.trim();
  const gender = [...genderInputs].find(r => r.checked).value;
  const adminPass = adminPassInput.value;

  if (!username) {
    showError("اكتب اسمك من فضلك");
    return;
  }

  currentUser = {
    username,
    gender,
    sessionId: localStorage.getItem("chatSessionId") || null,
    adminPass,
  };

  socket.emit("register", currentUser);
};

socket.on("loggedIn", (user) => {
  currentUser = user;
  localStorage.setItem("chatSessionId", user.sessionId);
  loginDiv.style.display = "none";
  chatDiv.style.display = "block";

  if (user.isAdmin) {
    openSettingsBtn.style.display = "inline-block";
  } else {
    openSettingsBtn.style.display = "none";
  }
});

socket.on("banned", () => {
  alert("تم حظرك من الدخول إلى الشات.");
  localStorage.removeItem("chatSessionId");
  location.reload();
});

socket.on("chatHistory", (msgs) => {
  messages = msgs;
  messagesDiv.innerHTML = "";
  msgs.forEach(addMessage);
  scrollToBottom();
});

socket.on("chatMessage", (data) => {
  messages.push(data);
  addMessage(data);
  notifySound.play();
  scrollToBottom();
});

socket.on("messageEdited", (msg) => {
  const msgEl = messagesDiv.querySelector(`[data-id="${msg.id}"]`);
  if (msgEl) {
    const textEl = msgEl.querySelector(".text");
    if (textEl) textEl.textContent = msg.message;
    const editedTag = msgEl.querySelector(".edited");
    if (!editedTag) {
      const span = document.createElement("span");
      span.className = "edited";
      span.textContent = "(تم التعديل)";
      msgEl.querySelector(".username").after(span);
    }
  }
});

socket.on("messageDeleted", (msg) => {
  const msgEl = messagesDiv.querySelector(`[data-id="${msg.id}"]`);
  if (msgEl) {
    msgEl.classList.add("deleted");
    const textEl = msgEl.querySelector(".text");
    if (textEl) textEl.textContent = "تم حذف هذه الرسالة";
  }
});

socket.on("messageReadByUpdate", ({ messageId, readBy }) => {
  const msgEl = messagesDiv.querySelector(`[data-id="${messageId}"]`);
  if (msgEl) {
    let readBySpan = msgEl.querySelector(".readBy");
    if (!readBySpan) {
      readBySpan = document.createElement("div");
      readBySpan.className = "readBy";
      msgEl.appendChild(readBySpan);
    }
    readBySpan.textContent = `تمت القراءة بواسطة: ${readBy.length}`;
  }
});

socket.on("usersUpdate", (users) => {
  usersDiv.innerHTML = "";
  usersCountSpan.textContent = users.length;
  usersListSpan.textContent = users.map(u => u.username).join(", ");

  users.forEach(user => {
    const userEl = document.createElement("div");
    userEl.classList.add("user");
    userEl.innerHTML = `
      <img src="${user.pic}" alt="${user.username}" />
      <span>${user.username}</span>
      ${user.isAdmin ? `<span title="مشرف" style="color:blue;">👑</span>` : ""}
    `;
    usersDiv.appendChild(userEl);
  });

  // تحديث قائمة المحظورين في صفحة الإعدادات
  if (currentUser?.isAdmin) {
    updateBannedUsersList(users.filter(u => u.banned).map(u => u.username));
  }
});

socket.on("typing", ({ username, isTyping }) => {
  if (isTyping) {
    typingUsers.add(username);
  } else {
    typingUsers.delete(username);
  }
  updateTypingIndicator();
});

function updateTypingIndicator() {
  if (typingUsers.size === 0) {
    typingIndicator.textContent = "";
  } else {
    typingIndicator.textContent = Array.from(typingUsers).join(", ") + " يكتب...";
  }
}

// الإيموجي
emojiBtn.onclick = () => {
  emojiPicker.style.display = emojiPicker.style.display === "flex" ? "none" : "flex";
};

emojiPicker.querySelectorAll("span").forEach(span => {
  span.onclick = () => {
    messageInput.value += span.textContent;
    emojiPicker.style.display = "none";
    messageInput.focus();
  };
});

// إرسال رسالة
sendBtn.onclick = sendMessage;

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  } else {
    socket.emit("typing", true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing", false);
    }, 1000);
  }
});

let typingTimeout = null;

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit("chatMessage", {
    message: text,
    type: "text",
    replyTo: replyTo?.id || null,
  });

  messageInput.value = "";
  reply
