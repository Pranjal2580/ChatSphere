import React, { useState, useRef, useEffect } from 'react';

const VoiceRecorder = ({ onSendAudio, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        onSendAudio(audioBlob);
        
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Error starting audio recording:', err);
      alert('Could not access microphone: ' + err.message);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Clear data handler and stop tracks
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.stop();
      
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
    stopTimer();
    onCancel();
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prevTime) => prevTime + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      background: 'rgba(255, 61, 0, 0.1)',
      border: '1px solid rgba(255, 61, 0, 0.25)',
      padding: '8px 16px',
      borderRadius: '24px',
      width: '100%',
      animation: 'pulseGlow 1.5s infinite alternate'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Pulsing red dot */}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#ff3d00',
          animation: 'pulseDot 1s infinite alternate'
        }}></div>
        <span style={{ fontSize: '0.9rem', color: '#ff8a65', fontWeight: '500' }}>
          Recording {formatTime(recordingTime)}
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <button
          onClick={cancelRecording}
          className="glass-button secondary"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          Cancel
        </button>
        <button
          onClick={stopRecording}
          className="glass-button"
          style={{
            padding: '6px 16px',
            fontSize: '0.8rem',
            borderRadius: '16px',
            background: 'var(--accent-gradient)'
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes pulseDot {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 5px rgba(255, 61, 0, 0.1); }
          100% { box-shadow: 0 0 15px rgba(255, 61, 0, 0.25); }
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;
