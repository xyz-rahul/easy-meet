// VideoConference.js
export default class VideoConference {
  /**
   * Initialize VideoConference class
   * @param {SocketIOClient.Socket} socket - The socket.io socket instance
   * @param {string} localUser - The local user's identifier
   * @param {string} roomId - The room identifier for the conference
   * @param {HTMLElement} localVideoElement - The DOM element for the local video
   * @param {HTMLElement} remoteVideosContainer - The DOM element where remote video elements will be appended
   */
  constructor(
    socket,
    localUser,
    roomId,
    localVideoElement,
    remoteVideosContainer
  ) {
    this.socket = socket || io(); // Initialize socket.io connection
    this.localUser = localUser;
    this.roomId = roomId;
    this.localVideoElement = localVideoElement;
    this.remoteVideosContainer = remoteVideosContainer;
    this.localStream = null;
    this.peerConnections = {}; // Track peer connections by user ID
    this.streamVideoMap = new Map();
    this.init();
  }

  /**
   * Initialize socket event listeners
   */
  init() {
    // Listen for offer from other participants
    this.socket.on("offer", async ({ offer, from, roomId }) => {
      const peerConnection = await this.createPeerConnection(from);
      this.peerConnections[from] = peerConnection;
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      this.socket.emit("answer", {
        answer,
        from: this.localUser,
        to: from,
        roomId,
      });
    });

    // Listen for answer from other participants
    this.socket.on("answer", async ({ answer, from, roomId }) => {
      const peerConnection = this.peerConnections[from];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    });

    // Listen for ICE candidates from other participants
    this.socket.on("candidate", async ({ candidate, from, roomId }) => {
      const peerConnection = this.peerConnections[from];
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (e) {
          console.error("Error adding received ICE candidate", e);
        }
      }
    });

    // Handle disconnect event for remote participants
    this.socket.on("disconnect", (userId) => {
      this.removeVideoElement(userId);
      delete this.peerConnections[userId];
    });
  }

  /**
   * Initiates a video call by making an offer to other participants
   */
  async makeOffer() {
    const peerConnection = await this.createPeerConnection(this.localUser);
    this.peerConnections[this.localUser] = peerConnection;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    this.socket.emit("offer", {
      offer,
      from: this.localUser,
      roomId: this.roomId,
    });
  }

  /**
   * Get local media stream (audio and video)
   * @returns {Promise<MediaStream>} - The local media stream
   */
  async getLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      this.localVideoElement.srcObject = this.localStream;
      return this.localStream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
    }
  }

  /**
   * Create a new peer connection for a given remote user
   * @param {string} remoteUser - The identifier of the remote user
   * @returns {RTCPeerConnection} - The newly created peer connection
   */
  async createPeerConnection(remoteUser) {
    await this.getLocalStream(); // Ensure the local stream is available

    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local media tracks to the peer connection
    this.localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, this.localStream));

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("candidate", {
          candidate: event.candidate,
          from: this.localUser,
          to: remoteUser,
          roomId: this.roomId,
        });
      }
    };

    // Handle incoming remote tracks
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let videoElement = this.streamVideoMap.get(remoteUser);
      if (!videoElement) {
        videoElement = this.createAndAppendVideoElement(remoteUser);
        this.streamVideoMap.set(remoteUser, videoElement);
      }
      videoElement.srcObject = remoteStream;
    };

    peerConnection.onconnectionstatechange = (event) => {
      if (peerConnection.connectionState === "disconnected") {
        this.removeVideoElement(remoteUser);
      }
    };

    return peerConnection;
  }

  /**
   * Create and append a video element for the remote user
   * @param {string} id - The user ID for which the video element is created
   * @returns {HTMLVideoElement} - The created video element
   */
  createAndAppendVideoElement(id) {
    const videoElement = document.createElement("video");
    videoElement.id = id;
    videoElement.setAttribute("autoplay", "true");
    videoElement.setAttribute("muted", "true");
    videoElement.setAttribute("playsinline", "true");
    this.remoteVideosContainer.appendChild(videoElement);
    return videoElement;
  }

  /**
   * Remove the video element for a given user
   * @param {string} userId - The user ID for whom the video element should be removed
   */
  removeVideoElement(userId) {
    const videoElement = this.streamVideoMap.get(userId);
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.remove();
      this.streamVideoMap.delete(userId);
    }
  }
}
