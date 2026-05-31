import React, { useContext, useEffect, useRef } from 'react';
import { SocketContext } from '../context/SocketContext';

const CallModal = () => {
  const {
    callStatus,
    callInfo,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useContext(SocketContext);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 7, 14, 0.95)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      color: '#fff',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* 1. OUTGOING CALL STATE */}
      {callStatus === 'outgoing' && (
        <div style={{ textAlign: 'center' }}>
          <div className="avatar-ringing">
            <div className="pulse-ring"></div>
            <div className="pulse-ring2"></div>
            <span style={{ fontSize: '3.5rem' }}>📞</span>
          </div>
          <h2 style={{ marginTop: '30px', fontSize: '1.8rem', fontWeight: 600 }}>
            Calling {callInfo.peerName}...
          </h2>
          <p style={{ color: 'var(--text-gray)', marginTop: '10px' }}>
            Ringing {callInfo.callType} call
          </p>
          
          <button
            onClick={endCall}
            className="glass-button"
            style={{
              marginTop: '50px',
              background: 'var(--error-red)',
              color: '#fff',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              padding: 0
            }}
          >
            ❌
          </button>
        </div>
      )}

      {/* 2. INCOMING CALL STATE */}
      {callStatus === 'incoming' && (
        <div style={{ textAlign: 'center' }}>
          <div className="avatar-ringing">
            <div className="pulse-ring"></div>
            <div className="pulse-ring2"></div>
            <span style={{ fontSize: '3.5rem' }}>🔔</span>
          </div>
          <h2 style={{ marginTop: '30px', fontSize: '1.8rem', fontWeight: 600 }}>
            {callInfo.peerName} Calling
          </h2>
          <p style={{ color: 'var(--text-gray)', marginTop: '10px' }}>
            Incoming {callInfo.callType} call
          </p>

          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', marginTop: '50px' }}>
            <button
              onClick={rejectCall}
              className="glass-button"
              style={{
                background: 'var(--error-red)',
                color: '#fff',
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                padding: 0
              }}
            >
              Decline
            </button>
            <button
              onClick={acceptCall}
              className="glass-button"
              style={{
                background: 'var(--success-green)',
                color: '#000',
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                padding: 0
              }}
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CALL STATE */}
      {callStatus === 'active' && (
        <div style={{
          width: '90%',
          maxWidth: '1000px',
          height: '80%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Connected with {callInfo.peerName}</h3>
            <span style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.85rem'
            }}>
              {callInfo.callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
            </span>
          </div>

          {/* Video Streams Grid */}
          <div style={{
            position: 'relative',
            flexGrow: 1,
            margin: '20px 0',
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {callInfo.callType === 'video' ? (
              <>
                {/* Remote Stream (Main view) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                
                {/* Local Stream (Picture-in-Picture window) */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  width: '200px',
                  height: '150px',
                  background: '#111',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid var(--accent-cyan)',
                  boxShadow: 'var(--glass-shadow)',
                  zIndex: 2
                }}>
                  {isVideoOff ? (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      color: 'var(--text-gray)'
                    }}>
                      Camera Off
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: isScreenSharing ? 'none' : 'scaleX(-1)' // Mirror local cam
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              // Audio Call Visualizer Placeholder
              <div style={{ textAlign: 'center' }}>
                <div className="audio-visualizer-wave">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                {/* Hidden Audio Elements to play stream */}
                <audio ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                <audio ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                <p style={{ marginTop: '20px', color: 'var(--text-gray)' }}>Speaking...</p>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '15px 30px',
            borderRadius: '24px',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              onClick={toggleMute}
              className={`glass-button secondary ${isMuted ? 'active-red' : ''}`}
              style={{
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                padding: 0,
                backgroundColor: isMuted ? 'rgba(255, 61, 0, 0.2)' : ''
              }}
            >
              {isMuted ? '🎙️❌' : '🎙️'}
            </button>

            {callInfo.callType === 'video' && (
              <>
                <button
                  onClick={toggleVideo}
                  className={`glass-button secondary ${isVideoOff ? 'active-red' : ''}`}
                  style={{
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    padding: 0,
                    backgroundColor: isVideoOff ? 'rgba(255, 61, 0, 0.2)' : ''
                  }}
                >
                  {isVideoOff ? '📹❌' : '📹'}
                </button>

                <button
                  onClick={toggleScreenShare}
                  className={`glass-button secondary ${isScreenSharing ? 'active-blue' : ''}`}
                  style={{
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    padding: 0,
                    backgroundColor: isScreenSharing ? 'rgba(79, 172, 254, 0.2)' : ''
                  }}
                >
                  🖥️
                </button>
              </>
            )}

            <button
              onClick={endCall}
              className="glass-button"
              style={{
                background: 'var(--error-red)',
                color: '#fff',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                padding: 0
              }}
            >
              🛑
            </button>
          </div>
        </div>
      )}

      <style>{`
        .avatar-ringing {
          position: relative;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-glass);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }
        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid var(--accent-cyan);
          animation: ringPulse 2s infinite ease-out;
        }
        .pulse-ring2 {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid var(--accent-blue);
          animation: ringPulse 2s infinite ease-out;
          animation-delay: 1s;
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .audio-visualizer-wave {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          height: 60px;
        }
        .audio-visualizer-wave span {
          width: 6px;
          height: 15px;
          background: var(--accent-cyan);
          border-radius: 3px;
          animation: dance 1s infinite alternate;
        }
        .audio-visualizer-wave span:nth-child(2) { animation-delay: 0.15s; height: 35px; }
        .audio-visualizer-wave span:nth-child(3) { animation-delay: 0.3s; height: 45px; }
        .audio-visualizer-wave span:nth-child(4) { animation-delay: 0.45s; height: 25px; }
        .audio-visualizer-wave span:nth-child(5) { animation-delay: 0.6s; height: 10px; }
        @keyframes dance {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
};

export default CallModal;
