import React, { useState, useEffect, useRef } from 'react';
import { Heart, Trophy, RefreshCcw, Plus, Trash2, Play, X, Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, setDoc, doc } from 'firebase/firestore';

// אתחול Firebase למערכת טבלת המובילים (Leaderboard)
let app, auth, db, appId;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyDSMTWQLUJZR8EWv1szNOaSIAS-WFoxHgw",
    authDomain: "pacmanwords.firebaseapp.com",
    projectId: "pacmanwords",
    storageBucket: "pacmanwords.firebasestorage.app",
    messagingSenderId: "1066338014489",
    appId: "1:1066338014489:web:b15443aa8276c739ff2188",
    measurementId: "G-2KV3EV89J7"
  };
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'pacman-words-app';
} catch (e) {
  console.log("Firebase setup warning: Please add configuration to share leaderboards online.", e);
}

const getTile = (mapArr, r, c) => {
  if (!mapArr || mapArr.length === 0) return 1;
  const rows = mapArr.length;
  const cols = mapArr[0].length;
  const safeR = ((r % rows) + rows) % rows;
  const safeC = ((c % cols) + cols) % cols;
  return mapArr[safeR][safeC];
};

const BASE_MAP = [
  [1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1], 
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,2,2,1,1,1,2,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1],
  [1,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,1],
  [1,1,1,1,2,1,2,1,1,0,1,1,2,1,2,1,1,1,1],
  [0,0,2,2,2,2,2,1,0,0,0,1,2,2,2,2,2,0,0], 
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,1],
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,2,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,2,1],
  [1,1,2,1,2,1,2,1,1,2,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,2,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1]  
];

const TILE_SIZE = 20;
const PACMAN_SPEED = 2;
const GHOST_SPEED = 2;

export default function App() {
  const canvasRef = useRef(null);
  const [uiState, setUiState] = useState('menu'); 
  const prevUiState = useRef('menu'); 
  
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  const [customWords, setCustomWords] = useState(
    Array.from({ length: 10 }, () => ({ en: '', he: '' }))
  );
  const [setupError, setSetupError] = useState('');
  
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(5);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [feedbackType, setFeedbackType] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const scoresRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    
    const unsubscribe = onSnapshot(scoresRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      data.sort((a, b) => b.score - a.score);
      setLeaderboard(data.slice(0, 15)); 
    }, (error) => {
      console.error("Error fetching leaderboard", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleWordChange = (index, field, value) => {
    const newWords = [...customWords];
    newWords[index][field] = value;
    setCustomWords(newWords);
    setSetupError('');
  };

  const addWordRow = () => {
    if (customWords.length < 40) {
      setCustomWords([...customWords, { en: '', he: '' }]);
    }
  };

  const removeWordRow = (index) => {
    if (customWords.length > 10) {
      const newWords = [...customWords];
      newWords.splice(index, 1);
      setCustomWords(newWords);
    }
  };

  const gameRef = useRef({
    map: [],
    pacman: { x: 0, y: 0, dx: 0, dy: 0, nextDx: 0, nextDy: 0, speed: PACMAN_SPEED, radius: 8 },
    ghosts: [],
    vulnerableTimer: 0,
    score: 0,
    lives: 5,
    wordsRemaining: [],
    lastFrameTime: 0,
    dotsRemaining: 0
  });

  const generateGameMap = (requiredWordsCount) => {
    let newMap = BASE_MAP.map(row => [...row]);
    let dotPositions = [];
    
    for (let r = 0; r < newMap.length; r++) {
      for (let c = 0; c < newMap[r].length; c++) {
        if (newMap[r][c] === 2) dotPositions.push({ r, c });
      }
    }
    
    dotPositions.sort(() => Math.random() - 0.5);
    let powerPelletsCount = Math.min(requiredWordsCount, dotPositions.length);
    for (let i = 0; i < powerPelletsCount; i++) {
      let pos = dotPositions[i];
      newMap[pos.r][pos.c] = 3;
    }

    let totalDots = 0;
    for (let r = 0; r < newMap.length; r++) {
      for (let c = 0; c < newMap[r].length; c++) {
         if (newMap[r][c] === 2 || newMap[r][c] === 3) totalDots++;
      }
    }
    gameRef.current.dotsRemaining = totalDots;
    return newMap;
  };

  const spawnEntities = () => {
    gameRef.current.pacman.x = 9 * TILE_SIZE;
    gameRef.current.pacman.y = 15 * TILE_SIZE;
    gameRef.current.pacman.dx = 0;
    gameRef.current.pacman.dy = 0;
    gameRef.current.pacman.nextDx = 0;
    gameRef.current.pacman.nextDy = 0;

    const ghostColors = ['#ef4444', '#f472b6', '#06b6d4', '#f97316'];
    const spawnOffsets = [[9,9], [8,9], [10,9], [9,8]];
    
    gameRef.current.ghosts = ghostColors.map((color, idx) => ({
      x: spawnOffsets[idx][0] * TILE_SIZE,
      y: spawnOffsets[idx][1] * TILE_SIZE,
      dx: 1, dy: 0,
      color: color,
      speed: GHOST_SPEED
    }));
  };

  const startGame = () => {
    const validWords = customWords.filter(w => w.en.trim() !== '' && w.he.trim() !== '');
    
    if (validWords.length < 10) {
      setSetupError('יש להזין לפחות 10 צמדי מילים (אנגלית ועברית) כדי להתחיל.');
      return;
    }

    let validCount = validWords.length;
    gameRef.current.map = generateGameMap(validCount);
    spawnEntities();
    
    let shuffledVocab = [...validWords].sort(() => Math.random() - 0.5);
    gameRef.current.wordsRemaining = shuffledVocab;
    
    gameRef.current.score = 0;
    gameRef.current.lives = 5;
    gameRef.current.vulnerableTimer = 0;
    
    setDisplayScore(0);
    setDisplayLives(5);
    setHasSubmittedScore(false); 
    setUiState('playing');
  };

  const handleSaveScore = async () => {
    if (!user || !db || !playerName.trim() || hasSubmittedScore) return;
    setIsSubmittingScore(true);
    try {
      const docId = `${Date.now()}_${user.uid}`;
      const scoresRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', docId);
      await setDoc(scoresRef, {
        name: playerName.trim(),
        score: displayScore,
        timestamp: Date.now()
      });
      setHasSubmittedScore(true);
    } catch (e) {
      console.error("Error saving score:", e);
    }
    setIsSubmittingScore(false);
  };

  const triggerQuestion = () => {
    setUiState('question');
    let wordsArray = gameRef.current.wordsRemaining;
    if (wordsArray.length === 0) {
      const validWords = customWords.filter(w => w.en.trim() !== '' && w.he.trim() !== '');
      wordsArray = [...validWords].sort(() => Math.random() - 0.5);
      gameRef.current.wordsRemaining = wordsArray;
    }
    
    let selectedWord = wordsArray[Math.floor(Math.random() * wordsArray.length)];
    let askEnglish = Math.random() > 0.5;
    
    setCurrentQuestion({
      word: selectedWord,
      display: askEnglish ? selectedWord.en : selectedWord.he,
      target: askEnglish ? selectedWord.he : selectedWord.en,
      isTranslatingToHebrew: askEnglish
    });
    setUserAnswer('');
  };

  const handleAnswerSubmit = (e) => {
    e.preventDefault();
    if (!currentQuestion) return;

    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.target.toLowerCase();
    
    if (isCorrect) {
      gameRef.current.score += 5;
      gameRef.current.vulnerableTimer = 7000;
      setFeedbackType('correct');
      gameRef.current.wordsRemaining = gameRef.current.wordsRemaining.filter(w => w !== currentQuestion.word);
    } else {
      gameRef.current.score -= 3;
      setFeedbackType('incorrect');
    }
    
    setDisplayScore(gameRef.current.score);
    setUiState('feedback');

    setTimeout(() => {
      setUiState('playing');
    }, 1500);
  };

  const loseLife = () => {
    gameRef.current.lives -= 1;
    setDisplayLives(gameRef.current.lives);
    
    if (gameRef.current.lives <= 0) {
      setUiState('gameover');
    } else {
      spawnEntities();
    }
  };

  const openLeaderboard = () => {
    prevUiState.current = uiState;
    setUiState('leaderboard');
  };

  const closeLeaderboard = () => {
    if (prevUiState.current === 'gameover' || prevUiState.current === 'won') {
      setUiState('menu');
    } else {
      setUiState(prevUiState.current);
    }
  };

  useEffect(() => {
    let animationId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const update = (timestamp) => {
      if (uiState !== 'playing') {
        gameRef.current.lastFrameTime = timestamp;
        animationId = requestAnimationFrame(update);
        return;
      }

      let delta = timestamp - gameRef.current.lastFrameTime;
      gameRef.current.lastFrameTime = timestamp;

      const state = gameRef.current;
      const { pacman, map, ghosts } = state;

      if (state.vulnerableTimer > 0) {
        state.vulnerableTimer -= delta;
        if (state.vulnerableTimer < 0) state.vulnerableTimer = 0;
      }

      if (pacman.x % TILE_SIZE === 0 && pacman.y % TILE_SIZE === 0) {
        let gridX = Math.floor(pacman.x / TILE_SIZE);
        let gridY = Math.floor(pacman.y / TILE_SIZE);

        if (getTile(map, gridY + pacman.nextDy, gridX + pacman.nextDx) !== 1) {
          pacman.dx = pacman.nextDx;
          pacman.dy = pacman.nextDy;
        }

        if (getTile(map, gridY + pacman.dy, gridX + pacman.dx) === 1) {
          pacman.dx = 0;
          pacman.dy = 0;
        }

        const safeGridY = ((gridY % map.length) + map.length) % map.length;
        const safeGridX = ((gridX % map[0].length) + map[0].length) % map[0].length;
        
        if (map[safeGridY][safeGridX] === 2) {
          map[safeGridY][safeGridX] = 0;
          state.score += 1;
          state.dotsRemaining--;
          setDisplayScore(state.score);
        } else if (map[safeGridY][safeGridX] === 3) {
          map[safeGridY][safeGridX] = 0;
          state.dotsRemaining--;
          triggerQuestion();
        }
      }

      pacman.x += pacman.dx * pacman.speed;
      pacman.y += pacman.dy * pacman.speed;

      if (pacman.x <= -TILE_SIZE) pacman.x = canvas.width - TILE_SIZE;
      else if (pacman.x >= canvas.width) pacman.x = 0;

      if (pacman.y <= -TILE_SIZE) pacman.y = canvas.height - TILE_SIZE;
      else if (pacman.y >= canvas.height) pacman.y = 0;

      if (state.dotsRemaining <= 0) {
        setUiState('won');
      }

      for (let i = 0; i < ghosts.length; i++) {
        let g = ghosts[i];
        
        let dx = Math.abs(pacman.x - g.x);
        let dy = Math.abs(pacman.y - g.y);
        if (dx > canvas.width / 2) dx = canvas.width - dx;
        if (dy > canvas.height / 2) dy = canvas.height - dy;
        let dist = Math.hypot(dx, dy);
        
        if (dist < TILE_SIZE - 2) {
          if (state.vulnerableTimer > 0) {
            state.score += 2;
            setDisplayScore(state.score);
            g.x = 9 * TILE_SIZE;
            g.y = 9 * TILE_SIZE;
          } else {
            loseLife();
            break;
          }
        }

        if (g.x % TILE_SIZE === 0 && g.y % TILE_SIZE === 0) {
           let targetSpeed = state.vulnerableTimer > 0 ? 1 : 2;
           if (g.speed !== targetSpeed) {
              if (g.x % targetSpeed === 0 && g.y % targetSpeed === 0) {
                  g.speed = targetSpeed;
              }
           }
        }

        if (g.x % TILE_SIZE === 0 && g.y % TILE_SIZE === 0) {
          let gx = Math.floor(g.x / TILE_SIZE);
          let gy = Math.floor(g.y / TILE_SIZE);
          let possibleMoves = [];
          const dirs = [[0,-1], [0,1], [-1,0], [1,0]];
          
          for (let d of dirs) {
            if (d[0] === -g.dx && d[1] === -g.dy && (g.dx !== 0 || g.dy !== 0)) continue;
            if (getTile(map, gy + d[1], gx + d[0]) !== 1) {
              possibleMoves.push(d);
            }
          }
          
          if (possibleMoves.length === 0) {
            possibleMoves.push([-g.dx, -g.dy]);
          }
          
          let move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
          g.dx = move[0];
          g.dy = move[1];
        }

        g.x += g.dx * g.speed;
        g.y += g.dy * g.speed;

        if (g.x <= -TILE_SIZE) g.x = canvas.width - TILE_SIZE;
        else if (g.x >= canvas.width) g.x = 0;

        if (g.y <= -TILE_SIZE) g.y = canvas.height - TILE_SIZE;
        else if (g.y >= canvas.height) g.y = 0;
      }

      draw(ctx, state);
      animationId = requestAnimationFrame(update);
    };

    const draw = (ctx, state) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < state.map.length; y++) {
        for (let x = 0; x < state.map[y].length; x++) {
          let tileX = x * TILE_SIZE;
          let tileY = y * TILE_SIZE;
          
          if (state.map[y][x] === 1) {
            ctx.fillStyle = '#1e3a8a';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.fillRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.strokeRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          } else if (state.map[y][x] === 2) {
            ctx.fillStyle = '#fcd34d';
            ctx.beginPath();
            ctx.arc(tileX + TILE_SIZE/2, tileY + TILE_SIZE/2, 3, 0, Math.PI*2);
            ctx.fill();
          } else if (state.map[y][x] === 3) {
            ctx.fillStyle = '#fde047';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#facc15';
            ctx.beginPath();
            let radius = 6 + Math.sin(Date.now() / 150) * 1.5;
            ctx.arc(tileX + TILE_SIZE/2, tileY + TILE_SIZE/2, radius, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      let p = state.pacman;
      ctx.fillStyle = 'yellow';
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'yellow';
      ctx.beginPath();
      let angle = 0;
      if (p.dx === 1) angle = 0;
      else if (p.dx === -1) angle = Math.PI;
      else if (p.dy === 1) angle = Math.PI/2;
      else if (p.dy === -1) angle = -Math.PI/2;
      
      let mouthCycle = (Math.sin(Date.now() / 80) + 1) / 2;
      let mouthOpen = 0.2 * Math.PI * mouthCycle;
      
      ctx.arc(p.x + TILE_SIZE/2, p.y + TILE_SIZE/2, p.radius * 1.5, angle + mouthOpen, angle + 2*Math.PI - mouthOpen);
      ctx.lineTo(p.x + TILE_SIZE/2, p.y + TILE_SIZE/2);
      ctx.fill();
      ctx.shadowBlur = 0;

      state.ghosts.forEach(g => {
        let isFlashing = state.vulnerableTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0;
        let color = state.vulnerableTimer > 0 ? (isFlashing ? '#ffffff' : '#3b82f6') : g.color;
           
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        let cx = g.x + TILE_SIZE/2;
        let cy = g.y + TILE_SIZE/2;
        let rad = p.radius * 1.4;
        
        ctx.arc(cx, cy, rad, Math.PI, 0);
        ctx.lineTo(cx + rad, cy + rad);
        ctx.lineTo(cx + rad/2, cy + rad - 3);
        ctx.lineTo(cx, cy + rad);
        ctx.lineTo(cx - rad/2, cy + rad - 3);
        ctx.lineTo(cx - rad, cy + rad);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        if (state.vulnerableTimer <= 0) {
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'blue';
            let pupilOffsetX = g.dx; let pupilOffsetY = g.dy;
            ctx.beginPath(); ctx.arc(cx - 3 + pupilOffsetX, cy - 2 + pupilOffsetY, 1, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 3 + pupilOffsetX, cy - 2 + pupilOffsetY, 1, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = isFlashing ? 'red' : 'white';
            ctx.fillRect(cx - 4, cy - 2, 2, 2);
            ctx.fillRect(cx + 2, cy - 2, 2, 2);
            ctx.fillRect(cx - 4, cy + 3, 8, 1);
        }
      });
    };

    animationId = requestAnimationFrame((t) => { gameRef.current.lastFrameTime = t; update(t); });

    return () => cancelAnimationFrame(animationId);
  }, [uiState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (uiState !== 'playing') return;
      const p = gameRef.current.pacman;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp') { p.nextDx = 0; p.nextDy = -1; }
      else if (e.key === 'ArrowDown') { p.nextDx = 0; p.nextDy = 1; }
      else if (e.key === 'ArrowLeft') { p.nextDx = -1; p.nextDy = 0; }
      else if (e.key === 'ArrowRight') { p.nextDx = 1; p.nextDy = 0; }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState]);

  // פונקציית לחיצה לג'ויסטיק המובייל החדש
  const handleJoystick = (dx, dy) => {
    if (uiState !== 'playing') return;
    const p = gameRef.current.pacman;
    p.nextDx = dx;
    p.nextDy = dy;
  };

  // מנגנון ה-Swipe למובייל נשאר כגיבוי, אבל עכשיו זה בטוח ולא עושה ריפרש
  const touchStartRef = useRef(null);
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || uiState !== 'playing') return;
    let endX = e.changedTouches[0].clientX;
    let endY = e.changedTouches[0].clientY;
    let dx = endX - touchStartRef.current.x;
    let dy = endY - touchStartRef.current.y;
    const p = gameRef.current.pacman;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) { p.nextDx = 1; p.nextDy = 0; }
      else if (dx < -30) { p.nextDx = -1; p.nextDy = 0; }
    } else {
      if (dy > 30) { p.nextDx = 0; p.nextDy = 1; }
      else if (dy < -30) { p.nextDx = 0; p.nextDy = -1; }
    }
  };


  return (
    // תוספת ה-touch-none חשובה: היא מונעת מהדפדפן לעשות גלילה או Pull-to-refresh בזמן משחק
    <div dir="rtl" className={`min-h-screen bg-black flex flex-col items-center justify-center font-mono text-green-400 p-2 sm:p-4 relative overflow-hidden ${uiState === 'playing' ? 'touch-none' : ''}`}>
      
      {/* Scanline CRT overlay effect */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50 opacity-40"></div>

      {uiState !== 'leaderboard' && (
        <button
          onClick={openLeaderboard}
          className="absolute top-2 left-2 sm:top-4 sm:left-4 z-50 group flex flex-col items-center justify-center p-2 bg-pink-900/30 border-2 border-pink-500 rounded-lg shadow-[0_0_15px_#ec4899] hover:bg-pink-600 hover:text-white transition-all transform hover:scale-110"
        >
          <Trophy size={24} className="text-yellow-400 group-hover:animate-bounce drop-shadow-[0_0_8px_rgba(250,204,21,1)]" />
          <span className="text-[9px] sm:text-[10px] mt-1 font-black text-pink-300 uppercase tracking-wider group-hover:text-white">לוח תוצאות</span>
        </button>
      )}

      {uiState === 'playing' && (
        <div className="w-full max-w-[380px] flex justify-between items-center mb-2 px-2 z-10">
          <div className="flex flex-col items-start">
            <span className="text-green-500 text-xs font-bold tracking-widest uppercase mb-1">SCORE</span>
            <span className="text-2xl sm:text-3xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">{displayScore}</span>
          </div>
          
          <div className="flex space-x-1 space-x-reverse">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart key={i} size={20} className={i < displayLives ? 'text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-gray-800'} />
            ))}
          </div>
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden border-4 border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)] max-w-full z-10 bg-black">
        <canvas
          ref={canvasRef}
          width={BASE_MAP[0].length * TILE_SIZE}
          height={BASE_MAP.length * TILE_SIZE}
          className="bg-black max-w-[100vw] touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {uiState === 'menu' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-start p-4 sm:p-6 text-center overflow-y-auto border-4 border-green-500 shadow-[inset_0_0_50px_rgba(34,197,94,0.2)]">
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-1 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] shrink-0 mt-14 sm:mt-2">
              INSERT WORDS
            </h1>
            <p className="text-green-500 mb-3 text-[10px] sm:text-xs tracking-widest uppercase shrink-0">הזינו מינימום 10 מילים לתרגול</p>
            
            {setupError && (
              <div className="bg-red-900/50 border-2 border-red-500 text-red-400 px-3 py-2 rounded-lg mb-3 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-bold text-xs sm:text-sm">
                {setupError}
              </div>
            )}

            <div className="w-full max-w-md bg-black rounded-xl p-2 sm:p-4 mb-3 flex-1 overflow-y-auto min-h-[100px] border border-green-800 custom-scrollbar">
              <div className="flex font-bold text-green-500 mb-2 px-2 pb-2 border-b border-green-800 text-[10px] sm:text-sm tracking-widest uppercase">
                <div className="flex-1 text-right">עברית</div>
                <div className="flex-1 text-left">English</div>
                <div className="w-6 sm:w-8"></div>
              </div>
              
              {customWords.map((word, index) => (
                <div key={index} className="flex gap-1 sm:gap-2 mb-2 items-center">
                  <input 
                    type="text"
                    placeholder="עברית..."
                    dir="rtl"
                    value={word.he}
                    onChange={(e) => handleWordChange(index, 'he', e.target.value)}
                    className="flex-1 bg-gray-900 text-green-400 p-2 rounded border border-green-800 focus:border-green-400 focus:shadow-[0_0_10px_rgba(74,222,128,0.5)] outline-none w-full text-xs sm:text-sm"
                  />
                  <input 
                    type="text"
                    placeholder="ENGLISH..."
                    dir="ltr"
                    value={word.en}
                    onChange={(e) => handleWordChange(index, 'en', e.target.value)}
                    className="flex-1 bg-gray-900 text-green-400 p-2 rounded border border-green-800 focus:border-green-400 focus:shadow-[0_0_10px_rgba(74,222,128,0.5)] outline-none w-full text-xs sm:text-sm uppercase"
                  />
                  <button 
                    onClick={() => removeWordRow(index)}
                    disabled={customWords.length <= 10}
                    className={`p-1 sm:p-2 rounded transition ${customWords.length <= 10 ? 'text-gray-800 cursor-not-allowed' : 'text-red-500 hover:text-red-400 hover:drop-shadow-[0_0_8px_rgba(239,68,68,1)]'}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {customWords.length < 40 && (
                <button 
                  onClick={addWordRow}
                  className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-green-500 hover:text-green-300 hover:border-green-400 rounded border border-dashed border-green-800 transition uppercase tracking-widest text-[10px] sm:text-sm"
                >
                  <Plus size={16} />
                  <span>ADD WORD ({customWords.length}/40)</span>
                </button>
              )}
            </div>
            
            <button 
              onClick={startGame}
              className="shrink-0 bg-yellow-400 text-black text-lg md:text-xl font-black py-2 px-5 md:py-3 md:px-8 rounded-full hover:bg-yellow-300 transition shadow-[0_0_15px_rgba(250,204,21,0.8)] flex items-center gap-2 md:gap-3 mb-1 uppercase tracking-widest animate-pulse hover:animate-none hover:scale-105"
            >
              <Gamepad2 size={24} className="md:w-7 md:h-7" />
              התחל משחק
            </button>
          </div>
        )}

        {uiState === 'leaderboard' && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center p-6 overflow-y-auto z-50 border-4 border-pink-600 shadow-[inset_0_0_50px_rgba(219,39,119,0.3)]">
            <div className="w-full flex justify-between items-center mb-6 border-b-2 border-pink-800 pb-4">
              <h2 className="text-2xl md:text-3xl font-black text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)] tracking-widest">HIGH SCORES</h2>
              <button onClick={closeLeaderboard} className="text-pink-500 hover:text-white hover:drop-shadow-[0_0_10px_#fff] transition p-2">
                <X size={32} />
              </button>
            </div>
            
            <div className="w-full max-w-sm flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2">
              {leaderboard.length === 0 ? (
                <div className="text-center text-pink-800 mt-10 animate-pulse">
                  <Trophy size={64} className="mx-auto mb-4" />
                  <p className="tracking-widest uppercase text-sm">NO SCORES YET...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-3 border-l-4 ${idx === 0 ? 'bg-yellow-900/20 border-yellow-400 text-yellow-400' : idx === 1 ? 'bg-gray-800/50 border-gray-400 text-gray-300' : idx === 2 ? 'bg-orange-900/20 border-orange-500 text-orange-400' : 'bg-black border-green-800 text-green-500'}`}>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-lg sm:text-xl w-6 text-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold uppercase tracking-wider text-sm sm:text-base">{entry.name}</span>
                      </div>
                      <span className="font-black text-sm sm:text-lg drop-shadow-md">{entry.score} PTS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {uiState === 'question' && currentQuestion && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 sm:p-6 z-40">
            <div className="bg-black border-4 border-yellow-400 rounded-none p-6 sm:p-8 w-full max-w-sm text-center shadow-[0_0_40px_rgba(250,204,21,0.5)] animate-in zoom-in duration-200">
              <h2 className="text-sm sm:text-lg text-yellow-500 font-bold mb-2 tracking-widest uppercase">
                {currentQuestion.isTranslatingToHebrew ? 'TRANSLATE TO HEBREW' : 'TRANSLATE TO ENGLISH'}
              </h2>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-6 sm:mb-8 select-none drop-shadow-[0_0_10px_#fff]" dir="ltr">
                {currentQuestion.display}
              </div>
              
              <form onSubmit={handleAnswerSubmit} className="flex flex-col gap-4 sm:gap-6">
                <input
                  type="text"
                  autoFocus
                  dir={currentQuestion.isTranslatingToHebrew ? 'rtl' : 'ltr'}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="הקלד/י כאן..."
                  className="bg-gray-900 text-green-400 text-lg sm:text-xl font-bold p-3 sm:p-4 text-center outline-none border-2 border-green-500 focus:border-green-300 focus:shadow-[0_0_15px_rgba(74,222,128,0.6)] uppercase"
                />
                <button type="submit" className="bg-green-600 text-black text-lg sm:text-xl font-black py-3 sm:py-4 hover:bg-green-400 transition shadow-[0_0_15px_rgba(34,197,94,0.6)] uppercase tracking-widest">
                  בדוק תשובה
                </button>
              </form>
            </div>
          </div>
        )}

        {uiState === 'feedback' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            {feedbackType === 'correct' ? (
              <div className="text-green-500 text-[120px] sm:text-[180px] font-black drop-shadow-[0_0_50px_rgba(34,197,94,1)] animate-bounce leading-none">
                ✓
              </div>
            ) : (
              <div className="text-red-600 text-[120px] sm:text-[180px] font-black drop-shadow-[0_0_50px_rgba(220,38,38,1)] animate-pulse leading-none">
                ✗
              </div>
            )}
            <div className={`text-3xl sm:text-4xl font-black mt-4 uppercase tracking-widest ${feedbackType === 'correct' ? 'text-green-400 drop-shadow-[0_0_10px_#4ade80]' : 'text-red-500 drop-shadow-[0_0_10px_#ef4444]'}`}>
              {feedbackType === 'correct' ? '+5 PTS' : '-3 PTS'}
            </div>
          </div>
        )}

        {(uiState === 'gameover' || uiState === 'won') && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-40 overflow-y-auto border-4 border-red-600 shadow-[inset_0_0_50px_rgba(220,38,38,0.3)]">
            {uiState === 'won' ? (
              <h1 className="text-3xl sm:text-4xl font-black text-yellow-400 mb-4 sm:mb-6 drop-shadow-[0_0_20px_#facc15] tracking-widest">STAGE CLEAR!</h1>
            ) : (
              <h1 className="text-4xl sm:text-5xl font-black text-red-600 mb-4 sm:mb-6 drop-shadow-[0_0_20px_#dc2626] tracking-widest uppercase">GAME OVER</h1>
            )}
            
            <div className="text-lg sm:text-xl text-green-500 mb-6 sm:mb-8 flex flex-col items-center shrink-0 uppercase tracking-widest">
              FINAL SCORE
              <span className="text-5xl sm:text-6xl font-black text-white mt-1 sm:mt-2 drop-shadow-[0_0_15px_#fff]">{displayScore}</span>
            </div>

            {db && (
              <div className="w-full max-w-xs mb-6 sm:mb-8 bg-gray-900 p-4 sm:p-6 border-2 border-blue-500 shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                {!hasSubmittedScore ? (
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <p className="text-xs sm:text-sm text-blue-400 font-bold uppercase tracking-widest">ENTER INITIALS:</p>
                    <input 
                      type="text" 
                      placeholder="YOUR NAME"
                      maxLength="12"
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      className="p-2 sm:p-3 bg-black text-green-400 font-black text-lg sm:text-xl text-center outline-none border-2 border-blue-600 focus:border-yellow-400 focus:shadow-[0_0_15px_#facc15] uppercase"
                    />
                    <button 
                      onClick={handleSaveScore}
                      disabled={isSubmittingScore || !playerName.trim()}
                      className="bg-blue-600 text-white py-2 sm:py-3 font-black hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest shadow-[0_0_10px_#2563eb] text-sm sm:text-base"
                    >
                      {isSubmittingScore ? 'SAVING...' : 'SAVE SCORE'}
                    </button>
                  </div>
                ) : (
                  <div className="text-yellow-400 font-black text-lg sm:text-xl py-3 sm:py-4 uppercase tracking-widest drop-shadow-[0_0_10px_#facc15] animate-pulse">SCORE SAVED!</div>
                )}
              </div>
            )}
            
            <button 
              onClick={() => setUiState('menu')}
              className="bg-transparent text-green-400 font-black py-2 sm:py-3 px-6 sm:px-8 border-2 border-green-500 hover:bg-green-500 hover:text-black transition flex items-center gap-2 sm:gap-3 text-base sm:text-lg shrink-0 mb-4 uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.4)]"
            >
              <RefreshCcw size={20} />
              MAIN MENU
            </button>
          </div>
        )}
      </div>

      {/* ג'ויסטיק וירטואלי מבוסס על סגנון אטארי ישן למובייל */}
      {uiState === 'playing' && (
        <div className="mt-4 md:hidden z-10 touch-none flex flex-col items-center pb-8">
          <div dir="ltr" className="relative w-40 h-40 bg-gray-900 rounded-2xl border-[6px] border-black shadow-[0_10px_20px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)] p-2 grid grid-cols-3 grid-rows-3 gap-0 select-none">
            
            {/* הכפתור האדום הקלאסי בפינה */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-red-600 rounded-full border-4 border-red-900 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.6),inset_2px_2px_6px_rgba(255,150,150,0.6),0_4px_8px_rgba(0,0,0,0.8)]"></div>

            <div className="col-start-1 row-start-1"></div>
            
            <button onTouchStart={(e) => { e.preventDefault(); handleJoystick(0, -1); }} className="col-start-2 row-start-1 bg-gray-800 active:bg-gray-700 border-t-4 border-x-4 border-b-0 border-black rounded-t-lg shadow-[inset_0_4px_4px_rgba(255,255,255,0.1)] flex items-center justify-center text-gray-500 active:text-white transition-colors"><ArrowUp size={28} /></button>
            
            <div className="col-start-3 row-start-1"></div>
            
            <button onTouchStart={(e) => { e.preventDefault(); handleJoystick(-1, 0); }} className="col-start-1 row-start-2 bg-gray-800 active:bg-gray-700 border-l-4 border-y-4 border-r-0 border-black rounded-l-lg shadow-[inset_4px_0_4px_rgba(255,255,255,0.1)] flex items-center justify-center text-gray-500 active:text-white transition-colors"><ArrowLeft size={28} /></button>
            
            {/* מרכז הג'ויסטיק - ה"מוט" */}
            <div className="col-start-2 row-start-2 bg-gray-800 border-4 border-black flex items-center justify-center">
               <div className="w-8 h-8 bg-black rounded-full shadow-[inset_0_0_10px_rgba(255,255,255,0.2)]"></div>
            </div>
            
            <button onTouchStart={(e) => { e.preventDefault(); handleJoystick(1, 0); }} className="col-start-3 row-start-2 bg-gray-800 active:bg-gray-700 border-r-4 border-y-4 border-l-0 border-black rounded-r-lg shadow-[inset_-4px_0_4px_rgba(0,0,0,0.3)] flex items-center justify-center text-gray-500 active:text-white transition-colors"><ArrowRight size={28} /></button>
            
            <div className="col-start-1 row-start-3"></div>
            
            <button onTouchStart={(e) => { e.preventDefault(); handleJoystick(0, 1); }} className="col-start-2 row-start-3 bg-gray-800 active:bg-gray-700 border-b-4 border-x-4 border-t-0 border-black rounded-b-lg shadow-[inset_0_-4px_4px_rgba(0,0,0,0.3)] flex items-center justify-center text-gray-500 active:text-white transition-colors"><ArrowDown size={28} /></button>
            
            <div className="col-start-3 row-start-3"></div>
          </div>
        </div>
      )}
      
      {/* טקסט עזר במסכים גדולים */}
      {uiState !== 'playing' && (
         <div className="mt-6 hidden md:flex text-green-800 text-xs font-bold gap-6 tracking-widest uppercase z-10">
           <span>[ PC: ARROW KEYS ]</span>
           <span>[ MOBILE: ATARI JOYSTICK / SWIPE ]</span>
         </div>
      )}

    </div>
  );
}