/**
 * Class representing a chat application.
 * Manages user messages, communication via WebSocket, and local storage of messages.
 */
class ChatApp {
  /**
   * Creates an instance of the ChatApp class.
   * @param {string} roomId - The unique identifier for the chat room.
   * @param {string} username - The username of the current user.
   * @param {Object} elements - A collection of DOM element references used by the app.
   * @param {HTMLElement} elements.messagesContainer - The container for displaying messages.
   * @param {HTMLInputElement} elements.messageInput - The input field for entering messages.
   * @param {HTMLButtonElement} elements.sendMessageBtn - The button to send messages.
   * @param {HTMLElement} elements.localContainer - The container for displaying the user's video.
   * @param {HTMLElement} elements.remoteVideosContainer - The container for displaying remote videos.
   */
  constructor(roomId, username, elements) {
    this.roomId = roomId;
    this.username = username;
    this.localStorageRoomKey = `chatMessages_${this.roomId}`;
    this.socket = null;
    this.messagesContainer = elements.messagesContainer;
    this.messageInput = elements.messageInput;
    this.sendMessageBtn = elements.sendMessageBtn;
    this.localContainer = elements.localContainer;
    this.remoteVideosContainer = elements.remoteVideosContainer;

    this.initializeLocalStorage();
    this.initializeSocket();
  }

  /**
   * Initializes localStorage with the room ID and username.
   */
  initializeLocalStorage() {
    localStorage.setItem("roomId", this.roomId);
    localStorage.setItem("username", this.username);
  }

  /**
   * Retrieves the stored room ID and username from localStorage.
   * @returns {Object} An object containing the stored roomId and username.
   */
  getStoredData() {
    return {
      storedRoomId: localStorage.getItem("roomId"),
      storedUsername: localStorage.getItem("username"),
    };
  }

  /**
   * Displays the username of the current user on the page.
   */
  displayUsername() {
    const displayUsernameElement = document.getElementById("displayUsername");
    displayUsernameElement.textContent = this.username;
  }

  /**
   * Initializes the WebSocket connection to the server.
   */
  initializeSocket() {
    this.socket = io({
      transports: ["websocket"],
      upgrade: false,
      query: { roomId: this.roomId },
    });
    this.setupSocketListeners();
  }

  /**
   * Sets up event listeners for the WebSocket connection.
   */
  setupSocketListeners() {
    this.socket.on("message", ({ by, message }) => {
      this.appendMessage(this.messagesContainer, by, message);
      this.scrollToBottom(this.messagesContainer);

      // Save the message locally
      this.saveMessageToLocalStorage({ by, message, timestamp: Date.now() });
    });
  }

  /**
   * Loads messages from localStorage and displays them in the chat container.
   */
  loadMessages() {
    const storedMessages =
      JSON.parse(localStorage.getItem(this.localStorageRoomKey)) || [];
    this.messagesContainer.innerHTML = ""; // Clear the container

    storedMessages.forEach((msg) => {
      if (this.isMessageExpired(msg.timestamp)) return; // Skip expired messages
      this.appendMessage(this.messagesContainer, msg.by, msg.message);
    });

    this.scrollToBottom(this.messagesContainer);
  }

  /**
   * Checks if a message has expired based on its timestamp.
   * @param {number} timestamp - The timestamp of the message.
   * @returns {boolean} True if the message is expired, false otherwise.
   */
  isMessageExpired(timestamp) {
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    return Date.now() - timestamp > oneDay;
  }

  /**
   * Appends a new message to the chat container.
   * @param {HTMLElement} container - The container element to append the message to.
   * @param {string} by - The username of the message sender.
   * @param {string} message - The content of the message.
   */
  appendMessage(container, by, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add(
      "message",
      by === this.username ? "self" : "other"
    );
    messageElement.innerHTML = `<span class="username">${by}</span>: ${message}`;
    container.appendChild(messageElement);
  }

  /**
   * Scrolls the given container to the bottom.
   * @param {HTMLElement} container - The container to scroll.
   */
  scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Saves a message to localStorage.
   * @param {Object} message - The message object containing message details.
   * @param {string} message.by - The username of the message sender.
   * @param {string} message.message - The content of the message.
   * @param {number} message.timestamp - The timestamp when the message was sent.
   */
  saveMessageToLocalStorage(message) {
    const storedMessages =
      JSON.parse(localStorage.getItem(this.localStorageRoomKey)) || [];
    storedMessages.push(message);
    localStorage.setItem(
      this.localStorageRoomKey,
      JSON.stringify(storedMessages)
    );
  }

  /**
   * Sends a new message to the server and appends it locally.
   */
  sendMessage() {
    const messageText = this.messageInput.value.trim();
    if (!messageText) return;

    // Emit the message to the server
    this.socket.emit("message", {
      username: this.username,
      roomId: this.roomId,
      message: messageText,
    });

    // Append the message locally
    this.appendMessage(this.messagesContainer, "You", messageText);

    // Save the message locally
    this.saveMessageToLocalStorage({
      by: this.username,
      message: messageText,
      timestamp: Date.now(),
    });

    // Clear the input field
    this.messageInput.value = "";
    this.scrollToBottom(this.messagesContainer);
  }

  /**
   * Adds event listeners to the message input and send button.
   */
  initializeMessageSending() {
    this.sendMessageBtn.addEventListener("click", () => {
      this.sendMessage();
    });

    this.messageInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") this.sendMessage();
    });
  }

  /**
   * Initializes the chat application by loading messages and setting up event listeners.
   */
  initialize() {
    const { storedRoomId, storedUsername } = this.getStoredData();

    // Display username
    this.displayUsername();

    // Load existing messages
    this.loadMessages();

    // Set up message sending functionality
    this.initializeMessageSending();
  }
}

export default ChatApp;
