import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import io from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

const SOCKET_URL = 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Call States: 'idle', 'incoming', 'outgoing', 'active'
  const [callStatus, setCallStatus] = useState('idle');
  const [callInfo, setCallInfo] = useState({ peerId: '', peerName: '', callType: '', isCaller: false });
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]); // WebRTC candidate queue to prevent race conditions
  
  // Initialize Socket.io Connection
  useEffect(() => {
    if (user) {
      const socketConn = io(SOCKET_URL, {
        query: { userId: user._id },
      });

      setSocket(socketConn);
      socketRef.current = socketConn;

      socketConn.on('getOnlineUsers', (users) => {
        setOnlineUsers(users);
      });

      // Handle WebRTC Call signaling
      socketConn.on('incoming-call', ({ signal, from, name, callType }) => {
        setCallStatus('incoming');
        setCallInfo({ peerId: from, peerName: name, callType, isCaller: false });
        socketRef.current.pendingSignal = signal;
      });

      socketConn.on('call-accepted', async ({ signal }) => {
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
            setCallStatus('active');
            
            // Drain ICE candidates queue
            await drainIceCandidatesQueue();
          }
        } catch (err) {
          console.error('Error accepting remote signal:', err);
        }
      });

      socketConn.on('ice-candidate', async ({ candidate }) => {
        try {
          if (peerConnectionRef.current) {
            // Check if remoteDescription is set before adding candidates
            if (peerConnectionRef.current.remoteDescription && peerConnectionRef.current.remoteDescription.type) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              // Queue candidate to avoid WebRTC state error
              iceCandidatesQueueRef.current.push(candidate);
            }
          }
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });

      socketConn.on('call-rejected', () => {
        cleanupCall();
        alert('Call was rejected or busy.');
      });

      socketConn.on('end-call', () => {
        cleanupCall();
      });

      return () => {
        socketConn.disconnect();
        cleanupCall();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      cleanupCall();
    }
  }, [user]);

  // Drain queued ICE candidates once remote description is set
  const drainIceCandidatesQueue = async () => {
    if (peerConnectionRef.current && iceCandidatesQueueRef.current.length > 0) {
      console.log(`Draining ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
      for (const cand of iceCandidatesQueueRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }
      iceCandidatesQueueRef.current = [];
    }
  };

  // Clean up WebRTC streams and connections
  const cleanupCall = () => {
    setCallStatus('idle');
    setCallInfo({ peerId: '', peerName: '', callType: '', isCaller: false });
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    iceCandidatesQueueRef.current = []; // Clear candidate queue

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setRemoteStream(null);
  };

  // Setup WebRTC peer connection
  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Initiate call
  const initiateCall = async (targetUserId, targetUsername, callType) => {
    try {
      setCallStatus('outgoing');
      setCallInfo({ peerId: targetUserId, peerName: targetUsername, callType, isCaller: true });

      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: 640, height: 480 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(targetUserId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('call-user', {
          userToCall: targetUserId,
          signalData: offer,
          from: user._id,
          name: user.username,
          callType,
        });
      }
    } catch (err) {
      console.error('Error starting call:', err);
      cleanupCall();
      alert('Could not access microphone/camera: ' + err.message);
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!socketRef.current || !socketRef.current.pendingSignal) return;

    try {
      setCallStatus('active');
      
      const constraints = {
        audio: true,
        video: callInfo.callType === 'video' ? { width: 640, height: 480 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(callInfo.peerId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(socketRef.current.pendingSignal));
      
      // Drain ICE candidates queue
      await drainIceCandidatesQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('answer-call', {
        to: callInfo.peerId,
        signal: answer,
      });
    } catch (err) {
      console.error('Error answering call:', err);
      cleanupCall();
      alert('Could not access microphone/camera to answer call: ' + err.message);
    }
  };

  // Reject call
  const rejectCall = () => {
    if (socketRef.current && callInfo.peerId) {
      socketRef.current.emit('call-rejected', { to: callInfo.peerId });
    }
    cleanupCall();
  };

  // End active call
  const endCall = () => {
    if (socketRef.current && callInfo.peerId) {
      socketRef.current.emit('end-call', { to: callInfo.peerId });
    }
    cleanupCall();
  };

  // Toggle Mute Audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video Camera
  const toggleVideo = () => {
    if (localStreamRef.current && callInfo.callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current || callInfo.callType !== 'video') return;

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setLocalStream(screenStream);
        setIsScreenSharing(true);
      } else {
        await stopScreenSharing();
      }
    } catch (err) {
      console.error('Error starting screen share:', err);
    }
  };

  const stopScreenSharing = async () => {
    if (!peerConnectionRef.current) return;
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender) {
        videoSender.replaceTrack(cameraTrack);
      }

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      localStreamRef.current = cameraStream;
      setLocalStream(cameraStream);
      setIsScreenSharing(false);
      setIsVideoOff(false);
    } catch (err) {
      console.error('Error stopping screen share:', err);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        callStatus,
        callInfo,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        isScreenSharing,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
