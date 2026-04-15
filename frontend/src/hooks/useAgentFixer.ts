import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_URL = API_URL.replace('/api', '');

interface FixerHeartbeat {
  status: string;
  message: string;
  timestamp: string;
  health: Record<string, string>;
}

export function useAgentFixer() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isIdle, setIsIdle] = useState(false);

  // Idle detection
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsIdle(true), 300000); // 5 min idle
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      clearTimeout(idleTimer);
    };
  }, []);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('dexter_token');
    if (!token) return;

    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[AgentFixer] Connected to server');
    });

    newSocket.on('agent-fixer:heartbeat', (data: FixerHeartbeat) => {
      if (!isIdle && document.visibilityState === 'visible') {
        setToastMessage(data.message);
        setToastVisible(true);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isIdle]);

  const dismissToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  return {
    toastVisible,
    toastMessage,
    dismissToast,
    socket,
  };
}
